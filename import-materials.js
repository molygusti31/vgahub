const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');

const inputPath = process.argv[2];
const dataDirectory = process.pkg ? path.dirname(process.execPath) : __dirname;
const dbPath = process.env.DB_PATH || path.join(dataDirectory, 'weighing.db');

function printUsage() {
  console.error('Usage: npm run import:materials -- <file.xlsx|file.xls|file.csv>');
  console.error('Optional database path: DB_PATH=path\\to\\weighing.db npm run import:materials -- file.xlsx');
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function textValue(value) {
  return String(value ?? '').trim();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (error) => {
      if (error) reject(error);
      else resolve(db);
    });
  });
}

function run(db, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, parameters, function onComplete(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main() {
  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const resolvedInputPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInputPath)) {
    throw new Error(`File Excel tidak ditemukan: ${resolvedInputPath}`);
  }

  const workbook = XLSX.readFile(resolvedInputPath, { cellText: true, cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });

  if (rows.length === 0) {
    throw new Error('Sheet pertama tidak memiliki data.');
  }

  const headerMap = new Map(
    Object.keys(rows[0]).map((header) => [normalizeHeader(header), header])
  );
  const materialHeader = headerMap.get('namalain') || headerMap.get('material');
  const icsHeader = headerMap.get('ics') || headerMap.get('icsnumber');
  const aliasHeader = headerMap.get('itemdescription') || headerMap.get('icsname');

  if (!materialHeader || !icsHeader || !aliasHeader) {
    throw new Error(
      'Header wajib tidak lengkap. Gunakan: NO, Item Description, ICS, Nama Lain.'
    );
  }

  const materials = [];
  const skippedRows = [];
  rows.forEach((row, index) => {
    const material = textValue(row[materialHeader]);
    if (!material) {
      skippedRows.push(index + 2);
      return;
    }

    materials.push({
      material,
      icsNumber: textValue(row[icsHeader]),
      icsName: textValue(row[aliasHeader])
    });
  });

  if (materials.length === 0) {
    throw new Error('Tidak ada baris material yang dapat diimpor.');
  }

  const db = await openDatabase();
  try {
    await run(db, `
      CREATE TABLE IF NOT EXISTS list_material (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material TEXT NOT NULL UNIQUE,
        ics_number TEXT,
        ics_name TEXT
      )
    `);
    await run(db, 'BEGIN TRANSACTION');

    for (const item of materials) {
      await run(db, `
        INSERT INTO list_material (material, ics_number, ics_name)
        VALUES (?, ?, ?)
        ON CONFLICT(material) DO UPDATE SET
          ics_number = excluded.ics_number,
          ics_name = excluded.ics_name
      `, [item.material, item.icsNumber || null, item.icsName || null]);
    }

    await run(db, 'COMMIT');
    console.log(`Berhasil mengimpor ${materials.length} material ke ${dbPath}`);
    if (skippedRows.length > 0) {
      console.warn(`Baris tanpa Item Description dilewati: ${skippedRows.join(', ')}`);
    }
  } catch (error) {
    try {
      await run(db, 'ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback gagal:', rollbackError.message);
    }
    throw error;
  } finally {
    await closeDatabase(db);
  }
}

main().catch((error) => {
  console.error('Import gagal:', error.message);
  process.exitCode = 1;
});