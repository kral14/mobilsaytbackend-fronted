# Render-də Deploy Etmək - Addım-Addım Təlimat

## 1. GitHub Repository-sinə Push Edin

```bash
# Git repository-ni başlatın (əgər yoxdursa)
git init

# Bütün faylları əlavə edin
git add .

# Commit edin
git commit -m "Deploy: Mobil və PC versiyası ilə device detection"

# GitHub repository-sinə push edin
git remote add origin https://github.com/kral14/mobilsayt.git
git branch -M main
git push -u origin main
```

**Qeyd**: Əgər repository artıq mövcuddursa:
```bash
git add .
git commit -m "Deploy: Mobil və PC versiyası ilə device detection"
git push
```

## 2. Render Dashboard-da Service-lər Yaradın

### A. Backend Service Yaradın

1. **Render Dashboard-a daxil olun**: https://dashboard.render.com/
2. **"New +"** düyməsinə basın → **"Web Service"** seçin
3. **GitHub repository-ni bağlayın**:
   - `kral14/mobilsayt` repository-sini seçin
   - **"Connect"** düyməsinə basın
4. **Konfiqurasiya**:
   - **Name**: `mobilsayt-backend`
   - **Environment**: `Node`
   - **Region**: İstədiyiniz region (məsələn: Frankfurt)
   - **Branch**: `main`
   - **Root Directory**: (boş buraxın)
   - **Build Command**: `cd backend && npm install --include=dev && npx prisma generate && npm run build`
   - **Start Command**: `cd backend && npm run start:prod`
   - **Plan**: Free
5. **Advanced** bölməsinə keçin:
   - **Health Check Path**: `/api/health`
6. **Environment Variables** əlavə edin:
   - **Key**: `DATABASE_URL`
     - **Value**: Neon database URL (məsələn: `postgresql://neondb_owner:npg_NVL31qxTnQrC@ep-wild-queen-adh4tc1u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`)
   - **Key**: `JWT_SECRET`
     - **Value**: Təsadüfi string (məsələn: `7ef0d06a5ef89aab6cf50d149f4afb5a953beb6fd711d3b0a8547c442e7a6c3c`)
   - **Key**: `NODE_ENV`
     - **Value**: `production`
   - **Key**: `PORT`
     - **Value**: `5000` (vacib deyil, Render avtomatik təyin edir)
7. **"Create Web Service"** düyməsinə basın
8. Backend deploy olana qədər gözləyin (5-10 dəqiqə)

### B. Frontend Service Yaradın (Device Detection ilə)

1. **Render Dashboard-da "New +"** düyməsinə basın → **"Static Site"** seçin
2. **GitHub repository-ni bağlayın**:
   - `kral14/mobilsayt` repository-sini seçin
   - **"Connect"** düyməsinə basın
3. **Konfiqurasiya**:
   - **Name**: `mobilsayt-frontend`
   - **Branch**: `main`
   - **Root Directory**: (boş buraxın)
   - **Build Command**: 
     ```bash
     cd mobil && npm install && npm run build && cd ../web && npm install && npm run build && cd .. && mkdir -p public && cp -r mobil/dist public/mobil && cp -r web/dist public/web && cat > public/index.html << 'EOF'
     <!DOCTYPE html>
     <html lang="az">
       <head>
         <meta charset="UTF-8" />
         <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
         <meta name="viewport" content="width=device-width, initial-scale=1.0" />
         <title>MobilSayt - Alış-Satış Platforması</title>
         <script>
           (function() {
             const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768 && window.innerHeight <= 1024);
             const urlParams = new URLSearchParams(window.location.search);
             const version = urlParams.get('v');
             const path = window.location.pathname;
             const isMobilePath = path.startsWith('/mobil');
             const isWebPath = path.startsWith('/web');
             if (isMobilePath) {
               window.location.href = '/mobil' + path.replace('/mobil', '') + window.location.search + window.location.hash;
             } else if (isWebPath) {
               window.location.href = '/web' + path.replace('/web', '') + window.location.search + window.location.hash;
             } else if (version === 'mobile' || version === 'mobil') {
               window.location.href = '/mobil' + path + window.location.search.replace(/[?&]v=(mobile|mobil)/, '') + window.location.hash;
             } else if (version === 'pc' || version === 'desktop') {
               window.location.href = '/web' + path + window.location.search.replace(/[?&]v=(pc|desktop)/, '') + window.location.hash;
             } else if (isMobile) {
               window.location.href = '/mobil' + path + window.location.search + window.location.hash;
             } else {
               window.location.href = '/web' + path + window.location.search + window.location.hash;
             }
           })();
         </script>
       </head>
       <body>
         <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
           <div style="text-align: center;">
             <h1>Yönləndirilir...</h1>
             <p>Zəhmət olmasa gözləyin</p>
           </div>
         </div>
       </body>
     </html>
     EOF
     ```
   - **Publish Directory**: `public`
