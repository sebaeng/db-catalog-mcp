# Plan: MCP Server db-catalog (TypeScript + PostgreSQL)

## TL;DR
MCP server TypeScript (SDK v1.x, `McpServer`, trasporto stdio) che espone il tool
`get_artifact_definition` per recuperare DDL SQL di funzioni, viste e stored procedure
da PostgreSQL 15.5 / EDB Advanced Server. Configurazione DB e trasporto via `.env`.
Build con `tsc` in Docker multi-stage (Node.js 22 alpine), runtime container con Podman.
Trasporto configurabile: stdio (default locale) o `streamable-http` (futuro deploy remoto).

---

## Fase 1 — Scaffolding progetto

1. Creare `PLAN.md` nella root del progetto ✓
2. Creare `package.json` con dipendenze e script
3. `npm install @modelcontextprotocol/sdk zod pg dotenv`
4. `npm install --save-dev typescript tsx @types/node @types/pg`
5. Creare `tsconfig.json`: target ES2022, module NodeNext, outDir `dist/`, rootDir `src/`, strict
6. Script npm: `"dev": "tsx watch src/index.ts"`, `"build": "tsc"`, `"start": "node dist/index.js"`
7. Creare `.gitignore` (esclude `.env`, `node_modules`, `dist`)

## Fase 2 — Configurazione

8. Creare `.env.example`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_database
   DB_USER=your_user
   DB_PASSWORD=your_password
   MCP_TRANSPORT=stdio
   MCP_PORT=8000
   ```
   > Nota: su Windows con Podman Desktop usare `DB_HOST=host.containers.internal`
9. Creare `.env` (non committato) con le credenziali reali

## Fase 3 — Implementazione server (`src/index.ts`)

10. Istanza `McpServer` con `{ name: 'db-catalog', version: '1.0.0' }`
11. Connessione PostgreSQL (`pg.Pool`) inizializzata al top-level, terminata su SIGINT/SIGTERM
12. Tool `get_artifact_definition` registrato con `server.registerTool(...)`:
    - `inputSchema`: `z.object({ schema, artifact_type: enum['function','view','procedure'], artifact_name })`
    - **funzioni**: `pg_get_functiondef` da `pg_proc + pg_namespace` con `prokind = 'f'`
    - **procedure**: stesso con `prokind = 'p'`
    - **viste**: `pg_get_viewdef` da `pg_class + pg_namespace` con `relkind = 'v'`
    - Gestione overload: più firme con stesso nome → definizioni concatenate con `---`
    - Messaggio esplicito se artefatto non trovato
13. `main()` con trasporto condizionale da env:
    - `MCP_TRANSPORT=stdio` → `StdioServerTransport`
    - `MCP_TRANSPORT=streamable-http` → `StreamableHTTPServerTransport` + `node:http` su `MCP_PORT`

## Fase 4 — Docker multi-stage

14. Creare `Dockerfile`:
    - Stage **builder**: `node:22-alpine`, `npm ci`, `npm run build`
    - Stage **runtime**: `node:22-alpine`, `npm ci --omit=dev`, `COPY dist/`, `CMD node dist/index.js`
15. Creare `.dockerignore` (esclude `.env`, `node_modules`, `dist`, `.git`)

## Fase 5 — Integrazione VS Code / Copilot

16. Creare `.vscode/mcp.json`:
    ```json
    {
      "servers": {
        "db-catalog": {
          "type": "stdio",
          "command": "podman",
          "args": ["run", "--rm", "-i", "--env-file", "${workspaceFolder}/.env", "db-catalog-mcp"]
        }
      }
    }
    ```
17. Creare `.github/copilot-instructions.md`

---

## File rilevanti

| File | Scopo |
|------|-------|
| `src/index.ts` | Implementazione server MCP |
| `package.json` | Dipendenze e script npm |
| `tsconfig.json` | Configurazione TypeScript (NodeNext, strict) |
| `Dockerfile` | Build multi-stage |
| `.dockerignore` | Esclusioni build container |
| `.vscode/mcp.json` | Registrazione server in GitHub Copilot |
| `.env` / `.env.example` | Configurazione DB e trasporto |

## Shell per i comandi

| Shell | Comandi |
|-------|---------|
| **WSL Debian** (node/npm già installati) | `npm install`, `npm run build`, `npm run dev` |
| **PowerShell (Windows)** | `podman build`, `podman run` |

- Percorso workspace da WSL: `/mnt/c/Users/ietti/Workspaces/vscode/db-catalog-mcp`
- Percorso workspace da Windows: `C:\Users\ietti\Workspaces\vscode\db-catalog-mcp`

## Verification

1. [WSL] `npm run build` — compilazione TS senza errori
2. [WSL] `npm run dev` — avvia server in locale con tsx
3. [pwsh] `podman build -t db-catalog-mcp .` — build immagine
4. [pwsh] `podman run --rm -i --env-file .env db-catalog-mcp` — smoke test
5. GitHub Copilot: server `db-catalog` nella lista strumenti
6. Chiamate tool con i tre artifact_type (`function`, `view`, `procedure`)

## Decisions

- **TypeScript SDK v1.x** (`@modelcontextprotocol/sdk` v1.29.0 stable); v2 pre-alpha escluso
- **ESM** (`"type": "module"`, `"module": "NodeNext"`) — approccio moderno per Node.js 22
- **npm** come package manager
- **pg (node-postgres)** con `pg.Pool` per connessione PostgreSQL
- **Build multi-stage Docker**: stage builder (tsc) + stage runtime (node + dist) → immagine minimale
- **tsx** solo per sviluppo locale; Docker usa `node dist/index.js`
- **Trasporto configurabile** via `MCP_TRANSPORT` env var; zero cambio codice per deploy futuro
- **Podman** come runtime container; `DB_HOST=host.containers.internal` su Windows Podman Desktop
- **EDB Advanced Server**: system catalog standard PostgreSQL; packages Oracle-style fuori scope
- **Overload**: più firme stesso nome → tutte le definizioni concatenate nel risultato
- `.env` NON committato; `.env.example` committato come template
