#!/bin/bash

# Execute SQL migration via psql
# Usage: ./run-sql.sh script.sql

if [ -z "$POSTGRES_URL" ]; then
  echo "❌ POSTGRES_URL environment variable not set"
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: $0 <migration.sql>"
  exit 1
fi

SQL_FILE="$1"

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ File not found: $SQL_FILE"
  exit 1
fi

echo "📝 Running migration: $SQL_FILE"
echo "   Database: $POSTGRES_URL"

# Execute SQL file using psql
psql "$POSTGRES_URL" -f "$SQL_FILE" 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully"
else
  echo "❌ Migration failed"
  exit 1
fi
