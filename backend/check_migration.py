#!/usr/bin/env python3
"""
Migration-in tətbiq olunub-olunmadığını yoxlamaq üçün script
"""

import os
import sys
import subprocess
from pathlib import Path
import psycopg2
from urllib.parse import urlparse

def check_migration():
    """Migration-in tətbiq olunub-olunmadığını yoxla"""
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
    print("🔍 Migration status yoxlanılır...")
    print("=" * 70)
    print()
    
    try:
        # Database connection
        parsed = urlparse(database_url)
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip('/')
        )
        cur = conn.cursor()
        
        # Categories cədvəlinin olub-olmadığını yoxla
        print("1️⃣ Categories cədvəli yoxlanılır...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'categories'
            );
        """)
        categories_exists = cur.fetchone()[0]
        
        if categories_exists:
            print("   ✅ Categories cədvəli mövcuddur")
            
            # Categories sayını yoxla
            cur.execute("SELECT COUNT(*) FROM categories;")
            count = cur.fetchone()[0]
            print(f"   📊 Categories sayı: {count}")
        else:
            print("   ❌ Categories cədvəli yoxdur - Migration tətbiq edilməyib!")
        
        print()
        
        # Products cədvəlində yeni sütunların olub-olmadığını yoxla
        print("2️⃣ Products cədvəlində yeni sütunlar yoxlanılır...")
        required_columns = [
            'article', 'category_id', 'type', 'brand', 'model', 
            'color', 'size', 'weight', 'country', 'manufacturer',
            'warranty_period', 'min_stock', 'max_stock', 'tax_rate', 'is_active'
        ]
        
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'products';
        """)
        existing_columns = [row[0] for row in cur.fetchall()]
        
        missing_columns = []
        for col in required_columns:
            if col in existing_columns:
                print(f"   ✅ {col} sütunu mövcuddur")
            else:
                print(f"   ❌ {col} sütunu yoxdur")
                missing_columns.append(col)
        
        print()
        
        # Foreign key constraint yoxla
        print("3️⃣ Foreign key constraint yoxlanılır...")
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'products_category_id_fkey'
            );
        """)
        fk_exists = cur.fetchone()[0]
        
        if fk_exists:
            print("   ✅ products_category_id_fkey constraint mövcuddur")
        else:
            print("   ❌ products_category_id_fkey constraint yoxdur")
        
        print()
        
        # Prisma Client yoxla
        print("4️⃣ Prisma Client yoxlanılır...")
        prisma_client_path = backend_dir / "node_modules" / ".prisma" / "client" / "index.d.ts"
        if prisma_client_path.exists():
            # Prisma Client faylını oxu və categories model-inin olub-olmadığını yoxla
            with open(prisma_client_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'categories' in content and 'export type categories' in content:
                    print("   ✅ Prisma Client-də categories model-i mövcuddur")
                else:
                    print("   ⚠️  Prisma Client-də categories model-i yoxdur - yenidən generate edin")
        else:
            print("   ❌ Prisma Client faylı tapılmadı")
        
        cur.close()
        conn.close()
        
        print()
        print("=" * 70)
        
        # Nəticə
        if categories_exists and len(missing_columns) == 0 and fk_exists:
            print("✅ Migration uğurla tətbiq olunub!")
            print()
            print("📝 Növbəti addım:")
            print("   Backend serveri yenidən başladın (Ctrl+C, sonra python start.py)")
            return True
        else:
            print("❌ Migration tam tətbiq olunmayıb!")
            print()
            if not categories_exists:
                print("   • Categories cədvəli yaradılmalıdır")
            if missing_columns:
                print(f"   • {len(missing_columns)} sütun əlavə edilməlidir: {', '.join(missing_columns)}")
            if not fk_exists:
                print("   • Foreign key constraint əlavə edilməlidir")
            print()
            print("📝 Həll:")
            print("   Neon Dashboard-da SQL Editor-də migrate.sql faylını çalışdırın")
            return False
        
    except ImportError:
        print("❌ psycopg2 quraşdırılmamışdır")
        print("   Quraşdırmaq üçün: pip install psycopg2-binary")
        return False
    except Exception as e:
        print(f"❌ Xəta: {e}")
        return False

if __name__ == '__main__':
    success = check_migration()
    sys.exit(0 if success else 1)

