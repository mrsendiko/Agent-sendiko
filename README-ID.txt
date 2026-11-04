AGENT SENDIKO V1.4 — CLOUD MEMORY + SELF DEVELOPMENT

ISI ZIP
- Fondasi V1.3 dipertahankan.
- Cloud Memory melalui Supabase Auth + tabel user-scoped dengan Row Level Security (RLS).
- Memory lokal tetap tersedia sebagai fallback.
- Self Development tetap approval-gated; evaluasi status dan minta agent menyusun rencana, bukan auto-modify source/deploy.
- UI setup Cloud Memory dan SQL setup disertakan.

DEPLOY
1. Ekstrak ZIP dan deploy folder proyek ke Netlify (netlify.toml berada di root proyek).
2. Pasang environment variable provider AI yang dipakai di Netlify, lalu deploy ulang.
3. Buka aplikasi. Untuk Cloud Memory, buat project Supabase, aktifkan Email Auth, buat tabel memories dan policy RLS sesuai SQL yang ditampilkan di menu Memory.
4. Masukkan Project URL dan anon/publishable key (BUKAN service_role key), daftar/login, lalu sinkronkan.

CATATAN PENTING
- Cloud Memory memerlukan konfigurasi Supabase oleh pemilik. Tidak ada cloud database yang otomatis dibuat hanya dengan deploy ZIP.
- SQL setup tersedia di panel Cloud Memory; policy RLS membatasi catatan ke user yang login.
- Jangan menyimpan password, API key, atau informasi sensitif di memory.
- Self Development belum melakukan perubahan source code, deploy, atau install layanan otomatis. Perubahan produksi tetap memerlukan persetujuan dan pengujian.
- Belum diuji deploy live Netlify atau Supabase di akun pengguna.
- ZIP adalah web app, bukan APK Android. Gunakan Netlify lalu Add to Home Screen/Install App dari browser.
