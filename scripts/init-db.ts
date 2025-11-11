#!/usr/bin/env tsx
/**
 * Database initialization script
 * Runs database migrations and creates initial data
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function initDatabase() {
  console.log('🚀 Initializing database...\n');

  try {
    // Run Drizzle migrations
    console.log('📦 Running database migrations...');
    const { stdout, stderr } = await execAsync('npm run db:push');
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log('✅ Database initialized successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Access the admin panel at /admin');
    console.log('   2. Login with your ADMIN_PASSWORD');
    console.log('   3. Add students to the whitelist\n');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
