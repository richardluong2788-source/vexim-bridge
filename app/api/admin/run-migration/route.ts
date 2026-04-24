import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Only allow this in development or with proper auth
const isAllowed = process.env.NODE_ENV === 'development' || 
                 process.env.ALLOW_MIGRATIONS === 'true';

export async function POST(request: NextRequest) {
  try {
    // Security check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.MIGRATION_TOKEN;
    
    if (!isAllowed && (!expectedToken || authHeader !== `Bearer ${expectedToken}`)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { migrationFile = '003_client_products.sql' } = await request.json();

    // Create Supabase admin client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read SQL file from scripts directory
    const sqlPath = path.join(process.cwd(), 'scripts', migrationFile);
    
    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json(
        { error: `Migration file not found: ${migrationFile}` },
        { status: 404 }
      );
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Parse and execute SQL statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    const results = [];
    let hasError = false;

    for (const statement of statements) {
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Some statements might fail due to already existing
          if (error.message.includes('already exists')) {
            results.push({
              statement: statement.substring(0, 100),
              status: 'skipped',
              reason: 'Already exists',
            });
          } else {
            results.push({
              statement: statement.substring(0, 100),
              status: 'error',
              error: error.message,
            });
            hasError = true;
          }
        } else {
          results.push({
            statement: statement.substring(0, 100),
            status: 'success',
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          statement: statement.substring(0, 100),
          status: 'error',
          error: errorMsg,
        });
        hasError = true;
      }
    }

    return NextResponse.json({
      success: !hasError,
      migrationFile,
      totalStatements: statements.length,
      results,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
