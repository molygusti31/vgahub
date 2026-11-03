# Dashboard Timbangan (Weighing Scale Dashboard)

Sistem dashboard modern untuk logging, monitoring, dan analisis data penimbangan dengan database SQLite, server Node.js/Express, dan UI yang responsif dan menarik.

## 🎯 Fitur Utama

- **📊 Dashboard Ringkasan**: Visualisasi data dengan grafik batang dan doughnut
- **📈 Grafik per Periode**: Total berat per kategori limbah dengan tampilan harian, mingguan, bulanan, atau tahunan
- **📅 Filter Tanggal**: Filter data berdasarkan rentang tanggal
- **🔧 Analisis Sumber Limbah**: Lihat ringkasan dan detail setiap sumber limbah
- **📋 History Lengkap**: Tabel history penimbangan dengan pencarian
- **📥 Export CSV**: Export data history untuk dianalisis lebih lanjut
- **🎨 UI Modern**: Desain responsif dan user-friendly
- **⚡ Real-time Updates**: Last update untuk setiap sumber limbah
- **📱 Mobile Friendly**: Dashboard dapat diakses dari berbagai perangkat

## 📦 Requirement

- Node.js v20+ dan npm
- SQLite3
- Browser modern (Chrome, Firefox, Edge, Safari)

## 🚀 Setup & Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Inisialisasi Database

Database akan dibuat otomatis saat server pertama kali dijalankan.

### 3. Import Material dari Excel

Gunakan sheet pertama dengan kolom `NO`, `Item Description`, `ICS`, dan `Nama Lain`, lalu jalankan:

```bash
npm run import:materials -- daftar-material.xlsx
```

`Nama Lain` disimpan sebagai `material`, `ICS` sebagai `ics_number`, dan `Item Description` sebagai `ics_name`. Material yang sudah ada akan diperbarui berdasarkan nama material; data penimbangan tidak dihapus. File `.xls`, `.xlsx`, dan `.csv` didukung.

### 4. Generate Test Data (Simulasi)

```bash
npm run simulate
```

Perintah ini akan generate 200 data simulasi untuk testing dashboard.

### 5. Jalankan Server

```bash
npm start
```

Server akan berjalan di `http://localhost:3000`

### 6. Buat Aplikasi Windows (.exe)

Klik dua kali `build-exe.bat`. Setelah selesai, aplikasi tersedia sebagai
`dist\Dashboard.exe`; folder `public` sudah dimasukkan ke dalam executable.
Untuk menjalankan aplikasi dan membuka dashboard otomatis, klik
`start-dashboard.bat`. File `weighing.db` akan dibuat di folder yang sama
dengan executable, sehingga folder tersebut harus dapat ditulis.

Build membutuhkan koneksi internet satu kali untuk memasang dependency
packaging serta Git for Windows karena proses `pkg` membutuhkan `patch.exe`.
Source JavaScript server dan frontend tidak perlu dibagikan untuk menjalankan
hasil build, tetapi executable tetap dapat dianalisis dengan tool reverse
engineering; packaging bukan enkripsi.

### 7. Build aplikasi portabel untuk Ubuntu/Linux

Build harus dijalankan di Ubuntu/Linux untuk menghasilkan modul SQLite native
dan executable dengan arsitektur yang sesuai. Pasang Node.js 20+, npm,
`build-essential`, `python3`, serta GTK 4 dan Python GObject Introspection, lalu
jalankan:

```bash
npm run build:linux
```

Skrip memverifikasi modul `better-sqlite3`, mengemas kode server sebagai
executable, dan membuat arsip portabel, misalnya
`dist/Dashboard-Ubuntu-amd64.tar.gz`. Ekstrak arsip di Ubuntu, lalu klik kanan
`launch-linux.sh` dan pilih **Jalankan** untuk membuka aplikasi desktop GTK 4.
Aplikasi memiliki kolom port, tombol yang berganti antara **Start** dan **Stop**,
serta terminal log tertanam pada jendela yang sama. Control Center tidak
dijalankan di browser; browser tidak diperlukan untuk membuka aplikasi desktop.
Runtime Node.js, source server, dan dependensi aplikasi tidak perlu dipasang di
komputer pengguna. Ubuntu Desktop umumnya menyediakan GTK 4 dan Python GObject
Introspection. Jika belum tersedia, pasang dengan
`sudo apt install python3-gi gir1.2-gtk-4.0`. Paket tersedia untuk arsitektur
amd64 dan arm64.

Database `db_marugo.db`, log `server.log`, pengaturan port, dan status proses
disimpan di folder aplikasi portabel yang sama. Jendela Control Center terpisah
dari proses pengelola, jadi tetap berjalan ketika server dihentikan. Membuka
`launch-linux.sh` kembali menggunakan proses pengelola yang sama. Folder dapat
dipindah selama tetap memiliki izin tulis.
Executable memaketkan kode aplikasi agar tidak dibagikan sebagai file JavaScript
yang mudah dibaca, tetapi ini bukan enkripsi dan tidak mencegah analisis atau
modifikasi oleh pihak yang memiliki paket. Untuk kompatibilitas terbaik, buat
paket di versi Ubuntu yang sama atau lebih lama daripada versi Ubuntu tujuan.

