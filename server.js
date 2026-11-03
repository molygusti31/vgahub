const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');
const net = require('net');
const { ensureLicense } = require('./license');

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const MANAGE_PASSWORD = process.env.MANAGE_PASSWORD || 'admin123';

function generateIdTransaction() {
  return new Promise((resolve, reject) => {
    const createId = () => {
      const idTransaction = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      db.get(
        'SELECT 1 FROM weighing_logs WHERE id_transaction = ? LIMIT 1',
        [idTransaction],
        (err, row) => {
          if (err) return reject(err);
          if (row) return createId();
          resolve(idTransaction);
        },
      );
    };

    createId();
  });
}

function getAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        resolve(getAvailablePort(startPort + 1));
        return;
      }

      reject(err);
    });

    tester.once('listening', () => {
      const port = tester.address().port;
      tester.close(() => resolve(port));
    });

    tester.listen(startPort);
  });
}

function toJakartaISOString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function getCurrentShift() {
  const jakartaTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const hour = new Date(jakartaTime).getHours();
  let shift = (hour >= 8 && hour < 17) ? 'Shift 1' : (hour >= 1 && hour < 8) ? 'Shift 3' : 'Shift 2';
  return shift;
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
const publicDirectory = path.join(__dirname, 'public');
app.use(express.static(publicDirectory));

function requireManagePassword(req, res, next) {
  if (req.get('x-manage-password') !== MANAGE_PASSWORD) {
    return res.status(401).json({ error: 'Password manage salah' });
  }

  next();
}

// ============ API Endpoints ============

// 0. Cek koneksi jaringan
app.get('/api/connection', async (req, res) => {
  try {
    res.json({ message: 'Success', id_transaction: await generateIdTransaction() });
  } catch (err) {
    console.error('Error generating id_transaction:', err);
    res.status(500).json({ error: 'Gagal membuat id transaksi' });
  }
});

// 1. Tambah log penimbangan
app.post('/api/weighing', async (req, res) => {
  const { id_transaction, no_mesin, material, berat, shift, date, time } = req.body;
  let shiftValue = shift;

  if (!no_mesin || !material || !berat) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  if (material === 'Select Material') {
    return res.status(400).json({ message: 'Material tidak valid' });
  }

  if (!shift) {
    shiftValue = getCurrentShift();
  }

  let transactionId = String(id_transaction || '').trim();
  if (!transactionId) {
    try {
      transactionId = await generateIdTransaction();
    } catch (err) {
      console.error('Error generating id_transaction:', err);
      return res.status(500).json({ message: 'Gagal membuat id transaksi' });
    }
  }

  const jakartaTimestamp = toJakartaISOString();
  const query = `
    INSERT INTO weighing_logs (id_transaction, no_mesin, material, berat, shift, date, time, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // setTimeout(() => {
    db.run(query, [transactionId, no_mesin, material, berat, shiftValue, date, time, jakartaTimestamp], function(err) {
      setTimeout(() => {
        if (err) {
          console.error('Error inserting data:', err);
          return res.status(500).json({ message: 'Gagal menyimpan data' });
        } else {
          const res_date = jakartaTimestamp.split(' ')[0];
          const res_time = jakartaTimestamp.split(' ')[1];
          res.json({
            id: this.lastID,
            id_transaction: transactionId,
            shift: shiftValue,
            date: res_date,
            time: res_time,
            message: 'Success'
          });
        }
      }, 5000);
    });
  // }, 5000);
});

// 2. Cek apakah data penimbangan sudah tersimpan
app.post('/api/weighing/check', (req, res) => {
  const { id_transaction } = req.body;

  if (!id_transaction) {
    return res.status(400).json({ error: 'ID transaksi tidak ditemukan' });
  }

  db.get(
    `SELECT *
     FROM weighing_logs
     WHERE id_transaction = ?`,
    [id_transaction],
    (err, row) => {
      if (err) {
        console.error('Error checking duplicate data:', err);
        return res.status(500).json({ error: 'Gagal mengecek data' });
      }

      res.json({ 
        id: row?.id,  
        id_transaction: row?.id_transaction, 
        shift: row?.shift, 
        date: row?.created_at.split(' ')[0],
        time: row?.created_at.split(' ')[1],
        message: row ? 'Exist' : 'Not Found' });
    },
  );
});

// 2. Ambil semua data dengan filter
app.get('/api/weighing', (req, res) => {
  const { startDate, endDate, no_mesin, material, shift } = req.query;
  let query = 'SELECT * FROM weighing_logs';
  const params = [];

  if (req.query.export === 'true') {
    query = `SELECT weighing_logs.*, list_material.ics_name, list_material.ics_number FROM weighing_logs JOIN list_material ON weighing_logs.material = list_material.material`;
  }
  query += ' WHERE 1=1';
  if (startDate) {
    query += ` AND substr(created_at, 1, 10) >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND substr(created_at, 1, 10) <= ?`;
    params.push(endDate);
  }
  if (no_mesin) {
    query += ` AND no_mesin = ?`;
    params.push(no_mesin);
  }
  if (material) {
    query += ` AND weighing_logs.material = ?`;
    params.push(material);
  }
  if (shift) {
    query += ` AND shift = ?`;
    params.push(shift);
  }

  query += ` ORDER BY created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching data:', err);
      res.status(500).json({ error: 'Gagal mengambil data' });
    } else {
      res.json(rows || []);
    }
  });
});

