This workspace contains **db-catalog-mcp**, an MCP server that retrieves SQL DDL source code
of database artifacts from a PostgreSQL / EDB Advanced Server database.

## Available tool

### `get_artifact_definition`

Returns the SQL DDL of a function, view, or stored procedure.

**Parameters:**
- `schema` — schema name (e.g. `"public"`)
- `artifact_type` — `"function"` | `"view"` | `"procedure"`
- `artifact_name` — name of the artifact

**Returns:** SQL DDL as plain text. If multiple overloads exist for the same name,
all definitions are returned separated by `---`.

## How to build and run

Install dependencies (one-time, from the project root):
```
pip install --user -e .
```

The server is registered in `.vscode/mcp.json` and starts automatically when GitHub Copilot
needs it. Database credentials are read from `.env` (copy from `.env.example`).

For local development:
```
python db_catalog_mcp/server.py
```

## Project layout

| Path | Description |
|------|-------------|
| `db_catalog_mcp/server.py` | MCP server — pool, queries, tool registration |
| `pyproject.toml` | Package definition and pip entry point (`db-catalog-mcp`) |
| `.vscode/mcp.json` | Registers the server with GitHub Copilot |
| `.env.example` | Template for DB credentials |