Jika launcher tidak bisa dibuka dengan klik kanan, beri izin eksekusi pada
`launch-linux.sh` melalui **Properties > Permissions**, lalu jalankan kembali.

## 📝 Penggunaan

### Struktur File

```
stanley/
├── server.js              # Express server & API endpoints
├── database.js            # Konfigurasi SQLite database
├── simulator.js           # Script untuk generate data simulasi
├── package.json           # Dependencies
├── public/
│   ├── index.html        # Main dashboard HTML
│   ├── style.css         # Styling CSS
│   └── script.js         # Frontend logic JavaScript
└── weighing.db           # SQLite database (auto-generated)
```

### API Endpoints

#### 1. Tambah Data Penimbangan
```
POST /api/weighing
Body: {
  "id_transaksi": "TRANSAKSI-001",
  "id_timbangan": "TIMBANGAN-001",
  "nik": "NIK-001",
  "id_limbah": "KODE-LIMBAH-001",
  "id_sumber": "ID-SUMBER-001",
  "berat": 25.5,
  "tanggal": "2026-01-31",
  "waktu": "08:30:00"
}
```

#### 2. Ambil Semua Data
```
GET /api/weighing?startDate=2026-01-01&endDate=2026-01-31&sumber_limbah=SUMBER-001&jenis_limbah=Plastik
```

#### 3. Ringkasan Jenis dan Sumber Limbah
```
GET /api/summary?table=jenis_limbah&startDate=2026-01-01&endDate=2026-01-31
GET /api/summary?table=sumber_limbah&startDate=2026-01-01&endDate=2026-01-31
```

#### 4. Grafik Kategori per Periode
```
GET /api/summary?table=category-trend&period=month&startDate=2026-01-01&endDate=2026-12-31
```
Periode menerima `day`, `week`, `month`, atau `year`.

#### 5. Filter History
```
GET /api/filter-history?sumber_limbah=true
GET /api/filter-history?jenis_limbah=true
```

#### 6. Detail dan Statistik per Sumber Limbah
```
GET /api/sumber-limbah/SUMBER-001?startDate=2026-01-01&endDate=2026-01-31
GET /api/sumber-limbah-stats/SUMBER-001?startDate=2026-01-01&endDate=2026-01-31
```

## 🎨 Fitur UI

### 📊 Menu Summary
- Statistik ringkasan (total, rata-rata, dll)
- Grafik berat per jenis limbah
- Grafik persentase penimbangan (doughnut chart)
- Doughnut dan card untuk setiap jenis limbah
- Filter tanggal
- Button export CSV

### 🔧 Menu Sumber Limbah
- Daftar sumber limbah dalam grid card
- Informasi last update untuk setiap sumber limbah
- Total penimbangan per sumber limbah
- Klik sumber limbah untuk melihat detail
- Detail sumber limbah menampilkan:
  - Grafik penimbangan per jenis limbah
  - Grafik distribusi per kategori
  - Statistik sumber limbah (total, rata-rata, max)
  - Filter tanggal

### 📋 Menu History
- Tabel lengkap history penimbangan
- Filter berdasarkan sumber limbah, jenis limbah, kategori, dan tanggal
- Responsif dan mudah dibaca
- Limit 1000 records per query

## 💡 Tips Penggunaan

1. **Simulasi Data**: Gunakan `npm run simulate` untuk generate data sampel
2. **Filter Tanggal**: Gunakan date picker untuk filter data sesuai periode
3. **Export Data**: Klik tombol "Export CSV" untuk download history
4. **Mobile**: Dashboard dapat diakses dari mobile dengan tampilan yang responsif
5. **Real-time**: Refresh browser untuk melihat data terbaru

## 📊 Contoh Penggunaan dengan cURL

### Tambah data penimbangan
```bash
curl -X POST http://localhost:3000/api/weighing \
  -H "Content-Type: application/json" \
  -d '{"id_transaksi":"TRANSAKSI-001","id_timbangan":"TIMBANGAN-001","nik":"NIK-001","id_limbah":"KODE-LIMBAH-001","id_sumber":"ID-SUMBER-001","berat":25.5,"tanggal":"2026-01-31","waktu":"08:30:00"}'
```

### Ambil ringkasan jenis limbah
```bash
curl "http://localhost:3000/api/summary?table=jenis_limbah"
```

### Ambil data dengan filter sumber dan jenis limbah
```bash
curl "http://localhost:3000/api/weighing?startDate=2026-01-01&endDate=2026-01-31&sumber_limbah=SUMBER-001&jenis_limbah=Plastik"
```

## 🎓 Teknologi yang Digunakan

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js
- **Styling**: Custom CSS dengan Gradient & Animations

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Troubleshooting

### Database Error
- Hapus file `weighing.db` dan jalankan server kembali
- Pastikan folder `public` ada dan berisi file HTML, CSS, JS

### Port Already in Use
- Ubah port di `server.js`
- Atau tutup aplikasi lain yang menggunakan port 3000

### Data Tidak Tampil
- Jalankan `npm run simulate` untuk generate data
- Cek browser console untuk error messages

## 📄 Lisensi

Bebas digunakan untuk keperluan pribadi dan komersial

## 👨‍💻 Author

Dashboard Timbangan v1.0

---

**Selamat menggunakan Dashboard Timbangan! 🎉**
