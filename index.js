#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";
import mysql from "mysql2/promise";

const { Client: PgClient } = pg;

const DB_TYPE = process.env.DB_TYPE;
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT;
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DB_TYPE) {
  console.error("Error: DB_TYPE environment variable required (postgres or mysql)");
  process.exit(1);
}

if (!DATABASE_URL && (!DB_NAME || !DB_USER)) {
  console.error("Error: Either DATABASE_URL or DB_NAME, DB_USER required");
  process.exit(1);
}

const server = new Server(
  {
    name: "universal-db-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

async function getConnection() {
  if (DB_TYPE === "postgres") {
    const client = new PgClient(
      DATABASE_URL || {
        host: DB_HOST,
        port: DB_PORT || 5432,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
      }
    );
    await client.connect();
    return {
      client,
      async query(sql, params = []) {
        const result = await client.query(sql, params);
        return result.rows;
      },
      async close() {
        await client.end();
      },
    };
  } else if (DB_TYPE === "mysql") {
    const connection = await mysql.createConnection(
      DATABASE_URL || {
        host: DB_HOST,
        port: DB_PORT || 3306,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
      }
    );
    return {
      client: connection,
      async query(sql, params = []) {
        const [rows] = await connection.execute(sql, params);
        return rows;
      },
      async close() {
        await connection.end();
      },
    };
  } else {
    throw new Error(`Unsupported database type: ${DB_TYPE}`);
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Execute a SQL query on the database. Returns results as JSON.",
        inputSchema: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description: "SQL query to execute",
            },
          },
          required: ["sql"],
        },
      },
      {
        name: "list_tables",
        description: "List all tables in the current database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "describe_table",
        description: "Get detailed schema information for a specific table",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "Name of the table to describe",
            },
          },
          required: ["table"],
        },
      },
      {
        name: "list_databases",
        description: "List all available databases on the server",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "table_row_count",
        description: "Get the number of rows in a table",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "Table name",
            },
          },
          required: ["table"],
        },
      },
      {
        name: "search_table",
        description: "Search for records in a table matching a condition",
        inputSchema: {
          type: "object",
          properties: {
            table: {
              type: "string",
              description: "Table name",
            },
            column: {
              type: "string",
              description: "Column to search in",
            },
            value: {
              type: "string",
              description: "Value to search for",
            },
            limit: {
              type: "number",
              description: "Maximum number of results",
            },
          },
          required: ["table", "column", "value"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let conn;

  try {
    conn = await getConnection();

    if (name === "query") {
      const results = await conn.query(args.sql);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                rowCount: results.length,
                rows: results,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "list_tables") {
      let results;
      if (DB_TYPE === "postgres") {
        results = await conn.query(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
      } else {
        results = await conn.query(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = ?
          ORDER BY table_name
        `, [DB_NAME]);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }

    if (name === "describe_table") {
      let results;
      if (DB_TYPE === "postgres") {
        results = await conn.query(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [args.table]);
      } else {
        results = await conn.query(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = ? AND table_name = ?
          ORDER BY ordinal_position
        `, [DB_NAME, args.table]);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }

    if (name === "list_databases") {
      let results;
      if (DB_TYPE === "postgres") {
        results = await conn.query(`
          SELECT datname as database_name
          FROM pg_database
          WHERE datistemplate = false
          ORDER BY datname
        `);
      } else {
        results = await conn.query(`SHOW DATABASES`);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }

    if (name === "table_row_count") {
      const results = await conn.query(
        `SELECT COUNT(*) as count FROM ${args.table}`
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results[0], null, 2),
          },
        ],
      };
    }

    if (name === "search_table") {
      const limit = args.limit || 100;
      let results;
      
      if (DB_TYPE === "postgres") {
        results = await conn.query(
          `SELECT * FROM ${args.table} WHERE ${args.column}::text ILIKE $1 LIMIT $2`,
          [`%${args.value}%`, limit]
        );
      } else {
        results = await conn.query(
          `SELECT * FROM ${args.table} WHERE ${args.column} LIKE ? LIMIT ?`,
          [`%${args.value}%`, limit]
        );
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                matchCount: results.length,
                results: results,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  } finally {
    if (conn) {
      await conn.close();
    }
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Universal Database MCP Server running (${DB_TYPE})`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});