// 3. Ambil daftar mesin yang unik
app.get('/api/machines', (req, res) => {
  const query = `
    SELECT DISTINCT no_mesin, 
           MAX(created_at) as last_update,
           COUNT(*) as total_weighing,
		       COUNT(DISTINCT material) AS total_material,
           SUM(berat) as total_weight,
		       AVG(berat) as avg_weight
    FROM weighing_logs
    GROUP BY no_mesin
    ORDER BY last_update DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching machines:', err);
      res.status(500).json({ error: 'Gagal mengambil data mesin' });
    } else {
      res.json(rows || []);
    }
  });
});

// 4. Ambil statistik ringkasan
app.get('/api/summary', (req, res) => {
  const { table, startDate, endDate } = req.query;
  
  let dateFilter = '';
  const params = [];

  if (startDate && endDate) {
    dateFilter = ` WHERE substr(created_at, 1, 10) BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  db.all(`
    SELECT 
      ${table},
      MAX(created_at) as last_update,
      COUNT(*) as count,
      COUNT(DISTINCT no_mesin) as count_machine,
      COUNT(DISTINCT material) as count_material,
      SUM(berat) as total_weight,
      AVG(berat) as avg_weight,
      created_at
    FROM weighing_logs
    ${dateFilter}
    GROUP BY ${table}
    ORDER BY last_update DESC
  `, params, (err, rows) => {
    if (err) {
      console.error('Error fetching summary:', err);
      res.status(500).json({ error: 'Gagal mengambil ringkasan' });
    } else {
      res.json(rows || []);
    }
  });
});

// 5. Ambil data per mesin
app.get('/api/machine/:no_mesin', (req, res) => {
  const { no_mesin } = req.params;
  const { startDate, endDate } = req.query;

  let query = `
    SELECT * FROM weighing_logs 
    WHERE no_mesin = ?
  `;
  const params = [no_mesin];

  if (startDate) {
    query += ` AND substr(created_at, 1, 10) >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND substr(created_at, 1, 10) <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching machine data:', err);
      res.status(500).json({ error: 'Gagal mengambil data mesin' });
    } else {
      res.json(rows || []);
    }
  });
});

// 6. Ambil statistik per mesin
app.get('/api/machine-stats/:no_mesin', (req, res) => {
  const { no_mesin } = req.params;
  const { startDate, endDate } = req.query;

  let dateFilter = '';
  const params = [no_mesin];

  if (startDate && endDate) {
    dateFilter = ` AND substr(date, 1, 10) BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  db.all(`
    SELECT 
      material,
      shift,
      COUNT(*) as count,
      SUM(berat) as total_weight,
      AVG(berat) as avg_weight,
      MAX(berat) as max_weight,
      MIN(berat) as min_weight
    FROM weighing_logs
    WHERE no_mesin = ?
    ${dateFilter}
    GROUP BY material, shift
    ORDER BY COUNT(*) DESC
  `, params, (err, rows) => {
    if (err) {
      console.error('Error fetching machine stats:', err);
      res.status(500).json({ error: 'Gagal mengambil statistik mesin' });
    } else {
      res.json(rows || []);
    }
  });
});

// 7. Export data ke CSV
app.get('/api/export', (req, res) => {
  const { startDate, endDate } = req.query;

  let query = 'SELECT * FROM weighing_logs WHERE 1=1';
  const params = [];

  if (startDate) {
    query += ` AND substr(date, 1, 10) >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND substr(date, 1, 10) <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error exporting data:', err);
      res.status(500).json({ error: 'Gagal mengekspor data' });
    } else {
      // Buat CSV
      let csv = 'ID,No Mesin,Material,Berat,Shift,date,time\n';
      rows.forEach(row => {
        csv += `${row.id},"${row.no_mesin}","${row.material}",${row.berat},"${row.shift}","${row.date}","${row.time}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=weighing_history.csv');
      res.send(csv);
    }
  });
});

