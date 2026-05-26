# db-catalog-mcp

MCP server that exposes the SQL DDL source code of database artifacts
(functions, views, stored procedures) from a PostgreSQL / EDB Advanced Server database.

Runs as a Podman container and integrates with GitHub Copilot Agent mode in VS Code.

---

## Prerequisites

| Tool | Where |
|------|-------|
| [Podman Desktop](https://podman-desktop.io/) | Windows |
| Node.js 18+ and npm | WSL (for local dev only) |

---

## First-time setup

### 1. Configure database credentials

Copy the example env file and fill in your credentials:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```dotenv
DB_HOST=host.containers.internal   # use this when the DB runs on the Windows host
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
MCP_TRANSPORT=stdio
```

> `.env` is git-ignored and never committed.

### 2. Build the container image

Run from a PowerShell terminal in the project root:

```powershell
podman build -t db-catalog-mcp .
```

### 3. Register the MCP server in VS Code

The file `.vscode/mcp.json` is already included in the repository and registers the server
automatically. VS Code will pick it up on next reload — no manual configuration needed.

To verify: open GitHub Copilot Chat in **Agent mode** and check that `db-catalog` appears
in the list of available tools (hammer icon).

---

## Updating the server

After modifying `src/index.ts`:

**1. Rebuild the TypeScript (WSL terminal):**

```bash
npm run build
```

**2. Rebuild the container image (PowerShell):**

```powershell
podman build -t db-catalog-mcp .
```

**3. Restart the MCP server in VS Code:**

`Ctrl+Shift+P` → **MCP: List Servers** → `db-catalog` → Restart Server

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

## Project layout

| Path | Description |
|------|-------------|
| `src/index.ts` | MCP server — pool, queries, tool registration, transport switching |
| `Dockerfile` | Multi-stage build: tsc → node:22-alpine runtime |
| `.vscode/mcp.json` | Registers the server with GitHub Copilot via Podman |
| `.env.example` | Template for DB credentials and transport settings |
| `.env` | Local credentials (git-ignored, must be created manually) |
