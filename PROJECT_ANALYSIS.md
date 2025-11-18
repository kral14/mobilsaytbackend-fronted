# MobilSayt Proyekti - Tam Təhlil

## 📋 Ümumi Məlumat

**Proyekt adı:** MobilSayt  
**Tip:** Full-stack alış-satış platforması  
**Texnologiyalar:** 
- Backend: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (Neon)
- Frontend: React, TypeScript, Vite, Zustand, React Router
- Development: Python script (start.py) - backend və frontend-i eyni zamanda işə salır

---

## 🏗️ Proyekt Strukturu

### Backend (`/backend`)
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL (Neon cloud)
- **Port:** 5000
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt

#### Əsas Komponentlər:
1. **Controllers** (`/src/controllers/`)
   - `authController.ts` - İstifadəçi autentifikasiyası
   - `productController.ts` - Məhsul idarəetməsi
   - `orderController.ts` - Sifariş/satış fakturaları
   - `categoryController.ts` - Kateqoriya idarəetməsi
   - `customerController.ts` - Müştəri idarəetməsi
   - `supplierController.ts` - Təchizatçı idarəetməsi
   - `purchaseInvoiceController.ts` - Alış fakturaları
   - `userController.ts` - İstifadəçi profili

2. **Routes** (`/src/routes/`)
   - Bütün API endpoint-ləri route fayllarında təyin olunub
   - `authMiddleware` ilə qorunur

3. **Middleware** (`/src/middleware/`)
   - `auth.ts` - JWT token yoxlaması

4. **Database Schema** (`/prisma/schema.prisma`)
   - 10 əsas model:
     - `users` - İstifadəçilər
     - `customers` - Müştərilər (alıcılar)
     - `suppliers` - Təchizatçılar (satıcılar)
     - `products` - Məhsullar
     - `categories` - Kateqoriyalar (hierarxik)
     - `warehouse` - Anbar qalıqları
     - `sale_invoices` - Satış fakturaları
     - `sale_invoice_items` - Satış faktura maddələri
     - `purchase_invoices` - Alış fakturaları
     - `purchase_invoice_items` - Alış faktura maddələri
     - `password_reset_tokens` - Şifrə sıfırlama tokenləri

### Frontend (`/web`)
- **Framework:** React 18
- **Build Tool:** Vite
- **State Management:** Zustand
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **Port:** 3000

#### Əsas Komponentlər:
1. **Pages** (`/src/pages/`)
   - `Home.tsx` - Ana səhifə
   - `Login.tsx` / `Register.tsx` - Autentifikasiya
   - `Products.tsx` - Məhsul siyahısı
   - `Anbar.tsx` - Anbar idarəetməsi
   - `Hesablar.tsx` - Hesablar
   - `Qaimeler/Alis.tsx` - Alış qaimələri
   - `Qaimeler/Satis.tsx` - Satış qaimələri (3906 sətir - çox böyük!)
   - `Kassa/Medaxil.tsx` - Kassa medaxil
   - `Kassa/Mexaric.tsx` - Kassa mexaric
   - `Musteriler/Alici.tsx` - Alıcılar
   - `Musteriler/Satici.tsx` - Satıcılar
   - `Profile.tsx` - İstifadəçi profili

2. **Components** (`/src/components/`)
   - `Layout.tsx` - Əsas layout (nav, taskbar)
   - `DataTable.tsx` - Cədvəl komponenti
   - `ProtectedRoute.tsx` - Qorunan route komponenti

3. **Store** (`/src/store/`)
   - `authStore.ts` - Autentifikasiya state
   - `windowStore.ts` - Pəncərə/modal state idarəetməsi

4. **Services** (`/src/services/`)
   - `api.ts` - API funksiyaları (auth, products, orders, və s.)

### Shared Types (`/shared/types/`)
- Ortaq TypeScript tipləri (backend və frontend üçün)
- `index.ts` - Bütün interface-lər

---

## 🔑 Əsas Funksionallıq

### 1. Autentifikasiya
- Qeydiyyat və giriş
- JWT token əsaslı autentifikasiya
- İstifadəçi profili idarəetməsi
- Müştəri ilə istifadəçi əlaqəsi

### 2. Məhsul İdarəetməsi
- Məhsul yaratma, redaktə, silmə
- Kateqoriya sistemi (hierarxik)
- Anbar qalığı izləməsi
- Məhsul axtarışı və filtrləmə
- Geniş məhsul məlumatları (barcode, kod, marka, model, rəng, ölçü, və s.)

### 3. Satış Qaimələri (Sale Invoices)
- Satış fakturaları yaratma
- Müştəri seçimi
- Məhsul əlavə etmə
- Anbar qalığının avtomatik azalması
- Status idarəetməsi (`is_active`)
- Ödəniş tarixi izləməsi

