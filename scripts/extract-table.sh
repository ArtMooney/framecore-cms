#!/bin/bash

# Script to extract a specific table from local database
# Usage: ./scripts/extract-table.sh <database-name> <table-name> <output-file>

if [ "$#" -ne 3 ]; then
    echo "Usage: ./scripts/extract-table.sh <database-name> <table-name> <output-file>"
    echo "Example: ./scripts/extract-table.sh database users users-export.sql"
    exit 1
fi

DATABASE_NAME=$1
TABLE_NAME=$2
OUTPUT_FILE=$3

echo "Exporting table '${TABLE_NAME}' from database '${DATABASE_NAME}' to '${OUTPUT_FILE}'..."

# Export entire database to temporary file
wrangler d1 export ${DATABASE_NAME} --local --output=.temp-export.sql

# Extract only INSERT statements for specific table (data only, no schema)
grep "INSERT INTO \"${TABLE_NAME}\"" .temp-export.sql > "${OUTPUT_FILE}"

# Remove temporary file
rm .temp-export.sql

if [ -f "${OUTPUT_FILE}" ]; then
    echo "✅ Done! Table saved in ${OUTPUT_FILE}"
else
    echo "❌ Something went wrong, file was not created"
    exit 1
fi
