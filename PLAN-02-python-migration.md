# Piano: Migrazione db-catalog-mcp da TypeScript a Python

## TL;DR

Riscrivere il server MCP da TypeScript (Node.js + Podman) a Python puro usando solo `python` e `pip`.

| TypeScript | Python |
|---|---|
| `@modelcontextprotocol/sdk` | `mcp` (Python SDK ufficiale, FastMCP API) |
| `pg` | `psycopg2-binary` |
| `dotenv` | `python-dotenv` |
| Docker/Podman | — rimosso, standalone |
| trasporto HTTP | — rimosso, solo stdio |

Il server gira direttamente con `python server.py` (o come comando globale `db-catalog-mcp` dopo la Phase 5).

---

## Phase 1 — Core Python server

1. Creare `server.py` nella root:
   - Caricare l'env con `python-dotenv` usando `Path(__file__).parent / '.env'` (path esplicito, robusto quando lanciato da VS Code)
   - Creare pool psycopg2 (`psycopg2.pool.SimpleConnectionPool`, min=1, max=5)
   - Istanziare `FastMCP("db-catalog")` da `mcp.server.fastmcp`
   - Implementare il tool `get_artifact_definition(schema, artifact_type, artifact_name)`:
     - `artifact_type` tipizzato come `Literal["function", "view", "procedure"]`
     - Stesse tre query SQL di `src/index.ts` (dict `QUERIES`)
     - Stesso formato risposta: header + blocchi per implementazione
     - Gestione errori DB → restituisce testo di errore
   - Entry point: `if __name__ == "__main__": mcp.run(transport="stdio")`

2. Creare `requirements.txt` con 3 sole dipendenze:
   - `mcp` — MCP Python SDK ufficiale (include FastMCP)
   - `psycopg2-binary` — PostgreSQL adapter con binario incluso (no libpq-dev)
   - `python-dotenv` — caricamento `.env`

---

## Phase 2 — File di configurazione

3. Aggiornare `.env`:
   - Rimuovere le righe `MCP_TRANSPORT=stdio` e `MCP_PORT=8000` (e i relativi commenti)
   - Mantenere: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

4. Aggiornare `.env.example`:
   - Stessa semplificazione, con valori placeholder

5. Aggiornare `.vscode/mcp.json` (uso locale, path workspace):
   ```json
   {
     "servers": {
       "db-catalog": {
         "type": "stdio",
         "command": "python",
         "args": ["${workspaceFolder}/server.py"]
       }
     }
   }
   ```
   > Dopo la Phase 5 diventerà semplicemente `"command": "db-catalog-mcp"` senza args né path.

6. Aggiornare `.gitignore`:
   - Sostituire `node_modules` e `dist` con: `__pycache__/`, `*.pyc`, `.venv/`
   - Mantenere `.env`

---

## Phase 3 — Cleanup artefatti Node/Docker

7. Eliminare `src/index.ts` (e la directory `src/`)
8. Eliminare `package.json`
9. Eliminare `package-lock.json`
10. Eliminare `tsconfig.json`
11. Eliminare `Dockerfile`
12. Eliminare `.dockerignore`

> Le directory `node_modules/` e `dist/` sono gitignorate — possono essere rimosse manualmente con `Remove-Item -Recurse node_modules, dist`.

---

## Phase 4 — Documentazione

13. Riscrivere `README.md` con le sezioni:
    - Prerequisiti: Python 3.9+, pip (niente Podman, Node, WSL)
    - Setup iniziale: copiare `.env.example` → `.env`, inserire credenziali
    - Installazione dipendenze: `pip install --user -e .` (Phase 5) oppure `pip install -r requirements.txt` (solo locale)
    - Integrazione VS Code: `mcp.json` già incluso, rilevato automaticamente al reload
    - Avvio manuale / sviluppo: `python server.py` (rimane in attesa su stdin, comportamento atteso)
    - **Sezione disinstallazione**:
      1. `pip uninstall db-catalog-mcp`
      2. Rimuovere (o svuotare) `.vscode/mcp.json` in ogni workspace dove era stato configurato

14. Aggiornare `.github/copilot-instructions.md` con le nuove istruzioni di build/run Python.

---

## Phase 5 — Installazione pip globale (cross-workspace)

15. Aggiungere `pyproject.toml` nella root:
    - Build backend: `setuptools` (o `hatchling`)
    - Package name: `db-catalog-mcp`
    - Console script entry point: `db-catalog-mcp = db_catalog_mcp.server:main`
    - Dipendenze: `mcp`, `psycopg2-binary`, `python-dotenv`

16. Spostare `server.py` → `db_catalog_mcp/server.py`, creare `db_catalog_mcp/__init__.py` (vuoto), esporre `main()` come entry point

17. Eseguire **una-tantum** dalla root del progetto:
    ```powershell
    pip install --user -e .
    ```
    > `--user` evita problemi di permessi su Windows indipendentemente da come Python è installato (per-user o system-wide). Non richiede diritti di amministratore.

18. Aggiornare `.vscode/mcp.json` (finale, usabile in qualsiasi workspace):
    ```json
    {
      "servers": {
        "db-catalog": {
          "type": "stdio",
          "command": "db-catalog-mcp"
        }
      }
    }
    ```
    > Nessun path assoluto, nessun `${workspaceFolder}`. Il `.env` rimane nella root di questo progetto e viene trovato tramite `Path(__file__).parent.parent / '.env'`.

---

## Verifica finale

1. `pip install -r requirements.txt` (o `pip install --user -e .`) → nessun errore
2. `python server.py` manuale → si avvia senza crash (rimane in attesa su stdin, atteso)
3. `Ctrl+Shift+P` → **MCP: List Servers** → `db-catalog` → Restart Server
4. In Copilot Agent mode: verificare che `get_artifact_definition` compaia nell'elenco tool (icona martello)
5. Test con una funzione/vista reale del database

---

## Decisioni architetturali

| Decisione | Motivazione |
|---|---|
| **FastMCP** invece dell'API di basso livello | Stessa ergonomia di `McpServer` TypeScript (decorator-based, minimo boilerplate) |
| **psycopg2-binary** invece di psycopg (v3) | Nessuna dipendenza da header C; installabile su Windows con `pip install` puro |
| **python-dotenv** con `Path(__file__).parent` | Path esplicito → risolve correttamente indipendentemente dalla CWD al momento del lancio |
| **No venv imposto** | L'utente ha solo python+pip; venv citato come best practice opzionale nel README |
| **Trasporto HTTP rimosso** | Fuori scope; si usa sempre e solo stdio |
| **Phase 5 opzionale** | Se il server serve solo in questo workspace, basta `python server.py` via `${workspaceFolder}` |
