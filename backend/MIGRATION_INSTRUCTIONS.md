# Migration Təlimatları

## Problem
Prisma schema-da `categories` model-i aktivləşdirildi, amma:
1. Migration tətbiq edilməyib (verilənlər bazasında `categories` cədvəli yoxdur)
2. Prisma Client yenidən generate olunmayıb (köhnə schema ilə işləyir)

## Həll

### 1. Migration-i tətbiq edin

**Seçim 1: Neon Dashboard-da**
1. Neon dashboard-a daxil olun
2. SQL Editor-ü açın
3. `backend/migrate.sql` faylının məzmununu kopyalayıb çalışdırın

**Seçim 2: Prisma migrate ilə**
```bash
cd backend
npx prisma migrate dev --name add_categories_and_product_fields
```

**Seçim 3: Python script ilə**
```bash
python backend/run_migration.py
```

### 2. Prisma Client-i yenidən generate edin

**Backend serveri dayandırın** (Ctrl+C), sonra:

```bash
cd backend
npx prisma generate
```

### 3. Backend serveri yenidən başladın

```bash
python start.py
```

## Yoxlama

Migration və Prisma generate tətbiq edildikdən sonra:
- `GET /api/categories` boş array qaytarmalıdır (xəta yoxdur)
- `POST /api/categories` yeni papka yarada bilməlidir
- Papkalar frontend-də görünməlidir

## Qeyd

Migration tətbiq edilməyib və Prisma Client yenidən generate olunmayıbsa:
- Backend xətalar verəcək
- Papkalar yaradılmayacaq
- Frontend-də papkalar görünməyəcək

