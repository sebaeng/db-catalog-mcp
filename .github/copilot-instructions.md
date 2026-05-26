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

Build the container image (PowerShell):
```
podman build -t db-catalog-mcp .
```

The server is registered in `.vscode/mcp.json` and starts automatically when GitHub Copilot
needs it. Database credentials are read from `.env` (copy from `.env.example`).

For local development without Docker (WSL Debian terminal):
```
npm run dev
```

## Project layout

| Path | Description |
|------|-------------|
| `src/index.ts` | MCP server — pool, queries, tool registration, transport switching |
| `Dockerfile` | Multi-stage build: tsc → node:22-alpine runtime |
| `.vscode/mcp.json` | Registers the server with GitHub Copilot via Podman |
| `.env.example` | Template for DB credentials and transport settings |
