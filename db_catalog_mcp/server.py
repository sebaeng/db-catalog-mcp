"""MCP server — returns SQL DDL of database artifacts from PostgreSQL / EDB Advanced Server."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

import psycopg2
from psycopg2 import pool as pg_pool
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Load .env from the project root (two levels up: db_catalog_mcp/ → repo root)
load_dotenv(Path(__file__).parent.parent / ".env")

# ── SQL queries ───────────────────────────────────────────────────────────────
# psycopg2 uses %s placeholders; $1/$2 are the PostgreSQL wire-level syntax.

QUERIES: dict[str, str] = {
    "function": """
        SELECT p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS signature,
               pg_get_functiondef(p.oid) AS definition
        FROM   pg_proc p
        JOIN   pg_namespace n ON n.oid = p.pronamespace
        WHERE  n.nspname = %s
          AND  p.proname = %s
          AND  p.prokind = 'f'
    """,
    "procedure": """
        SELECT p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS signature,
               pg_get_functiondef(p.oid) AS definition
        FROM   pg_proc p
        JOIN   pg_namespace n ON n.oid = p.pronamespace
        WHERE  n.nspname = %s
          AND  p.proname = %s
          AND  p.prokind = 'p'
    """,
    "view": """
        SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS signature,
               'CREATE OR REPLACE VIEW '
               || quote_ident(n.nspname) || '.' || quote_ident(c.relname)
               || ' AS\n' || pg_get_viewdef(c.oid, true) AS definition
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        WHERE  n.nspname = %s
          AND  c.relname = %s
          AND  c.relkind = 'v'
    """,
}

# ── Connection pool (lazy init) ───────────────────────────────────────────────

_pool: pg_pool.SimpleConnectionPool | None = None


def _get_pool() -> pg_pool.SimpleConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            host=os.environ["DB_HOST"],
            port=int(os.environ.get("DB_PORT", "5432")),
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.environ.get("DB_PASSWORD", ""),
        )
    return _pool


# ── MCP server ────────────────────────────────────────────────────────────────

mcp = FastMCP("db-catalog")


@mcp.tool()
def get_artifact_definition(
    schema: str,
    artifact_type: Literal["function", "view", "procedure"],
    artifact_name: str,
) -> str:
    """Return the SQL DDL source code of a database artifact (function, view, or stored procedure).

    Returns the total count of implementations found and, for each one, its full signature
    and DDL definition. If multiple overloads exist for the same name, all are returned
    and clearly labeled.
    """
    conn = None
    try:
        conn = _get_pool().getconn()
        with conn.cursor() as cur:
            cur.execute(QUERIES[artifact_type], (schema, artifact_name))
            rows = cur.fetchall()

        if not rows:
            return f'No {artifact_type} named "{artifact_name}" found in schema "{schema}".'

        count = len(rows)
        header = (
            f'Found {count} implementation{"s" if count > 1 else ""} of {artifact_type} '
            f'"{artifact_name}" in schema "{schema}".'
        )
        blocks = [
            f"--- Implementation {i + 1}/{count} ---\n"
            f"Signature: {row[0]}\n\n"
            f"{row[1]}"
            for i, row in enumerate(rows)
        ]
        return "\n\n".join([header] + blocks)

    except Exception as exc:
        return f"Database error: {exc}"
    finally:
        if conn is not None:
            _get_pool().putconn(conn)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
