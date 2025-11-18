# Fix Database 500 Error

## Problem
You're getting 500 Internal Server Error when accessing:
- `GET /api/customers`
- `GET /api/customer-folders`

This usually means the database tables don't exist.

## Solution

### Option 1: Use Prisma DB Push (Recommended)

1. **Stop the backend server** (Ctrl+C)

2. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

3. **Push the schema to database**:
   ```bash
   npx prisma db push
   ```

4. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

5. **Restart the backend server**

### Option 2: Run SQL Script in Neon Dashboard

1. **Open Neon Dashboard** and go to SQL Editor

2. **Copy and paste** the contents of `backend/create_all_tables.sql`

3. **Run the SQL script**

4. **Generate Prisma Client**:
   ```bash
   cd backend
   npx prisma generate
   ```

5. **Restart the backend server**

### Option 3: Use the Fix Script

1. **Stop the backend server** (Ctrl+C)

2. **Run the fix script**:
   ```bash
   cd backend
   node fix_database.js
   ```

3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

4. **Restart the backend server**

## Verification

After running the fix, check:
- `GET /api/customers` should return an empty array `[]` (not a 500 error)
- `GET /api/customer-folders` should return an empty array `[]` (not a 500 error)

## Common Issues

- **"Table does not exist"**: Run one of the solutions above
- **"Prisma Client out of sync"**: Run `npx prisma generate`
- **"Connection error"**: Check your DATABASE_URL environment variable

