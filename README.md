# 💎 Nuenime Admin Portal & Mobile APK

Portal manajemen terpadu resmi untuk ekosistem **Nuenime Anime Streaming**, mencakup operasional keuangan, gamifikasi, moderasi komunitas, CMS konten, sistem pembaruan APK, dan integrasi donasi Saweria.

Dibangun menggunakan **Expo SDK 54 (Expo Router v6)** dan **React Native Web**, mendukung deployment multi-platform: **Web Dashboard (Vercel)** dan **Android APK (GitHub Actions)**.

---

## 🚀 Fitur & Modul Utama

1. **Finance & Top Up (`/admin/finance`)**:
   - Verifikasi manual & otomatis transaksi top-up Dylan Crystal (Approve, Reject, Reverse).
   - Filter metode pembayaran (QRIS, VA, E-Wallet, Pulsa).
   - Export laporan keuangan & riwayat mutasi saldo.

2. **Paket Dylan Crystal (`/admin/finance`)**:
   - Atur nominal bonus crystal, harga rupiah, dan status ketersediaan paket.

3. **User Management (`/admin/users`)**:
   - Monitoring akun pengguna, email, role (Admin, Mod, User).
   - Fitur banned / suspend, reset saldo, dan riwayat aktivitas user.

4. **Inventory & Border Avatar (`/admin/borders`)**:
   - Manajemen efek bingkai avatar profil anime (Mythic, Legends, Epic, Rare).
   - Atur animasi kilau kristal dan syarat level/pembelian.

5. **Gacha & Crystal Store (`/admin/gacha`)**:
   - Atur banner gacha aktif, banner banner banner deskripsi, dan kalkulator simulator drop rate.
   - Distribusi hadiah massal ke mailbox seluruh pemain.

6. **Gamification & EXP (`/admin/gamification`)**:
   - Kalibrasi EXP per tonton anime, per komentar komunitas, dan bonus login harian.
   - Leaderboard top sultan & top level komunitas.

7. **Community & Chat Moderation (`/admin/community`)**:
   - Moderasi komentar episode dan feed anime real-time.
   - Filter sensor kata terlarang (*Profanity Blacklist*) otomatis.
   - Nuenime Control Chat interaktif dengan navigasi list/chat thread di mobile.

8. **Anime CMS & Streaming Server (`/admin/cms`)**:
   - Pengelolaan metadata anime, episode, cover visual, dan multi-server streaming (Drive, HLS, Direct MP4).

9. **System, APK Update & Broadcast (`/admin/system`)**:
   - Pengaturan Maintenance Mode dan status darurat server.
   - Manajemen Force Update APK Android & Changelog rilis.
   - Broadcast notifikasi massal ke seluruh aplikasi penonton.

10. **Customer Support & Saweria (`/admin/support`)**:
    - Konfigurasi tautan resmi Saweria Nuenime, banner hero GIF, dan daftar poin manfaat (*perks*).
    - Live Preview mockup kartu donasi pengguna.
    - Sistem tiket kendala pelanggan & CS chat balasan langsung.

---

## 🛠️ Tech Stack

- **Framework**: Expo SDK 54 / Expo Router v6
- **Language**: TypeScript (`strict: true`)
- **UI Engine**: React Native Web & Vanilla CSS (Silver Liquid Glass Dark Theme)
- **Database & Auth**: Supabase PostgreSQL + Realtime Subscription
- **Icons**: Material Community Icons via `@expo/vector-icons`
- **Package Manager**: Bun / NPM

---

## 💻 Cara Menjalankan Secara Lokal

### Menggunakan Script Cepat (Rekomendasi)
```powershell
# Jalankan via PowerShell di folder project:
.\run.ps1
```
*Script akan otomatis memeriksa port 8082, memulai server, dan membuka browser ke `http://localhost:8082`.*

### Menjalankan Manual
```bash
# 1. Pastikan dependencies terinstal:
bun install
# atau
npm install

# 2. Jalankan server pengembang:
bun run dev
# atau
npx expo start --web --port 8082
```

### Validasi Typecheck TypeScript
```bash
bun run check
# atau
npm run check
```

---

## 🌐 Panduan Deploy ke Vercel (Web Dashboard)

Project ini sudah dilengkapi konfigurasi [`vercel.json`](./vercel.json) untuk Single Page Application (SPA) routing dan build otomatis Expo Router.

### Langkah Deploy:
1. Push project ke repository GitHub Anda (lihat panduan push di bawah).
2. Buka dashboard [Vercel](https://vercel.com) dan klik **Add New Project**.
3. Import repository GitHub Anda.
4. Pengaturan Build & Output:
   - **Framework Preset**: `Other`
   - **Build Command**: `npx expo export -p web` (atau `bun run build`)
   - **Output Directory**: `dist`
5. Tambahkan **Environment Variables** di Vercel:
   - `EXPO_PUBLIC_SUPABASE_URL` : URL project Supabase Anda
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` : Anon public key Supabase Anda
   - `EXPO_PUBLIC_API_BASE_URL` : URL backend API Anda (contoh: `https://api.aniraku.tech`)
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` : Google OAuth Client ID Anda
6. Klik **Deploy**. Vercel akan otomatis meng-export aplikasi web dan memberikan URL live domain HTTPS!

---

## 📱 Panduan Build Android APK Otomatis via GitHub Actions

Project ini sudah menyertakan workflow GitHub Actions otomatis di [`.github/workflows/build-apk.yml`](./.github/workflows/build-apk.yml).

### Cara Kerja:
- Setiap kali Anda melakukan **`git push`** ke branch `main` atau `master`, GitHub Actions akan otomatis:
  1. Menyiapkan environment Java JDK 17 dan Android SDK.
  2. Melakukan prebuild native Android (`npx expo prebuild`).
  3. Meng-compile APK Android melalui Gradle.
  4. Mengunggah file APK siap install ke tab **Artifacts**.

### Cara Mengunduh APK Hasil Build:
1. Buka tab **Actions** di halaman repository GitHub Anda.
2. Klik workflow **Build Android APK** yang telah selesai (ditandai centang hijau ✅).
3. Gulir ke bawah ke bagian **Artifacts**.
4. Klik **`Nuenime-Admin-Android-APK`** untuk men-download file ZIP berisi file `.apk` yang siap di-install langsung di HP Android Anda.

### Menjalankan Build APK Secara Manual:
1. Masuk ke tab **Actions** di GitHub.
2. Pilih workflow **Build Android APK** di sidebar kiri.
3. Klik tombol **Run workflow** -> Pilih branch `main` -> Klik tombol hijau **Run workflow**.

---

## 📤 Langkah Eksekusi Push ke GitHub

Ikuti langkah-langkah berikut di terminal untuk menginisialisasi repository dan melakukan push:

```powershell
# 1. Masuk ke direktori project
cd D:\admin-nuenime

# 2. Inisialisasi Git repository lokal
git init

# 3. Tambahkan semua file project
git add .

# 4. Buat initial commit
git commit -m "feat: initial commit nuenime admin portal with vercel & github actions apk build"

# 5. Atur branch utama ke 'main'
git branch -M main

# 6. Hubungkan dengan remote repository GitHub Anda (ganti URL dengan repo Anda):
git remote add origin https://github.com/USERNAME_ANDA/NAMA_REPO_ANDA.git

# 7. Push ke GitHub
git push -u origin main
```
*Setelah perintah push selesai, GitHub Actions akan langsung mulai mem-build APK Android Anda secara otomatis, dan project siap dihubungkan ke Vercel!*
