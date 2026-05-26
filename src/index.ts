import 'dotenv/config';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import pg from 'pg';
import { z } from 'zod';

// ── Database connection pool ──────────────────────────────────────────────────

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ── SQL queries ───────────────────────────────────────────────────────────────

const QUERIES = {
  function: `
    SELECT p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS signature,
           pg_get_functiondef(p.oid) AS definition
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = $1
      AND  p.proname = $2
      AND  p.prokind = 'f'`,

  procedure: `
    SELECT p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS signature,
           pg_get_functiondef(p.oid) AS definition
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = $1
      AND  p.proname = $2
      AND  p.prokind = 'p'`,

  view: `
    SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS signature,
           'CREATE OR REPLACE VIEW '
           || quote_ident(n.nspname) || '.' || quote_ident(c.relname)
           || E' AS\n' || pg_get_viewdef(c.oid, true) AS definition
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  n.nspname = $1
      AND  c.relname = $2
      AND  c.relkind = 'v'`,
} as const;

type ArtifactType = keyof typeof QUERIES;

// ── MCP server factory ────────────────────────────────────────────────────────

function buildServer(): McpServer {
  const server = new McpServer({ name: 'db-catalog', version: '1.0.0' });

  server.registerTool(
    'get_artifact_definition',
    {
      description:
        'Returns the SQL DDL source code of a database artifact ' +
        '(function, view, or stored procedure) given its schema, type, and name. ' +
        'Returns the total count of implementations found and, for each one, ' +
        'its full signature and DDL definition. ' +
        'If multiple overloads exist for the same name, all are returned and clearly labeled.',

      inputSchema: z.object({
        schema: z.string().describe('Schema name (e.g. "public")'),
        artifact_type: z
          .enum(['function', 'view', 'procedure'])
          .describe('Type of artifact to retrieve'),
        artifact_name: z.string().describe('Name of the artifact'),
      }),
    },
    async ({ schema, artifact_type, artifact_name }) => {
      try {
        const { rows } = await pool.query<{ signature: string; definition: string }>(
          QUERIES[artifact_type as ArtifactType],
          [schema, artifact_name],
        );

        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No ${artifact_type} named "${artifact_name}" found in schema "${schema}".`,
              },
            ],
          };
        }

        const count = rows.length;
        const header =
          `Found ${count} implementation${count > 1 ? 's' : ''} of ${artifact_type} ` +
          `"${artifact_name}" in schema "${schema}".`;

        const blocks = rows.map(
          (r, i) =>
            `--- Implementation ${i + 1}/${count} ---\n` +
            `Signature: ${r.signature}\n\n` +
            r.definition,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: [header, ...blocks].join('\n\n'),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Database error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transportType = process.env.MCP_TRANSPORT ?? 'stdio';

  if (transportType === 'streamable-http') {
    const port = Number(process.env.MCP_PORT ?? '8000');

    const httpServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        const parsed = body ? (JSON.parse(body) as unknown) : undefined;

        const server = buildServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless — one transport per request
        });

        server
          .connect(transport)
          .then(() => transport.handleRequest(req, res, parsed))
          .then(() => {
            res.on('finish', () => transport.close());
          })
          .catch((err: unknown) => {
            process.stderr.write(
              `Request error: ${err instanceof Error ? err.message : String(err)}\n`,
            );
            if (!res.headersSent) res.writeHead(500).end();
          });
      });
    });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));
    process.stderr.write(`db-catalog MCP server (streamable-http) listening on :${port}\n`);

    const shutdown = (): void => {
      httpServer.close(() => {
        void pool.end().then(() => process.exit(0));
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } else {
    const server = buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    const shutdown = (): void => {
      void pool.end().then(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
