const db = require('./database');

// Data simulasi
const machines = ['MESIN-001', 'MESIN-002', 'MESIN-003', 'MESIN-004'];
const materials = ['MH CLEAR', 'AC SMOKE'];

// Generate random weight (kg)
function randomWeight() {
  return parseFloat((Math.random() * 20 + 990).toFixed(2));
}

// Generate random timestamp dalam 30 hari terakhir
function randomTimestamp() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);
  
  const timestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000 - minutesAgo * 60 * 1000);
  return timestamp.toISOString().slice(0, 19).replace('T', ' ');
}

// Fungsi untuk insert data
function insertData() {
  const query = `
    INSERT INTO weighing_logs (no_mesin, material, berat, shift, date, time)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.serialize(() => {
    // Generate 200 data simulasi
    for (let i = 0; i < 200; i++) {
      const no_mesin = machines[Math.floor(Math.random() * machines.length)];
      const material = materials[Math.floor(Math.random() * materials.length)];
      const berat = randomWeight();
      const timestamp = randomTimestamp();
      const [date, time] = timestamp.split(' ');
      const hour = parseInt(time.split(':')[0], 10);
      let shift;
      if (hour >= 8 && hour < 17) {
        shift = 'Shift 1';
      } else if (hour >= 1 && hour < 8) {
        shift = 'Shift 3';
      } else {
        shift = 'Shift 2';
      }


      db.run(query, [no_mesin, material, berat, shift, date, time], function(err) {
        if (err) {
          console.error('Error inserting data:', err);
        } else if (i === 199) {
          console.log(`✓ ${i + 1} data simulasi berhasil ditambahkan ke database`);
          db.close(() => {
            console.log('Database connection closed');
          });
        }
      });
    }
  });
}

// Clear existing data dan insert data baru
console.log('Starting data simulation...');
console.log('Clearing existing data...');

db.serialize(() => {
  db.run('DELETE FROM weighing_logs', (err) => {
    if (err) {
      console.error('Error clearing data:', err);
      process.exit(1);
    } else {
      console.log('✓ Existing data cleared');
      insertData();
    }
  });
});
