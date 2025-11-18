# MobilSayt - Mobil Versiya

Mobil cihazlar üçün optimizasiya edilmiş alış-satış idarəetmə sistemi.

## Xüsusiyyətlər

- 📱 Mobil-friendly UI/UX
- 🍔 Hamburger menu
- 📍 Bottom navigation bar
- 👆 Touch-friendly buttons və inputlar
- 📱 Responsive dizayn
- ⚡ Sürətli və yüngül

## Quraşdırma

```bash
cd mobil
npm install
```

## İşə salma

```bash
npm run dev
```

Proqram `http://localhost:3001` ünvanında işə düşəcək.

## Build

```bash
npm run build
```

Build edilmiş fayllar `dist` papkasında olacaq.

## Struktur

```
mobil/
├── src/
│   ├── components/     # Komponentlər
│   ├── pages/          # Səhifələr
│   ├── services/       # API xidmətləri
│   ├── store/          # State management
│   └── utils/          # Yardımçı funksiyalar
├── public/             # Statik fayllar
└── package.json
```

## Qeydlər

- Mobil versiya eyni backend API-ni istifadə edir
- Bütün səhifələr mobil üçün optimizasiya edilmişdir
- Touch-friendly elementlər (minimum 44x44px)
- iOS və Android üçün uyğunlaşdırılmışdır

