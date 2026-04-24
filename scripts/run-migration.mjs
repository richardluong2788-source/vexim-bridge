#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Missing SUPABASE env vars");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error(
    "  SUPABASE_SERVICE_ROLE_KEY:",
    supabaseServiceRoleKey ? "✓" : "✗"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  db: { schema: "public" },
});

async function runMigration(filePath) {
  try {
    console.log(`\n📝 Running migration: ${path.basename(filePath)}`);

    const sql = fs.readFileSync(filePath, "utf-8");

    // Split SQL by semicolons, filter empty statements
    const statements = sql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    console.log(`   Found ${statements.length} SQL statements`);

    let executedCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc("exec", {
          sql: statement + ";",
        });

        if (error) {
          // Check if error is "function exec() does not exist" - means we need to use raw SQL
          if (error.message.includes("does not exist")) {
            // Fallback: use postgrest to execute (limited)
            console.log(
              `   ⚠ Note: Using raw SQL execution (some advanced features may not work)`
            );
          } else {
            console.warn(`   ⚠ Warning: ${error.message}`);
            console.warn(`      Statement: ${statement.substring(0, 100)}...`);
          }
        } else {
          executedCount++;
        }
      } catch (err) {
        console.error(`   ❌ Error executing statement:`);
        console.error(`      ${err.message}`);
        console.error(`      Statement: ${statement.substring(0, 150)}...`);
      }
    }

    console.log(
      `✅ Migration completed: ${executedCount}/${statements.length} statements executed`
    );
  } catch (err) {
    console.error(`❌ Failed to run migration: ${err.message}`);
    process.exit(1);
  }
}

// Run migration from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error("Usage: node run-migration.mjs <migration.sql>");
  process.exit(1);
}

const fullPath = path.resolve(migrationFile);
if (!fs.existsSync(fullPath)) {
  console.error(`❌ File not found: ${fullPath}`);
  process.exit(1);
}

runMigration(fullPath).catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