// 8. Hapus semua data (untuk testing)
app.delete('/api/data', (req, res) => {
  db.run('DELETE FROM weighing_logs', (err) => {
    if (err) {
      console.error('Error deleting data:', err);
      res.status(500).json({ error: 'Gagal menghapus data' });
    } else {
      res.json({ message: 'Semua data berhasil dihapus' });
    }
  });
});

app.post('/api/manage/auth', (req, res) => {
  if (req.body.password !== MANAGE_PASSWORD) {
    return res.status(401).json({ error: 'Password manage salah' });
  }

  res.json({ message: 'Akses manage diberikan' });
});

app.get('/api/manage/weighing-logs', requireManagePassword, (req, res) => {
  const { no_mesin, material, shift, startDate, endDate } = req.query;
  const conditions = [];
  const params = [];
  if (no_mesin) {
    conditions.push('weighing_logs.no_mesin = ?');
    params.push(no_mesin);
  }
  if (material) {
    conditions.push('weighing_logs.material = ?');
    params.push(material);
  }
  if (shift) {
    conditions.push('weighing_logs.shift = ?');
    params.push(shift);
  }
  if (startDate) {
    conditions.push('weighing_logs.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('weighing_logs.date <= ?');
    params.push(endDate);
  }

  db.all(
    `SELECT weighing_logs.*, list_material.ics_name, list_material.ics_number
     FROM weighing_logs LEFT JOIN list_material ON weighing_logs.material = list_material.material
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY weighing_logs.created_at DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Gagal mengambil log' });
      res.json(rows || []);
    },
  );
});

app.get('/api/manage/materials', requireManagePassword, (req, res) => {
  db.all('SELECT * FROM list_material ORDER BY material COLLATE NOCASE', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Gagal mengambil material' });
    res.json(rows || []);
  });
});

app.post('/api/manage/materials', requireManagePassword, (req, res) => {
  const { material, ics_name, ics_number } = req.body;
  if (!String(material || '').trim()) {
    return res.status(400).json({ error: 'Nama material wajib diisi' });
  }

  db.run(
    'INSERT INTO list_material (material, ics_name, ics_number) VALUES (?, ?, ?)',
    [String(material).trim(), ics_name || null, ics_number || null],
    function (err) {
      if (err) return res.status(400).json({ error: 'Material sudah ada atau tidak valid' });
      res.status(201).json({ id: this.lastID, message: 'Material berhasil ditambahkan' });
    },
  );
});

app.put('/api/manage/materials/:id', requireManagePassword, (req, res) => {
  const { material, ics_name, ics_number } = req.body;
  const nextMaterial = String(material || '').trim();

  if (!nextMaterial) {
    return res.status(400).json({ error: 'Nama material wajib diisi' });
  }

  db.get('SELECT material FROM list_material WHERE id = ?', [req.params.id], (findErr, existing) => {
    if (findErr) return res.status(500).json({ error: 'Gagal mencari material' });
    if (!existing) return res.status(404).json({ error: 'Material tidak ditemukan' });

    db.get('SELECT id FROM list_material WHERE material = ?', [nextMaterial], (duplicateErr, duplicate) => {
      if (duplicateErr) return res.status(500).json({ error: 'Gagal memeriksa nama material' });
      if (duplicate && duplicate.id !== Number(req.params.id)) {
        return res.status(409).json({ error: 'Nama material sudah digunakan' });
      }

      if (existing.material !== nextMaterial) {
        return db.get(
          'SELECT 1 FROM weighing_logs WHERE material = ? LIMIT 1',
          [existing.material],
          (usageErr, usage) => {
            if (usageErr) return res.status(500).json({ error: 'Gagal memeriksa penggunaan material' });
            if (usage) {
              return res.status(409).json({
                error: 'Update gagal: material masih terpakai di weighing_logs',
              });
            }

            updateMaterialMetadata();
          },
        );
      } else {
        updateMaterialMetadata();
      }

      function updateMaterialMetadata() {
        db.run(
          'UPDATE list_material SET material = ?, ics_name = ?, ics_number = ? WHERE id = ?',
          [nextMaterial, ics_name || null, ics_number || null, req.params.id],
          (updateErr) => {
            if (updateErr) return res.status(400).json({ error: 'Material tidak dapat diubah' });
            res.json({ message: 'Material berhasil diubah' });
          },
        );
      }
    });
  });
});

app.delete('/api/manage/materials/:id', requireManagePassword, (req, res) => {
  db.run('DELETE FROM list_material WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(409).json({ error: 'Material masih digunakan oleh weighing_logs' });
    if (!this.changes) return res.status(404).json({ error: 'Material tidak ditemukan' });
    res.json({ message: 'Material berhasil dihapus' });
  });
});

app.put('/api/manage/weighing-logs/:id', requireManagePassword, (req, res) => {
  const { no_mesin, material, berat, shift, date, time } = req.body;
  if (!no_mesin || !material || berat === undefined || !shift || !date || !time) {
    return res.status(400).json({ error: 'Data log tidak lengkap' });
  }

  db.run(
    'UPDATE weighing_logs SET no_mesin = ?, material = ?, berat = ?, shift = ?, date = ?, time = ? WHERE id = ?',
    [no_mesin, material, berat, shift, date, time, req.params.id],
    function (err) {
      if (err) return res.status(400).json({ error: 'Log tidak dapat diubah' });
      if (!this.changes) return res.status(404).json({ error: 'Log tidak ditemukan' });
      res.json({ message: 'Log berhasil diubah' });
    },
  );
});

app.post('/api/manage/weighing-logs', requireManagePassword, (req, res) => {
  const { no_mesin, material, berat, shift, date, time } = req.body;
  if (!no_mesin || !material || berat === undefined || !shift || !date || !time) {
    return res.status(400).json({ error: 'Data log tidak lengkap' });
  }

  db.run(
    'INSERT INTO weighing_logs (no_mesin, material, berat, shift, date, time) VALUES (?, ?, ?, ?, ?, ?)',
    [no_mesin, material, berat, shift, date, time],
    function (err) {
      if (err) return res.status(400).json({ error: 'Log tidak dapat ditambahkan' });
      res.status(201).json({ id: this.lastID, message: 'Log berhasil ditambahkan' });
    },
  );
});

app.delete('/api/manage/weighing-logs', requireManagePassword, (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'Pilih data yang akan dihapus' });

  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM weighing_logs WHERE id IN (${placeholders})`, ids, function (err) {
    if (err) return res.status(500).json({ error: 'Gagal menghapus log' });
    res.json({ message: `${this.changes} data berhasil dihapus` });
  });
});

app.get('/api/filter-history', (req, res) => {
  const { machine, material, shift } = req.query;

  let query = 'SELECT ';
  const params = [];

  if (machine) {
    query += 'DISTINCT no_mesin ';
  }
  if (material) {
    query += 'DISTINCT material ';
  }
  if (shift) {
    query += 'DISTINCT shift ';
  }

  query += 'FROM weighing_logs';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching history:', err);
      res.status(500).json({ error: 'Gagal mengambil data history' });
    } else {
      res.json(rows || []);
    }
  });
});

app.get('/api/get-material', (req, res) => {
  let query = `SELECT material from list_material ORDER BY id`;
  const params = [];

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching material:', err);
      res.status(500).json({ error: 'Failed get materials'});
    } else {
      res.json(rows || []);
    }
  });
}); 

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

// Start server after license validation
(async () => {
  try {
    await ensureLicense();

    const portToUse = await getAvailablePort(DEFAULT_PORT);
    if (portToUse !== DEFAULT_PORT) {
      console.warn(`Port ${DEFAULT_PORT} sudah dipakai. Aplikasi berjalan di port ${portToUse} instead.`);
    }

    app.listen(portToUse, () => {
      console.log(`Server berjalan di http://localhost:${portToUse}`);
    });
  } catch (error) {
    console.error('Gagal memvalidasi lisensi:', error);
    process.exit(1);
  }
})();