4. **Environment Variables** əlavə edin:
   - **Key**: `VITE_API_URL`
     - **Value**: `https://mobilsayt-backend.onrender.com/api`
     - **Qeyd**: Backend service-in adı fərqli ola bilər, Render dashboard-da backend service-in URL-ini yoxlayın
5. **"Create Static Site"** düyməsinə basın
6. Deploy olana qədər gözləyin (5-10 dəqiqə)

## 3. Environment Variables-i Düzgün Təyin Edin

### Backend Service:
- `DATABASE_URL`: Neon database connection string
- `JWT_SECRET`: Təsadüfi secret key
- `NODE_ENV`: `production`
- `PORT`: `5000`

### Frontend Service:
- `VITE_API_URL`: Backend service-in URL-i + `/api` (məsələn: `https://mobilsayt-backend.onrender.com/api`)

**Qeyd**: Frontend build zamanı `VITE_API_URL` environment variable-ı istifadə olunur. Build-dən sonra dəyişdirmək mümkün deyil, yenidən build etmək lazımdır.

## 4. Deploy-dan Sonra Yoxlayın

1. **Backend URL**: `https://mobilsayt-backend.onrender.com/api/health` - bu URL-də `{"status":"OK"}` cavabı almalısınız
2. **Frontend URL**: `https://mobilsayt-frontend.onrender.com` - bu URL-də device detection işləməlidir:
   - **PC-də**: `/web` versiyasına yönləndirir
   - **Mobil-də**: `/mobil` versiyasına yönləndirir
   - **Manual seçim**: `?v=mobile` və ya `?v=pc` parametri ilə versiya seçilə bilər

## 5. Problemlər və Həllər

### Problem: Build xətası
**Həll**: Build log-larını yoxlayın və environment variables-in düzgün təyin olunduğunu yoxlayın.

### Problem: Frontend backend-ə qoşula bilmir
**Həll**: `VITE_API_URL` environment variable-ının düzgün təyin olunduğunu yoxlayın və backend service-in işlədiyini təsdiq edin.

### Problem: Device detection işləmir
**Həll**: Browser console-da JavaScript xətalarını yoxlayın və `public/index.html` faylının düzgün yaradıldığını yoxlayın.

### Problem: Protected route-lara giriş olmur
**Həll**: Login və register route-larının açıq olduğunu və backend-də auth middleware-in düzgün işlədiyini yoxlayın.

## 6. render.yaml İstifadəsi (Alternativ)

Əgər `render.yaml` faylını istifadə etmək istəyirsinizsə:

1. Render dashboard-da **"New +"** → **"Blueprint"** seçin
2. GitHub repository-ni bağlayın
3. `render.yaml` faylını seçin
4. Render avtomatik olaraq bütün service-ləri yaradacaq

**Qeyd**: `render.yaml` faylında environment variables təyin edilməyib, onları manual olaraq Render dashboard-dan təyin etməlisiniz.

