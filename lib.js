import pg from "pg";
import mysql from "mysql2/promise";

const { Client: PgClient } = pg;

/**
 * Create a database connection
 * @param {Object} config - Database configuration
 * @param {string} config.DB_TYPE - Database type ('postgres' or 'mysql')
 * @param {string} config.DATABASE_URL - Connection URL (optional)
 * @param {string} config.DB_HOST - Database host
 * @param {number} config.DB_PORT - Database port
 * @param {string} config.DB_NAME - Database name
 * @param {string} config.DB_USER - Database user
 * @param {string} config.DB_PASSWORD - Database password
 * @returns {Promise<Object>} Connection object with query and close methods
 */
export async function createConnection(config) {
  const {
    DB_TYPE,
    DATABASE_URL,
    DB_HOST = "localhost",
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
  } = config;

  if (!DB_TYPE) {
    throw new Error("DB_TYPE is required (postgres or mysql)");
  }

  if (!DATABASE_URL && (!DB_NAME || !DB_USER)) {
    throw new Error("Either DATABASE_URL or DB_NAME and DB_USER are required");
  }

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
      dbType: "postgres",
      dbName: DB_NAME,
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
      dbType: "mysql",
      dbName: DB_NAME,
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

/**
 * Execute a SQL query
 * @param {Object} conn - Database connection
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
export async function query(conn, sql, params = []) {
  return await conn.query(sql, params);
}

/**
 * List all tables in the database
 * @param {Object} conn - Database connection
 * @returns {Promise<Array>} List of tables
 */
export async function listTables(conn) {
  if (conn.dbType === "postgres") {
    return await conn.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
  } else {
    return await conn.query(
      `
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = ?
      ORDER BY table_name
    `,
      [conn.dbName]
    );
  }
}

/**
 * Describe table schema
 * @param {Object} conn - Database connection
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} Table schema information
 */
export async function describeTable(conn, tableName) {
  if (conn.dbType === "postgres") {
    return await conn.query(
      `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `,
      [tableName]
    );
  } else {
    return await conn.query(
      `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?
      ORDER BY ordinal_position
    `,
      [conn.dbName, tableName]
    );
  }
}

/**
 * List all databases
 * @param {Object} conn - Database connection
 * @returns {Promise<Array>} List of databases
 */
export async function listDatabases(conn) {
  if (conn.dbType === "postgres") {
    return await conn.query(`
      SELECT datname as database_name
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);
  } else {
    return await conn.query(`SHOW DATABASES`);
  }
}

/**
 * Get row count for a table
 * @param {Object} conn - Database connection
 * @param {string} tableName - Table name
 * @returns {Promise<Object>} Row count
 */
export async function getTableRowCount(conn, tableName) {
  const results = await conn.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  return results[0];
}

/**
 * Search table for matching records
 * @param {Object} conn - Database connection
 * @param {string} tableName - Table name
 * @param {string} columnName - Column to search
 * @param {string} value - Search value
 * @param {number} limit - Maximum results (default: 100)
 * @returns {Promise<Array>} Matching records
 */
export async function searchTable(conn, tableName, columnName, value, limit = 100) {
  if (conn.dbType === "postgres") {
    return await conn.query(
      `SELECT * FROM ${tableName} WHERE ${columnName}::text ILIKE $1 LIMIT $2`,
      [`%${value}%`, limit]
    );
  } else {
    return await conn.query(
      `SELECT * FROM ${tableName} WHERE ${columnName} LIKE ? LIMIT ?`,
      [`%${value}%`, limit]
    );
  }
}