# MobilSayt

MobilSayt - Müştəri, məhsul və qaimə idarəetmə sistemi

## Struktur

- `backend/` - Node.js/Express backend API
- `web/` - PC versiyası (React + Vite)
- `mobil/` - Mobil versiyası (React + Vite)
- `shared/` - Paylaşılan TypeScript tipləri

## Lokal İnkişaf

### Tələblər
- Node.js 18+
- PostgreSQL (və ya Neon Database)
- npm və ya yarn

### Quraşdırma

1. Repository-ni klonlayın:
```bash
git clone https://github.com/kral14/mobilsayt.git
cd mobilsayt
```

2. Backend-i quraşdırın:
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

3. Frontend-ləri quraşdırın:
```bash
# Web frontend
cd ../web
npm install

# Mobil frontend
cd ../mobil
npm install
```

4. Environment variables təyin edin:
```bash
# backend/.env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
PORT=5000
NODE_ENV=development
```

5. Serverləri işə salın:
```bash
# Root dizindən
python start.py
```

Və ya ayrı-ayrı:
```bash
# Backend
cd backend
npm run dev

# Web frontend (port 3000)
cd web
npm run dev

# Mobil frontend (port 3001)
cd mobil
npm run dev
```

## Render-də Deploy

### 1. GitHub Repository-sinə Push Edin

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/kral14/mobilsayt.git
git push -u origin main
```

### 2. Render Dashboard-da Service-lər Yaradın

#### Backend Service:
1. Render dashboard-da "New +" → "Web Service" seçin
2. GitHub repository-ni bağlayın
3. Aşağıdakı konfiqurasiyanı təyin edin:
   - **Name**: `mobilsayt-backend`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install && npx prisma generate && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Free

4. Environment Variables əlavə edin:
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: JWT secret key
   - `NODE_ENV`: `production`
   - `PORT`: `5000` (Render avtomatik təyin edir, amma təyin edə bilərsiniz)

#### Web Frontend Service:
1. "New +" → "Static Site" seçin
2. GitHub repository-ni bağlayın
3. Konfiqurasiya:
   - **Name**: `mobilsayt-web`
   - **Build Command**: `cd web && npm install && npm run build`
   - **Publish Directory**: `web/dist`

4. Environment Variables (əgər lazımdırsa):
   - `VITE_API_URL`: Backend URL (məsələn: `https://mobilsayt-backend.onrender.com`)

#### Mobil Frontend Service:
1. "New +" → "Static Site" seçin
2. GitHub repository-ni bağlayın
3. Konfiqurasiya:
   - **Name**: `mobilsayt-mobil`
   - **Build Command**: `cd mobil && npm install && npm run build`
   - **Publish Directory**: `mobil/dist`

4. Environment Variables (əgər lazımdırsa):
   - `VITE_API_URL`: Backend URL

### 3. Database

Render-də PostgreSQL database yaradın:
1. "New +" → "PostgreSQL" seçin
2. Database yaradın və `DATABASE_URL`-i backend service-ə əlavə edin

### 4. Prisma Migration

Backend deploy olduqdan sonra, Prisma migration-ları işə salın:
1. Render dashboard-da backend service-ə daxil olun
2. "Shell" bölməsinə keçin
3. Aşağıdakı komandaları işə salın:
```bash
cd backend
npx prisma db push
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/register` - Qeydiyyat
- `POST /api/auth/login` - Giriş
- `GET /api/customers` - Müştəriləri gətir
- `GET /api/customer-folders` - Papkaları gətir
- və s.

## Texnologiyalar

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: React, TypeScript, Vite, React Router, Zustand, Axios
- **Database**: PostgreSQL (Neon)

## Lisenziya

MIT

