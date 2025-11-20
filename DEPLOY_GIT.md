# MobilSayt – Git və Render Deploy Qaydaları

Bu sənəd dəyişiklikləri GitHub reposuna göndərmək və Render-də avtomatik deploy prosesini izah edir.

## 1. İlkin qurulum

```bash
git clone https://github.com/kral14/mobilsaytbackend-fronted.git
cd mobilsaytbackend-fronted
```

Əgər lokaldakı hazır layihəni bu repoya qoşursansa:
```bash
git remote add origin https://github.com/kral14/mobilsaytbackend-fronted.git
```

## 2. Render blueprint faylı

Repoda `render.yaml` saxlanılır. Render “Blueprint Deploy” funksiyası bu faylı oxuyaraq:
- `npm run build` ilə `web`, `mobil` və `backend` build-lərini edir;
- `npm start` ilə backend-i prod rejimində işə salır (`prisma migrate deploy` daxilində);
- `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET` environment dəyişənlərini oxuyur;
- Pulsuz PostgreSQL instansiyası (`mobilsayt-db`) yaradır.

## 3. Dəyişiklikləri göndərmək

```bash
git status                      # dəyişiklikləri yoxla
git add .                       # bütün faylları stage et
git commit -m "Deploy yeniləməsi"
git push origin main            # Render bu push-u izləyəcək
```

## 4. Render-də avtomatik deploy

1. Render dashboard → “New” → “Blueprint” seç.
2. Repo URL: `https://github.com/kral14/mobilsaytbackend-fronted.git`
3. Blueprint tətbiq olunduqdan sonra hər `git push` avtomatik build/deploy trigger edir.
4. Render Secret-lər:
   - `DATABASE_URL` – Render Postgres və ya Neon bağlantısı
   - `JWT_SECRET` – güclü random string

## 5. Deploy yoxlamaları

Deploy bitdikdən sonra:
```bash
curl https://YOUR_RENDER_URL/api/health
```
və ya brauzerdən əsas URL-ə girərək həm desktop, həm mobil interfeysi yoxla.

## 6. Test üçün faydalı komandalar

```bash
# Lokalda build
npm run build

# Lokalda backend-i prod kimi işə salmaq
cd backend
npm run build
npm run start:prod
```

Nəticə olaraq, `render.yaml` + bu Git qaydaları sayəsində tək repo üzərindən həm kod, həm də deploy idarə olunur.