### 4. Alış Qaimələri (Purchase Invoices)
- Alış fakturaları yaratma
- Təchizatçı seçimi
- Məhsul əlavə etmə
- Status idarəetməsi

### 5. Anbar İdarəetməsi
- Məhsul qalıqlarının izlənməsi
- Satış zamanı avtomatik azalma
- Minimum/maksimum ehtiyat hədləri

### 6. Müştəri/Təchizatçı İdarəetməsi
- Alıcılar (customers)
- Satıcılar (suppliers)
- Balans izləməsi
- Əlaqə məlumatları

### 7. Kassa
- Medaxil (gəlir)
- Mexaric (xərc)

---

## 🚀 Development Workflow

### `start.py` Script
Bu Python script proyektin əsas development tool-u:
- ✅ Backend və frontend-i eyni zamanda işə salır
- ✅ Prisma schema dəyişikliklərini izləyir (file watcher)
- ✅ Schema dəyişikliyi zamanı avtomatik:
  - Backend-i dayandırır
  - Prisma Client generate edir
  - Database schema-nı sinxronizasiya edir (`db push`)
  - Backend-i yenidən başladır
- ✅ Port-ları yoxlayır və köhnə prosesləri dayandırır
- ✅ Rəngli konsol çıxışı
- ✅ Windows və Linux/Mac dəstəyi

### İşə salma:
```bash
python start.py
```

---

## 📊 Database Strukturu

### Əsas Cədvəllər:

1. **users** - İstifadəçilər
   - email, password, created_at

2. **customers** - Müştərilər (alıcılar)
   - name, phone, email, address, balance

3. **suppliers** - Təchizatçılar (satıcılar)
   - name, phone, email, address, balance

4. **products** - Məhsullar
   - Əsas: name, barcode, description, unit, purchase_price, sale_price
   - Əlavə: code, article, category_id, type, brand, model, color, size, weight, country, manufacturer, warranty_period, production_date, expiry_date, min_stock, max_stock, tax_rate, is_active

5. **categories** - Kateqoriyalar
   - Hierarxik struktura (parent_id)

6. **warehouse** - Anbar
   - product_id, quantity

7. **sale_invoices** - Satış fakturaları
   - invoice_number, customer_id, total_amount, invoice_date, payment_date, notes, is_active

8. **sale_invoice_items** - Satış faktura maddələri
   - invoice_id, product_id, quantity, unit_price, total_price

9. **purchase_invoices** - Alış fakturaları
   - invoice_number, supplier_id, total_amount, invoice_date, notes, is_active

10. **purchase_invoice_items** - Alış faktura maddələri
    - invoice_id, product_id, quantity, unit_price, total_price

---

## 🔐 Təhlükəsizlik

### Backend:
- ✅ JWT token autentifikasiyası
- ✅ bcrypt ilə şifrə hash-ləmə
- ✅ CORS konfiqurasiyası
- ✅ Environment variables (DATABASE_URL, JWT_SECRET)
- ⚠️ JWT_SECRET production-da dəyişdirilməlidir

### Frontend:
- ✅ Token localStorage-da saxlanılır
- ✅ Protected routes
- ✅ Axios interceptor ilə token əlavə edilməsi

---

## 🎨 UI/UX Xüsusiyyətləri

1. **Windows-like Interface:**
   - Taskbar (aşağıda açıq səhifələr)
   - Modal pəncərələr
   - Z-index idarəetməsi
   - Pəncərə aktivləşdirmə

2. **Navigation:**
   - Dropdown menyular (Qaimələr, Kassa, Müştərilər)
   - Breadcrumb-style navigation
   - Route tracking

3. **State Management:**
   - Zustand ilə global state
   - localStorage persistence
   - Window/modal state idarəetməsi

---

## ⚠️ Potensial Problemlər və Təkliflər

### 1. **Kod Keyfiyyəti:**
   - ⚠️ `Satis.tsx` çox böyükdür (3906 sətir) - refactor edilməlidir
   - ⚠️ Bəzi controller-lərdə çoxlu console.log debug mesajları
   - ✅ TypeScript istifadə olunur (yaxşı)

### 2. **Database:**
   - ⚠️ `productController.ts`-də column existence check-ləri var - bu Prisma schema ilə həll edilməlidir
   - ✅ Prisma ORM istifadə olunur (yaxşı)
   - ⚠️ Database URL hardcoded `start.py`-də - environment variable olmalıdır

### 3. **Error Handling:**
   - ✅ Global error handler var
   - ✅ Try-catch blokları istifadə olunur
   - ⚠️ Bəzi yerlərdə error mesajları azdır

