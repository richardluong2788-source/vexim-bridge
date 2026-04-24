#!/usr/bin/env node

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationFile = process.argv[2] || '003_client_products.sql';

async function runMigration() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Allow self-signed certificates for development
    },
  });

  try {
    console.log('[Migration] Connecting to database...');
    await client.connect();
    console.log('[Migration] ✓ Connected to database');

    // Read SQL file
    const sqlPath = path.join(__dirname, migrationFile);
    console.log(`[Migration] Reading ${sqlPath}...`);
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    // Split into statements (handle PostgreSQL-specific syntax)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`[Migration] Found ${statements.length} SQL statements`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`[Migration] Executing: ${preview}...`);
        
        await client.query(statement);
        successCount++;
        console.log(`[Migration]   ✓ Success`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Skip if table/index already exists
        if (errorMsg.includes('already exists')) {
          skippedCount++;
          console.log(`[Migration]   ⊘ Skipped (already exists)`);
        } else {
          errorCount++;
          console.error(`[Migration]   ✗ Error: ${errorMsg}`);
        }
      }
    }

    console.log('\n[Migration] === Summary ===');
    console.log(`[Migration] Success: ${successCount}`);
    console.log(`[Migration] Skipped: ${skippedCount}`);
    console.log(`[Migration] Errors: ${errorCount}`);

    if (errorCount > 0) {
      process.exit(1);
    }

    console.log('[Migration] ✅ Migration completed successfully!');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Migration] ❌ Fatal error:', errorMsg);
    process.exit(1);
  } finally {
    await client.end();
    console.log('[Migration] Database connection closed');
  }
}

runMigration();
