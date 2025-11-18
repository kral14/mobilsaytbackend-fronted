# GitHub-a Push Etmək Üçün Təlimatlar

## 1. Git Repository-ni Başlatın

PowerShell-də aşağıdakı komandaları işə salın:

```powershell
# Git repository-ni başlat
git init

# Bütün faylları əlavə et
git add .

# Commit edin
git commit -m "Initial commit for Render deployment"

# GitHub repository-sinə bağlayın
git remote add origin https://github.com/kral14/mobilsayt.git

# Main branch-ə push edin
git branch -M main
git push -u origin main
```

## 2. Render Dashboard-da Deploy

`DEPLOY.md` faylında ətraflı təlimatlar var. Qısa versiya:

1. **PostgreSQL Database** yaradın
2. **Backend Web Service** yaradın (Node.js)
3. **Web Static Site** yaradın (PC versiyası)
4. **Mobil Static Site** yaradın (Mobil versiyası)

## 3. Environment Variables

### Backend Service:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Təsadüfi secret key
- `NODE_ENV`: `production`
- `PORT`: `5000`

### Web Frontend:
- `VITE_API_URL`: `https://mobilsayt-backend.onrender.com/api`

### Mobil Frontend:
- `VITE_API_URL`: `https://mobilsayt-backend.onrender.com/api`

## 4. Build Commands

### Backend:
```
cd backend && npm install && npx prisma generate && npm run build
```

### Web Frontend:
```
cd web && npm install && npm run build
```

### Mobil Frontend:
```
cd mobil && npm install && npm run build
```

## 5. Start Commands

### Backend:
```
cd backend && npm start
```

## 6. Publish Directories

### Web Frontend:
```
web/dist
```

### Mobil Frontend:
```
mobil/dist
```

## Qeyd

Render-də deploy olduqdan sonra, backend service-in **Shell** bölməsindən Prisma migration-ları işə salın:

```bash
cd backend
npx prisma db push --accept-data-loss
```

