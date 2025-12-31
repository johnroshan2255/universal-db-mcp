# Universal Database MCP Server

Model Context Protocol server for PostgreSQL and MySQL databases. Enables Claude to query and manage your databases.

## Installation

```bash
npm install -g @johnroshan/universal-db-mcp
```

## Configuration

Edit Claude Desktop config file:

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### PostgreSQL

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@johnroshan/universal-db-mcp"],
      "env": {
        "DB_TYPE": "postgres",
        "DATABASE_URL": "postgresql://user:password@localhost:5432/mydb"
      }
    }
  }
}
```

Or use individual parameters:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@johnroshan/universal-db-mcp"],
      "env": {
        "DB_TYPE": "postgres",
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "mydb",
        "DB_USER": "postgres",
        "DB_PASSWORD": "your_password"
      }
    }
  }
}
```

### MySQL

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@johnroshan/universal-db-mcp"],
      "env": {
        "DB_TYPE": "mysql",
        "DATABASE_URL": "mysql://user:password@localhost:3306/mydb"
      }
    }
  }
}
```

## Available Tools

- `query` - Execute SQL queries
- `list_tables` - List all tables
- `describe_table` - Get table schema
- `list_databases` - List databases
- `table_row_count` - Count rows in table
- `search_table` - Search records with pattern matching

## Usage Examples

After configuration, ask Claude:

- "Show me all tables in my database"
- "What is the schema of the users table"
- "How many rows are in the orders table"
- "Find all users with gmail addresses"
- "Show me the last 10 orders"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DB_TYPE | Yes | postgres or mysql |
| DATABASE_URL | No | Full connection string |
| DB_HOST | No | Database host |
| DB_PORT | No | Database port |
| DB_NAME | No | Database name |
| DB_USER | No | Database user |
| DB_PASSWORD | No | Database password |

Either DATABASE_URL or DB_NAME + DB_USER is required.

## Security

This server runs locally on your machine. Database credentials remain on your device.

Consider creating a read-only database user:

PostgreSQL:
```sql
CREATE USER claude_readonly WITH PASSWORD 'password';
GRANT CONNECT ON DATABASE mydb TO claude_readonly;
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;
```

MySQL:
```sql
CREATE USER 'claude_readonly'@'localhost' IDENTIFIED BY 'password';
GRANT SELECT ON mydb.* TO 'claude_readonly'@'localhost';
FLUSH PRIVILEGES;
```

## Troubleshooting

Connection refused:
- Verify database is running
- Check host and port
- Check firewall settings

Authentication failed:
- Verify credentials
- Check user permissions
- For PostgreSQL check pg_hba.conf

Claude does not see server:
- Restart Claude Desktop
- Check config file syntax
- Check logs at ~/Library/Logs/Claude/mcp*.log

## License

MIT