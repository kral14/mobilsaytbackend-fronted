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

## Render Free Plan-da Deploy (tək link, PC=web, telefon=mobil)

**Məntiq:**  
- Render-də **1 dənə Node Web Service** açırıq (backend).  
- Build zamanı həm `web`, həm də `mobil` Vite layihələri build olunur (`web/dist`, `mobil/dist`).  
- Backend (`backend/src/index.ts`) bu build olunmuş faylları static kimi serve edir və **root linkə (/) girəndə cihazın user-agent-inə görə**:
  - PC brauzeridirsə `web` versiyasının `index.html`-ni,
  - Telefon/planşetdirsə `mobil` versiyasının `index.html`-ni göndərir.

### Addım-addım Render konfiqurasiyası

1. **Repo-nu GitHub-a push et** (əgər etməmisənsə).
2. Render hesabına gir, **New → Web Service** seç.
3. Repository kimi bu layihəni seç.
4. **Environment**: `Node`.
5. **Build Command**: 
   ```bash
   npm run build
   ```
6. **Start Command**:
   ```bash
   npm start
   ```
7. **Environment Variables** bölməsində aşağıdakıları əlavə et:
   - `DATABASE_URL` → PostgreSQL / Neon connection string
   - `JWT_SECRET` → güclü random string
   - `NODE_ENV` → `production`
   - (istəsən) `PORT` → Render normalda özü təyin edir, dəyişməsən də olar.
8. **Free plan** seç və servisi yarat.

Deploy bitəndən sonra Render sənə bir URL verəcək, məsələn:  
- `https://mobilsayt.onrender.com`

Bu link:
- **PC-dən girəndə** avtomatik `web` (desktop) versiyanı,
- **telefondan girəndə** avtomatik `mobil` versiyanı açacaq. 

