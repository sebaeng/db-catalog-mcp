# db-catalog-mcp

MCP server that exposes the SQL DDL source code of database artifacts
(functions, views, stored procedures) from a PostgreSQL / EDB Advanced Server database.

Implemented in Python. Runs standalone.

---

## Prerequisites

| Tool | Notes |
|------|-------|
| Python 3.9+ | [python.org](https://www.python.org/downloads/) |
| pip | Included with Python |

---

## First-time setup

### 1. Configure database credentials

Copy the example env file and fill in your credentials:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
DB_HOST=your_host
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
```

> `.env` is git-ignored and never committed.

### 2. Install dependencies

Run once from the project root:

```powershell
pip install --user -e .
```

> `--user` installs to your user directory — no administrator rights required.
> This also registers the `db-catalog-mcp` command globally in your PATH.

### 3. Register the MCP server in VS Code

The file `.vscode/mcp.json` is already included in the repository and registers the server
automatically. VS Code will pick it up on next reload — no manual configuration needed.

To verify: open GitHub Copilot Chat in **Agent mode** and check that `db-catalog` appears
in the list of available tools (hammer icon).

---

## Using the server in other workspaces

After running `pip install --user -e .` once, copy `.vscode/mcp.json` to any other
workspace. The `db-catalog-mcp` command is available globally — no path adjustments needed.

---

## Updating the server

After modifying `db_catalog_mcp/server.py`, no rebuild is needed (editable install).

Restart the MCP server in VS Code:

`Ctrl+Shift+P` → **MCP: List Servers** → `db-catalog` → Restart Server

---

## Development / manual run

```powershell
python db_catalog_mcp/server.py
```

The server blocks waiting on stdin — this is expected for stdio MCP servers. Press `Ctrl+C` to stop.

---

## Uninstall

```powershell
pip uninstall db-catalog-mcp
```

Then remove (or empty) `.vscode/mcp.json` from any workspace where it was configured.

---

## Available tool

### `get_artifact_definition`

Returns the SQL DDL of one or more implementations of a database artifact.

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `string` | Schema name, e.g. `"public"` |
| `artifact_type` | `"function"` \| `"view"` \| `"procedure"` | Type of artifact |
| `artifact_name` | `string` | Name of the artifact |

**Response format:**

```
Found 2 implementations of procedure "my_proc" in schema "my_schema".

--- Implementation 1/2 ---
Signature: my_proc(id numeric, name character varying)

CREATE OR REPLACE PROCEDURE ...

--- Implementation 2/2 ---
Signature: my_proc(id numeric, name character varying, flag boolean DEFAULT false)

CREATE OR REPLACE PROCEDURE ...
```

---

## Project layout

| Path | Description |
|------|-------------|
| `db_catalog_mcp/server.py` | MCP server — pool, queries, tool registration |
| `pyproject.toml` | Package definition and pip entry point (`db-catalog-mcp`) |
| `.vscode/mcp.json` | Registers the server with GitHub Copilot |
| `.env.example` | Template for DB credentials |
| `.env` | Local credentials (git-ignored, must be created manually) |
