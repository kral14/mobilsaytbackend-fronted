#!/bin/bash

echo "============================================================"
echo "MobilSayt Backend Server"
echo "============================================================"
echo ""

cd backend

# Node.js yoxla
echo "🔍 Node.js yoxlanılır..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js quraşdırılmamışdır!"
    echo "   Zəhmət olmasa Node.js quraşdırın: https://nodejs.org/"
    exit 1
fi
node --version
echo ""

# npm yoxla
echo "🔍 npm yoxlanılır..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm quraşdırılmamışdır!"
    exit 1
fi
npm --version
echo ""

# Environment variables təyin et
echo "🔧 Environment variables təyin edilir..."
export DATABASE_URL="postgresql://neondb_owner:npg_NVL31qxTnQrC@ep-wild-queen-adh4tc1u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
export JWT_SECRET="your-secret-key-change-this-in-production"
export PORT=5000
export NODE_ENV=development
echo "✅ Environment variables təyin edildi"
echo ""

# node_modules yoxla
if [ ! -d "node_modules" ]; then
    echo "📦 Paketlər quraşdırılır..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Paketlər quraşdırıla bilmədi!"
        exit 1
    fi
    echo "✅ Paketlər quraşdırıldı"
    echo ""
else
    echo "✅ Paketlər artıq quraşdırılıb"
    echo ""
fi

# Prisma Client generate et
echo "🔧 Prisma Client generate edilir..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Prisma Client generate edilə bilmədi!"
    exit 1
fi
echo "✅ Prisma Client generate edildi"
echo ""

# Serveri işə sal
echo "============================================================"
echo "🚀 Backend serveri işə salınır..."
echo "============================================================"
echo ""
echo "📡 Server: http://localhost:5000"
echo "📝 API: http://localhost:5000/api"
echo "💚 Health Check: http://localhost:5000/api/health"
echo ""
echo "Serveri dayandırmaq üçün Ctrl+C basın"
echo ""

npm run dev

