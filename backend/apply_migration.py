#!/usr/bin/env python3
"""
Migration skriptini tətbiq etmək üçün Python script
Neon və ya digər PostgreSQL provider-lar üçün
"""

import os
import sys
import subprocess
from pathlib import Path

def apply_migration():
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
    
    print("=" * 70)
    print("🔧 Migration tətbiq edilir...")
    print("=" * 70)
    print(f"📝 Database URL: {database_url[:30]}...")
    print()
    
    # Migration SQL faylını oxu
    migrate_file = backend_dir / 'migrate.sql'
    if not migrate_file.exists():
        print(f"❌ Migration faylı tapılmadı: {migrate_file}")
        return False
    
    with open(migrate_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("📋 Migration SQL:")
    print("-" * 70)
    print(sql_content[:500] + "..." if len(sql_content) > 500 else sql_content)
    print("-" * 70)
    print()
    
    # Prisma migrate istifadə et
    try:
        print("🚀 Prisma migrate çalışdırılır...")
        print("⚠️  Qeyd: Bu komanda migration-i tətbiq edəcək və Prisma Client-i yenidən generate edəcək")
        print()
        
        result = subprocess.run(
            ['npx', 'prisma', 'migrate', 'dev', '--name', 'add_categories_and_product_fields', '--create-only'],
            cwd=backend_dir,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ Migration faylı yaradıldı!")
            print(result.stdout)
            
            # İndi migration-i tətbiq et
            print()
            print("🚀 Migration tətbiq edilir...")
            result2 = subprocess.run(
                ['npx', 'prisma', 'migrate', 'deploy'],
                cwd=backend_dir,
                capture_output=True,
                text=True
            )
            
            if result2.returncode == 0:
                print("✅ Migration tətbiq olundu!")
                print(result2.stdout)
                
                # Prisma Client-i yenidən generate et
                print()
                print("🚀 Prisma Client yenidən generate edilir...")
                result3 = subprocess.run(
                    ['npx', 'prisma', 'generate'],
                    cwd=backend_dir,
                    capture_output=True,
                    text=True
                )
                
                if result3.returncode == 0:
                    print("✅ Prisma Client yenidən generate edildi!")
                    print(result3.stdout)
                    return True
                else:
                    print(f"❌ Prisma Client generate xətası:")
                    print(result3.stderr)
                    return False
            else:
                print(f"❌ Migration tətbiq xətası:")
                print(result2.stderr)
                print()
                print("💡 Alternativ: Neon Dashboard-da SQL Editor-də migrate.sql faylını çalışdırın")
                return False
        else:
            print(f"❌ Migration faylı yaradıla bilmədi:")
            print(result.stderr)
            print()
            print("💡 Alternativ: Neon Dashboard-da SQL Editor-də migrate.sql faylını çalışdırın")
            return False
            
    except Exception as e:
        print(f"❌ Xəta: {e}")
        print()
        print("📝 Manual migration:")
        print("1. Neon Dashboard-a daxil olun")
        print("2. SQL Editor-ü açın")
        print(f"3. {migrate_file} faylının məzmununu kopyalayıb çalışdırın")
        print("4. Sonra: cd backend && npx prisma generate")
        return False

if __name__ == '__main__':
    success = apply_migration()
    sys.exit(0 if success else 1)

