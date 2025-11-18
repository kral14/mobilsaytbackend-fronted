@echo off
chcp 65001 >nul
echo ============================================================
echo MobilSayt Backend Server
echo ============================================================
echo.

cd backend

echo 🔍 Node.js yoxlanılır...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js quraşdırılmamışdır!
    echo    Zəhmət olmasa Node.js quraşdırın: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo.

echo 🔍 npm yoxlanılır...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm quraşdırılmamışdır!
    pause
    exit /b 1
)
npm --version
echo.

echo 🔧 Environment variables təyin edilir...
set DATABASE_URL=postgresql://neondb_owner:npg_NVL31qxTnQrC@ep-wild-queen-adh4tc1u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require^&channel_binding=require
set JWT_SECRET=your-secret-key-change-this-in-production
set PORT=5000
set NODE_ENV=development
echo ✅ Environment variables təyin edildi
echo.

if not exist "node_modules" (
    echo 📦 Paketlər quraşdırılır...
    call npm install
    if errorlevel 1 (
        echo ❌ Paketlər quraşdırıla bilmədi!
        pause
        exit /b 1
    )
    echo ✅ Paketlər quraşdırıldı
    echo.
) else (
    echo ✅ Paketlər artıq quraşdırılıb
    echo.
)

echo 🔧 Prisma Client generate edilir...
call npx prisma generate
if errorlevel 1 (
    echo ❌ Prisma Client generate edilə bilmədi!
    pause
    exit /b 1
)
echo ✅ Prisma Client generate edildi
echo.

echo ============================================================
echo 🚀 Backend serveri işə salınır...
echo ============================================================
echo.
echo 📡 Server: http://localhost:5000
echo 📝 API: http://localhost:5000/api
echo 💚 Health Check: http://localhost:5000/api/health
echo.
echo Serveri dayandırmaq üçün Ctrl+C basın
echo.

call npm run dev

pause

