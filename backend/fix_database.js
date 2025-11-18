#!/usr/bin/env node
/**
 * Database schema fix script
 * This script will push the Prisma schema to the database
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Database schema fix script');
console.log('================================\n');

try {
  console.log('📝 Pushing Prisma schema to database...');
  execSync('npx prisma db push --accept-data-loss', {
    cwd: path.join(__dirname),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NVL31qxTnQrC@ep-wild-queen-adh4tc1u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
    }
  });
  
  console.log('\n✅ Database schema pushed successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npx prisma generate');
  console.log('   2. Restart the backend server');
  
} catch (error) {
  console.error('\n❌ Error pushing schema:', error.message);
  console.error('\n📝 Manual fix:');
  console.error('   1. Open Neon Dashboard');
  console.error('   2. Go to SQL Editor');
  console.error('   3. Run the SQL from backend/migrate.sql');
  console.error('   4. Then run: npx prisma generate');
  process.exit(1);
}

