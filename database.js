const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Packaged applications cannot write inside pkg's read-only snapshot.
const dataDirectory = process.pkg
  ? path.dirname(process.execPath)
  : __dirname;
const dbPath = path.join(dataDirectory, 'weighing.db');

// Membuka koneksi database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

// Inisialisasi database dan membuat tabel jika belum ada
function initializeDatabase() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS list_material (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material TEXT NOT NULL UNIQUE,
        ics_number TEXT,
        ics_name TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error creating list_material table:', err);
      } else {
        console.log('Table list_material is ready');
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS weighing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_transaction TEXT,
        no_mesin TEXT NOT NULL,
        material TEXT NOT NULL,
        berat REAL NOT NULL,
        shift TEXT NOT NULL,
        date DATETIME NOT NULL,
        time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material) REFERENCES list_material(material)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err);
      } else {
        db.all('PRAGMA foreign_key_list(weighing_logs)', (foreignKeyErr, foreignKeys) => {
          if (foreignKeyErr) {
            console.error('Error checking weighing_logs foreign key:', foreignKeyErr);
            return;
          }

          if (foreignKeys.length === 0) {
            migrateWeighingLogs();
          } else {
            ensureTransactionColumn((columnErr) => {
              if (columnErr) return;
              ensureIndexes();
              console.log('Table weighing_logs is ready');
            });
          }
        });
      }
    });
  });
}

function migrateWeighingLogs() {
  db.serialize(() => {
    db.run(`
      INSERT OR IGNORE INTO list_material (material)
      SELECT DISTINCT material FROM weighing_logs WHERE material IS NOT NULL
    `, (err) => {
      if (err) {
        console.error('Error preserving existing materials:', err);
        return;
      }
    });

    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting weighing_logs migration:', err);
        return;
      }
    });
    db.run('DROP INDEX IF EXISTS idx_no_mesin');
    db.run('DROP INDEX IF EXISTS idx_date');
    db.run('DROP INDEX IF EXISTS idx_time');
    db.run('DROP INDEX IF EXISTS idx_shift');
    db.run('ALTER TABLE weighing_logs RENAME TO weighing_logs_old');
    db.run(`
      CREATE TABLE weighing_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        no_mesin TEXT NOT NULL,
        material TEXT NOT NULL,
        berat REAL NOT NULL,
        shift TEXT NOT NULL,
        date DATETIME NOT NULL,
        time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material) REFERENCES list_material(material)
      )
    `);
    db.run(`
      INSERT INTO weighing_logs (id, no_mesin, material, berat, shift, date, time, created_at)
      SELECT id, no_mesin, material, berat, shift, date, time, created_at
      FROM weighing_logs_old
    `);
    db.run('DROP TABLE weighing_logs_old');
    db.run('COMMIT', (err) => {
      if (err) {
        console.error('Error completing weighing_logs migration:', err);
        db.run('ROLLBACK');
        return;
      }

      ensureIndexes();
      console.log('Table weighing_logs migrated and is ready');
    });
  });
}

function ensureIndexes() {
    // Buat index untuk performa query
    db.run(`CREATE INDEX IF NOT EXISTS idx_no_mesin ON weighing_logs(no_mesin)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_date ON weighing_logs(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_time ON weighing_logs(time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_shift ON weighing_logs(shift)`);
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_id_transaction ON weighing_logs(id_transaction)`);
}

function ensureTransactionColumn(callback) {
  db.all('PRAGMA table_info(weighing_logs)', (err, columns) => {
    if (err) {
      console.error('Error checking id_transaction column:', err);
      return callback(err);
    }

    if (columns.some(column => column.name === 'id_transaction')) {
      return callback(null);
    }

    db.run('ALTER TABLE weighing_logs ADD COLUMN id_transaction TEXT', (alterErr) => {
      if (alterErr) {
        console.error('Error adding id_transaction column:', alterErr);
      }
      callback(alterErr);
    });
  });
}

module.exports = db;
