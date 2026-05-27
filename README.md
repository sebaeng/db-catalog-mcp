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

## Local development (without Docker)

In a WSL terminal:

```bash
npm install        # first time only
npm run dev        # starts the server with tsx watch (auto-reload on save)
```

Then point `.vscode/mcp.json` to the local process instead of Podman,
or test the server manually by piping JSON-RPC messages to stdin.

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

## Using db-catalog in another VS Code project

The container image is built once per machine and shared across all projects.
You only need to bring the configuration files into the other workspace.

### Option A — per-workspace (recommended)

1. **Copy `.vscode/mcp.json`** into the `.vscode/` folder of the target project:

   ```powershell
   Copy-Item path\to\db-catalog-mcp\.vscode\mcp.json path\to\other-project\.vscode\mcp.json
   ```

2. **Create a `.env`** in the root of the target project with the DB credentials
   (same format as `.env.example`):

   ```dotenv
   DB_HOST=host.containers.internal
   DB_PORT=5432
   DB_NAME=your_database
   DB_USER=your_user
   DB_PASSWORD=your_password
   MCP_TRANSPORT=stdio
   ```

3. Reload VS Code in the target project — `db-catalog` will appear automatically in Copilot Agent mode.

> The `.env` path referenced in `mcp.json` uses `${workspaceFolder}`, so it always resolves
> relative to the project that is currently open.

### Option B — user-level (all workspaces at once)

Register the server once in your VS Code user settings so it is available in every workspace
without copying any files.

Open **Settings** (`Ctrl+,`) → search for `mcp` → **Edit in settings.json**, and add:

```json
"mcp": {
  "servers": {
    "db-catalog": {
      "type": "stdio",
      "command": "podman",
      "args": [
        "run", "--rm", "-i",
        "--env-file", "C:\\Users\\ietti\\Workspaces\\vscode\\db-catalog-mcp\\.env",
        "db-catalog-mcp"
      ]
    }
  }
}
```

> With Option B the `.env` path is absolute, so all projects share the same credentials file.

---

## Project layout

| Path | Description |
|------|-------------|
| `src/index.ts` | MCP server — pool, queries, tool registration, transport switching |
| `Dockerfile` | Multi-stage build: tsc → node:22-alpine runtime |
| `.vscode/mcp.json` | Registers the server with GitHub Copilot via Podman |
| `.env.example` | Template for DB credentials and transport settings |
| `.env` | Local credentials (git-ignored, must be created manually) |