### 4. **Performance:**
   - ⚠️ Bəzi query-lərdə N+1 problem ola bilər (include istifadəsi yaxşıdır)
   - ✅ Pagination yoxdur - böyük siyahılarda problem ola bilər

### 5. **Təhlükəsizlik:**
   - ⚠️ JWT_SECRET default dəyəri var
   - ⚠️ Database URL hardcoded
   - ✅ Password hashing istifadə olunur

### 6. **Code Organization:**
   - ✅ Layihələndirmə yaxşıdır (MVC pattern)
   - ⚠️ Bəzi fayllar çox böyükdür (refactor lazımdır)
   - ✅ Shared types mövcuddur

---

## 📝 API Endpoints

### Auth
- `POST /api/auth/register` - Qeydiyyat
- `POST /api/auth/login` - Giriş

### Products
- `GET /api/products` - Bütün məhsullar
- `GET /api/products/:id` - Məhsul detalları
- `POST /api/products` - Yeni məhsul
- `PUT /api/products/:id` - Məhsul yenilə
- `DELETE /api/products/:id` - Məhsul sil

### Orders (Sale Invoices)
- `GET /api/orders` - Bütün sifarişlər
- `GET /api/orders/:id` - Sifariş detalları
- `POST /api/orders` - Yeni sifariş
- `PUT /api/orders/:id` - Sifariş yenilə
- `PATCH /api/orders/:id/status` - Status yenilə

### Categories
- `GET /api/categories` - Bütün kateqoriyalar
- `POST /api/categories` - Yeni kateqoriya
- `PUT /api/categories/:id` - Kateqoriya yenilə
- `DELETE /api/categories/:id` - Kateqoriya sil

### Customers
- `GET /api/customers` - Bütün müştərilər

### Suppliers
- `GET /api/suppliers` - Bütün təchizatçılar

### Purchase Invoices
- `GET /api/purchase-invoices` - Bütün alış fakturaları
- `GET /api/purchase-invoices/:id` - Alış fakturası detalları
- `POST /api/purchase-invoices` - Yeni alış fakturası
- `PATCH /api/purchase-invoices/:id` - Alış fakturası yenilə
- `PATCH /api/purchase-invoices/:id/status` - Status yenilə
- `DELETE /api/purchase-invoices/:id` - Alış fakturası sil

### Users
- `GET /api/users/profile` - İstifadəçi profili
- `PUT /api/users/profile` - Profil yenilə

---

## 🛠️ Texniki Detallar

### Backend Dependencies:
- express - Web framework
- @prisma/client - Prisma ORM client
- prisma - Prisma CLI
- bcrypt - Password hashing
- jsonwebtoken - JWT tokens
- cors - CORS middleware
- dotenv - Environment variables
- ts-node-dev - Development server

### Frontend Dependencies:
- react, react-dom - React framework
- react-router-dom - Routing
- axios - HTTP client
- zustand - State management
- vite - Build tool

### Development Tools:
- TypeScript - Type safety
- Python (start.py) - Development automation

---

## 📈 İrəliləyiş Təklifləri

1. **Kod Refactoring:**
   - `Satis.tsx`-i kiçik komponentlərə böl
   - Controller-lərdəki debug log-ları azalt
   - Column existence check-lərini sil (Prisma schema ilə həll et)

2. **Təhlükəsizlik:**
   - Environment variables istifadə et (database URL, JWT secret)
   - Input validation əlavə et
   - Rate limiting əlavə et

3. **Performance:**
   - Pagination əlavə et
   - Database indexing optimizasiyası
   - Query optimization

4. **Testing:**
   - Unit testlər
   - Integration testlər
   - E2E testlər

5. **Documentation:**
   - API documentation (Swagger/OpenAPI)
   - Code comments
   - README faylı

6. **Features:**
   - Axtarış funksionallığı
   - Export/Import (Excel, PDF)
   - Hesabatlar
   - Bildirişlər
   - Multi-language dəstəyi

---

## ✅ Güclü Tərəflər

1. ✅ Yaxşı strukturlaşdırılmış kod
2. ✅ TypeScript istifadəsi
3. ✅ Modern texnologiyalar (React, Prisma, Express)
4. ✅ Development automation (start.py)
5. ✅ Shared types
6. ✅ Windows-like UI/UX
7. ✅ Prisma schema file watching
8. ✅ Error handling

---

## 📌 Xülasə

Bu, yaxşı strukturlaşdırılmış, modern texnologiyalarla yazılmış full-stack alış-satış platformasıdır. Proyektin əsas funksionallığı hazırdır və işləyir. Əsas problemlər kod refactoring və təhlükəsizlik təkmilləşdirmələridir. `start.py` script çox faydalı development tool-dur və Prisma schema dəyişikliklərini avtomatik idarə edir.

