# gmaps-scraper

API sederhana untuk mengekstrak koordinat presisi dari link Google Maps — termasuk short link seperti `maps.app.goo.gl`. Dibangun dengan **Bun**, **ElysiaJS**, dan **puppeteer-core**.

---

## Cara Kerja

Saat kamu kirim sebuah link Google Maps, server akan membuka link tersebut di browser headless Chrome lalu mengekstrak koordinat dengan 3 tahap fallback:

1. **`h2_decimal` (akurasi tinggi)** — Ambil langsung dari elemen `<h2>` yang menampilkan koordinat desimal seperti `-7.554585, 110.868927`
2. **`h1_dms` (akurasi tinggi)** — Kalau h2 tidak tersedia, ambil dari `<h1>` yang menampilkan format DMS seperti `7°33'16.5"S 110°52'08.1"E`, lalu konversi ke desimal
3. **`url_route` (akurasi rendah)** — Fallback terakhir: ekstrak koordinat dari pola `@lat,lng` di URL yang sudah ter-resolve setelah redirect

---

## Prasyarat

- [Bun](https://bun.sh) versi terbaru
- Google Chrome atau Chromium terinstall di sistem

### Install Chrome (Linux)

```bash
# Debian/Ubuntu
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update && sudo apt install google-chrome-stable

# Atau Chromium (lebih ringan)
sudo apt install chromium-browser
```

### Install Chrome (macOS)

```bash
brew install --cask google-chrome
```

---

## Instalasi & Menjalankan Server

```bash
# Clone dan masuk ke direktori
git clone <repo-url>
cd gmaps-scraper

# Install dependencies
bun install

# Jalankan server
bun run index.ts
```

Server akan berjalan di `http://localhost:3000`.

Kalau Chrome kamu ada di lokasi yang tidak standar, set env var-nya:

```bash
CHROME_PATH=/path/to/chrome bun run index.ts

# Atau export dulu
export CHROME_PATH=/usr/bin/chromium
bun run index.ts
```

Untuk mengganti port:

```bash
PORT=8080 bun run index.ts
```

---

## Penggunaan API

### `GET /api/location`

Mengambil koordinat dari sebuah link Google Maps.

**Query Parameter:**

| Parameter | Tipe | Keterangan |
|-----------|------|------------|
| `url` | `string` | Link Google Maps (wajib) |

**Contoh request:**

```bash
curl "http://localhost:3000/api/location?url=https://maps.app.goo.gl/XcCPfq2sALHUPDEeA"
```

**Response sukses:**

```json
{
  "success": true,
  "data": {
    "lat": -7.554585,
    "lng": 110.868927,
    "accuracy": "high",
    "source": "h2_decimal"
  }
}
```

**Response error:**

```json
{
  "success": false,
  "error": "Could not extract coordinates from the given Google Maps link"
}
```

**Keterangan field `source`:**

| Nilai | Keterangan | Akurasi |
|-------|-----------|---------|
| `h2_decimal` | Diambil dari koordinat desimal di halaman | Tinggi |
| `h1_dms` | Diambil dari format DMS lalu dikonversi | Tinggi |
| `url_route` | Diambil dari pola `@lat,lng` di URL | Rendah |

---

### `GET /health`

Cek apakah server berjalan.

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

---

## URL yang Didukung

URL yang diterima harus dari domain Google Maps. Selain itu akan ditolak (untuk mencegah SSRF).

- `https://maps.app.goo.gl/...`
- `https://goo.gl/maps/...`
- `https://www.google.com/maps/...`
- `https://maps.google.com/...`
- `https://google.co.id/maps/...` *(dan domain Google negara lain)*

---

## Struktur Proyek

```
gmaps-scraper/
├── index.ts          # Entry point — ElysiaJS server & routes
├── src/
│   ├── extractor.ts  # Logika scraping: browser singleton + 3-tier extraction
│   └── utils.ts      # Helper: deteksi Chrome, validasi URL, konversi DMS
├── package.json
└── tsconfig.json
```

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
