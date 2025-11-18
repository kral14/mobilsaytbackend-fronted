#!/usr/bin/env python3
"""
Migration skriptini verilənlər bazasında çalışdırmaq üçün Python script
"""

import os
import sys
import subprocess
from pathlib import Path

def run_migration():
    """Migration SQL skriptini çalışdır"""
    backend_dir = Path(__file__).parent
    
    # .env faylından DATABASE_URL oxu
    env_file = backend_dir / '.env'
    database_url = None
    
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    database_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    
    if not database_url:
        print("❌ DATABASE_URL tapılmadı. .env faylında DATABASE_URL təyin edin.")
        return False
    
    print("🔍 Migration skripti çalışdırılır...")
    print(f"📝 Database URL: {database_url[:20]}...")
    
    # Migration SQL faylını oxu
    migrate_file = backend_dir / 'migrate.sql'
    if not migrate_file.exists():
        print(f"❌ Migration faylı tapılmadı: {migrate_file}")
        return False
    
    with open(migrate_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # psql ilə çalışdır (PostgreSQL client)
    # Neon və ya digər PostgreSQL provider-lar üçün connection string-dən istifadə et
    try:
        # psql istifadə etmək üçün connection string-i parse et
        # Format: postgresql://user:password@host:port/database
        import urllib.parse
        parsed = urllib.parse.urlparse(database_url)
        
        # psql komandası
        cmd = [
            'psql',
            '-h', parsed.hostname or 'localhost',
            '-p', str(parsed.port or 5432),
            '-U', parsed.username or 'postgres',
            '-d', parsed.path.lstrip('/') or 'postgres',
            '-c', sql_content
        ]
        
        # Password environment variable
        env = os.environ.copy()
        if parsed.password:
            env['PGPASSWORD'] = parsed.password
        
        print("🚀 Migration çalışdırılır...")
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Migration uğurla tətbiq olundu!")
            return True
        else:
            print(f"❌ Migration xətası:")
            print(result.stderr)
            return False
            
    except FileNotFoundError:
        print("⚠️  psql tapılmadı. Alternativ üsul istifadə edilir...")
        
        # Prisma migrate istifadə et
        try:
            print("🚀 Prisma migrate çalışdırılır...")
            result = subprocess.run(
                ['npx', 'prisma', 'migrate', 'dev', '--name', 'add_categories_and_product_fields', '--skip-generate'],
                cwd=backend_dir,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print("✅ Migration uğurla tətbiq olundu!")
                print(result.stdout)
                return True
            else:
                print(f"❌ Migration xətası:")
                print(result.stderr)
                return False
        except Exception as e:
            print(f"❌ Xəta: {e}")
            print("\n📝 Manual migration:")
            print("1. Verilənlər bazasına qoşulun (Neon dashboard və ya PostgreSQL client)")
            print("2. backend/migrate.sql faylının məzmununu çalışdırın")
            return False

if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)

