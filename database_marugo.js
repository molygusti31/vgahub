const Database = require("better-sqlite3");
const path = require("path");

const databasePath = process.pkg
  ? path.join(path.dirname(process.execPath), "db_marugo.db")
  : "db_marugo.db";
const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.exec(`

    CREATE TABLE IF NOT EXISTS master_operator (
        "operator"	TEXT NOT NULL,
        "divisi"	TEXT NOT NULL,
        "nik"	TEXT NOT NULL UNIQUE,
        FOREIGN KEY (divisi) REFERENCES master_divisi(divisi)
    );

    CREATE TABLE IF NOT EXISTS master_limbah (
        "kategori_limbah"	TEXT NOT NULL,
        "jenis_limbah"	TEXT NOT NULL,
        "kode_limbah"	TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS master_divisi (
	    "divisi"	TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS master_sumber_limbah (
        "id_sumber"	TEXT NOT NULL UNIQUE,
        "sumber_limbah"	TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weighing_logs (
        "id_log"	INTEGER,
        "id_transaksi"	TEXT NOT NULL UNIQUE,
        "id_timbangan"	TEXT NOT NULL,
        "nik"	TEXT NOT NULL,
        "id_limbah"	TEXT NOT NULL,
        "id_sumber"	TEXT NOT NULL,
        "berat"	REAL NOT NULL,
        "tanggal"	DATETIME,
        "waktu"	DATETIME,
        "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        PRIMARY KEY("id_log" AUTOINCREMENT),
        FOREIGN KEY (id_sumber) REFERENCES master_sumber_limbah(id_sumber),
        FOREIGN KEY (nik) REFERENCES master_operator(nik),
        FOREIGN KEY (id_limbah) REFERENCES master_limbah(kode_limbah)
    );

`);

console.log("Semua tabel berhasil dibuat");

db.close();