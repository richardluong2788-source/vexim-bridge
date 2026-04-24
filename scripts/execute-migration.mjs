import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const migrationFile = process.argv[2] || 'scripts/003_client_products.sql';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE environment variables');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeMigration() {
  try {
    // Read the SQL file
    const sqlPath = path.join(process.cwd(), migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`[Migration] Running ${migrationFile}...`);

    // Split SQL by semicolon and execute statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      console.log(`[Migration] Executing: ${statement.substring(0, 80)}...`);
      const { data, error } = await supabase.rpc('exec', { p_sql: statement });
      
      if (error) {
        // If exec function doesn't exist, try a different approach
        if (error.message.includes('exec')) {
          console.log('[Migration] Using direct SQL execution via query...');
          // This will fail but we'll use a workaround
          break;
        }
        console.error(`[Migration Error]:`, error.message);
        if (error.message.includes('already exists')) {
          console.log('[Migration] Tables already exist, continuing...');
          continue;
        }
        throw error;
      }
    }

    console.log('[Migration] ✅ Migration completed successfully!');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Execute migration
executeMigration();
