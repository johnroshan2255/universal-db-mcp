#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createConnection,
  query,
  listTables,
  describeTable,
  listDatabases,
  getTableRowCount,
  searchTable,
} from "./lib.js";

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
    version: "1.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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
    conn = await createConnection({
      DB_TYPE,
      DATABASE_URL,
      DB_HOST,
      DB_PORT,
      DB_NAME,
      DB_USER,
      DB_PASSWORD,
    });

    if (name === "query") {
      const results = await query(conn, args.sql);
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
      const results = await listTables(conn);
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
      const results = await describeTable(conn, args.table);
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
      const results = await listDatabases(conn);
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
      const result = await getTableRowCount(conn, args.table);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === "search_table") {
      const results = await searchTable(
        conn,
        args.table,
        args.column,
        args.value,
        args.limit
      );
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