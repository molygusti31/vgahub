const http = require("http");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
require("./database_marugo");
const databasePath = process.pkg
  ? path.join(path.dirname(process.execPath), "db_marugo.db")
  : "db_marugo.db";
const db = new Database(databasePath);
const publicDirectory = path.resolve(__dirname, "public");
const MANAGE_PASSWORD = process.env.MANAGE_PASSWORD || "admin123";

db.pragma("foreign_keys = ON");
// FUNGSI MEMBACA BODY JSON
function bacaBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function responseJSON(res, statusCode, data) {
  // FUNGSI RESPONSE JSON
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function generateIdTransaction() {
  let idTransaction;
  do {
    idTransaction = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  } while (
    db
      .prepare("SELECT 1 FROM weighing_logs WHERE id_transaksi = ? LIMIT 1")
      .get(idTransaction)
  );

  return idTransaction;
}

function toJakartaISOString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function sendConnectionId(res) {
  try {
    return responseJSON(res, 200, {
      message: "Success",
      id_transaksi: generateIdTransaction(),
      tanggal: toJakartaISOString().split(" ")[0],
      waktu: toJakartaISOString().split(" ")[1],
    });
  } catch (error) {
    console.error("Error generating id_transaksi:", error);
    return responseJSON(res, 500, { error: "Gagal membuat id transaksi" });
  }
}

// SERVER
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(req.method, url.pathname);
  if (req.method === "OPTIONS") {
    // CORS PREFLIGHT
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Manage-Password",
    });
    return res.end();
  }
  if (req.method === "POST" && url.pathname === "/api/manage/auth") {
    try {
      const data = await bacaBody(req);
      if (data.password !== MANAGE_PASSWORD) {
        return responseJSON(res, 401, { error: "Password manage salah" });
      }
      return responseJSON(res, 200, { message: "Akses manage diberikan" });
    } catch (error) {
      return responseJSON(res, 400, {
        error: "Permintaan autentikasi tidak valid",
      });
    }
  }
  if (
    ["POST", "DELETE"].includes(req.method) &&
    /^\/api\/(divisi|operator|limbah|sumber)$/.test(url.pathname) &&
    req.headers["x-manage-password"] !== MANAGE_PASSWORD
  ) {
    return responseJSON(res, 401, { error: "Password manage salah" });
  }
  if (
    req.method === "DELETE" &&
    url.pathname === "/api/weighing" &&
    req.headers["x-manage-password"] !== MANAGE_PASSWORD
  ) {
    return responseJSON(res, 401, { error: "Password manage salah" });
  }
  if (req.method === "GET" && url.pathname === "/api/connection") {
    // TEST API
    return sendConnectionId(res);
    // return responseJSON(res, 200, {
    //     success: true,
    //     message: "API MARUGO aktif"
    // });
  }
  if (req.method === "POST" && url.pathname === "/api/divisi") {
    // INSERT MASTER DIVISI
    try {
      const data = await bacaBody(req);
      const insert = db.prepare(`
                INSERT INTO master_divisi
                (divisi)
                VALUES (?)
            `);
      const result = insert.run(data.divisi);
      return responseJSON(res, 200, {
        success: true,
        message: "Divisi berhasil ditambahkan",
        id: result.lastInsertRowid,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
        msg: "insert divisi",
      });
    }
  }
  // GET SEMUA DIVISI
  if (req.method === "GET" && url.pathname === "/api/divisi") {
    try {
      const data = db
        .prepare(`SELECT divisi FROM master_divisi ORDER BY divisi`)
        .all();
      return responseJSON(res, 200, {
        success: true,
        data: data,
      });
    } catch (error) {
      return responseJSON(res, 500, {
        success: false,
        error: error.message,
      });
    }
  }
  // DELETE MASTER DIVISI
  if (req.method === "DELETE" && url.pathname === "/api/divisi") {
    try {
      const data = await bacaBody(req);
      const del = db.prepare(`DELETE FROM master_divisi WHERE divisi = ?`);
      const result = del.run(data.divisi);
      return responseJSON(res, 200, {
        success: true,
        message: "Divisi berhasil dihapus",
        deleted: result.changes,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  // INSERT MASTER OPERATOR
  if (req.method === "POST" && url.pathname === "/api/operator") {
    try {
      const data = await bacaBody(req);
      const insert = db.prepare(
        `INSERT INTO master_operator(operator, divisi, nik) VALUES (?, ?, ?)`,
      );
      const result = insert.run(data.operator, data.divisi, data.nik);
      return responseJSON(res, 200, {
        success: true,
        message: "Operator berhasil ditambahkan",
        changes: result.changes,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  // GET NAMA OPERATOR BERDASARKAN NIK
  if (req.method === "GET" && url.pathname === "/api/operator") {
    const nik = url.searchParams.get("nik");
    try {
      if (!nik) {
        const operators = db
          .prepare(
            `SELECT operator, divisi, nik FROM master_operator ORDER BY operator`,
          )
          .all();
        return responseJSON(res, 200, { success: true, data: operators });
      }
      const operator = db
        .prepare(
          `SELECT operator, divisi, nik FROM master_operator WHERE nik = ?`,
        )
        .get(nik);
      if (!operator) {
        return responseJSON(res, 404, {
          success: false,
          message: "Data tidak ditemukan",
        });
      }
      return responseJSON(res, 200, {
        success: true,
        data: operator,
      });
    } catch (error) {
      return responseJSON(res, 500, {
        success: false,
        error: error.message,
      });
    }
  }
  // DELETE MASTER OPERATOR
  if (req.method === "DELETE" && url.pathname === "/api/operator") {
    try {
      const data = await bacaBody(req);
      const del = db.prepare(`DELETE FROM master_operator WHERE nik = ?`);
      const result = del.run(data.nik);
      return responseJSON(res, 200, {
        success: true,
        message: "Operator berhasil dihapus",
        deleted: result.changes,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  // INSERT MASTER LIMBAH
  if (req.method === "POST" && url.pathname === "/api/limbah") {
    try {
      const data = await bacaBody(req);
      const insert = db.prepare(`
                INSERT INTO master_limbah
                (kategori_limbah, jenis_limbah, kode_limbah)
                VALUES (?, ?, ?)
            `);
      const result = insert.run(
        data.kategori_limbah,
        data.jenis_limbah,
        data.kode_limbah,
      );
      return responseJSON(res, 200, {
        success: true,
        message: "Limbah berhasil ditambahkan",
        changes: result.changes,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  // GET LIMBAH BERDASARKAN KODE LIMBAH
  if (req.method === "GET" && url.pathname === "/api/limbah") {
    const kodeLimbah = url.searchParams.get("id_limbah");
    try {
      if (!kodeLimbah) {
        const limbah = db
          .prepare(
            `
                    SELECT kategori_limbah, jenis_limbah, kode_limbah
                    FROM master_limbah ORDER BY jenis_limbah
                `,
          )
          .all();
        return responseJSON(res, 200, { success: true, data: limbah });
      }
      const limbah = db
        .prepare(
          `
                SELECT kategori_limbah, jenis_limbah, kode_limbah
                FROM master_limbah
                WHERE kode_limbah = ?
            `,
        )
        .get(kodeLimbah);
      if (!limbah) {
        return responseJSON(res, 404, {
          success: false,
          message: "Data tidak ditemukan",
        });
      }
      return responseJSON(res, 200, {
        success: true,
        data: limbah,
      });
    } catch (error) {
      return responseJSON(res, 500, {
        success: false,
        error: error.message,
      });
    }
  }
  // DELETE MASTER LIMBAH
  if (req.method === "DELETE" && url.pathname === "/api/limbah") {
    try {
      const data = await bacaBody(req);
      const del = db.prepare(`
                DELETE FROM master_limbah
                WHERE kode_limbah = ?
            `);
      const result = del.run(data.kode_limbah);
      return responseJSON(res, 200, {
        success: true,
        message: "Limbah berhasil dihapus",
        deleted: result.changes,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  // INSERT SUMBER LIMBAH
  if (req.method === "POST" && url.pathname === "/api/sumber") {
    try {
      const data = await bacaBody(req);
      const insert = db.prepare(
        `INSERT INTO master_sumber_limbah(id_sumber, sumber_limbah) VALUES (?, ?)`,
      );
      const result = insert.run(data.id_sumber, data.sumber_limbah);
      return responseJSON(res, 200, {
        success: true,
        message: "Sumber limbah berhasil ditambahkan",
        changes: result.changes,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  // GET SUMBER LIMBAH BERDASARKAN ID SUMBER
  if (req.method === "GET" && url.pathname === "/api/sumber") {
    const idSumber = url.searchParams.get("id_sumber");
    try {
      if (!idSumber) {
        const sumber = db
          .prepare(
            `
                    SELECT id_sumber, sumber_limbah
                    FROM master_sumber_limbah ORDER BY sumber_limbah
                `,
          )
          .all();
        return responseJSON(res, 200, { success: true, data: sumber });
      }
      const sumber = db
        .prepare(
          `
                SELECT id_sumber, sumber_limbah
                FROM master_sumber_limbah
                WHERE id_sumber = ?
            `,
        )
        .get(idSumber);
      if (!sumber) {
        return responseJSON(res, 404, {
          success: false,
          message: "Data tidak ditemukan",
        });
      }
      return responseJSON(res, 200, {
        success: true,
        data: sumber,
      });
    } catch (error) {
      return responseJSON(res, 500, {
        success: false,
        error: error.message,
      });
    }
  }
  // DELETE SUMBER LIMBAH
  if (req.method === "DELETE" && url.pathname === "/api/sumber") {
    try {
      const data = await bacaBody(req);
      const del = db.prepare(
        `DELETE FROM master_sumber_limbah WHERE id_sumber = ?`,
      );
      const result = del.run(data.id_sumber);
      return responseJSON(res, 200, {
        success: true,
        message: "Sumber limbah berhasil dihapus",
        deleted: result.changes,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  // INSERT WEIGHING LOG
  if (req.method === "DELETE" && url.pathname === "/api/weighing") {
    try {
      const data = await bacaBody(req);
      if (
        !Array.isArray(data.ids) ||
        data.ids.length === 0 ||
        !data.ids.every((id) => Number.isSafeInteger(id) && id > 0)
      ) {
        return responseJSON(res, 400, {
          success: false,
          error: "Daftar ID log tidak valid",
        });
      }

      const ids = [...new Set(data.ids)];
      const deleteSelected = db.transaction(() => {
        const deleteLog = db.prepare(
          "DELETE FROM weighing_logs WHERE id_log = ?",
        );
        return ids.reduce(
          (deleted, id) => deleted + deleteLog.run(id).changes,
          0,
        );
      });
      const deleted = deleteSelected();
      return responseJSON(res, 200, {
        success: true,
        message: "Data penimbangan berhasil dihapus",
        deleted,
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/weighing") {
    try {
      const data = await bacaBody(req);
      const created_at = toJakartaISOString(); // Waktu sekarang YYYY-MM-DD HH:MM:SS
      console.log("created_at:", created_at);
      // const id_transaksi = created_at;        // Buat ID transaksi berdasarkan timestamp
      const insert = db.prepare(`
            INSERT INTO weighing_logs
            (
                id_transaksi,
                id_timbangan,
                nik,
                id_limbah,
                id_sumber,
                berat,
                tanggal, 
                waktu,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? )
        `);

      const result = insert.run(
        data.id_transaksi,
        data.id_timbangan,
        data.nik,
        data.id_limbah,
        data.id_sumber,
        data.berat,
        data.tanggal,
        data.waktu,
        created_at,
      );

      return responseJSON(res, 200, {
        success: true,
        message: "Data penimbangan berhasil disimpan",
        data: {
          id_log: result.lastInsertRowid,
          id_transaksi: data.id_transaksi,
          id_timbangan: data.id_timbangan,
          nik: data.nik,
          id_limbah: data.id_limbah,
          id_sumber: data.id_sumber,
          berat: data.berat,
          created_at: created_at,
        },
      });
    } catch (error) {
      return responseJSON(res, 400, {
        success: false,
        error: error.message,
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/weighing") {
    try {
      const conditions = [];
      const values = [];
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const source = url.searchParams.get("sumber_limbah");
      const waste = url.searchParams.get("jenis_limbah");
      const idSource = url.searchParams.get("id_sumber");
      const idWaste =
        url.searchParams.get("id_limbah") ||
        url.searchParams.get("kode_limbah");
      const scale = url.searchParams.get("id_timbangan");
      const nik = url.searchParams.get("nik");
      const category =
        url.searchParams.get("kategori_limbah")
      if (startDate) {
        conditions.push("date(w.tanggal) >= ?");
        values.push(startDate);
      }
      if (endDate) {
        conditions.push("date(w.tanggal) <= ?");
        values.push(endDate);
      }
      if (source) {
        conditions.push("s.sumber_limbah = ?");
        values.push(source);
      }
      if (waste) {
        conditions.push("l.jenis_limbah = ?");
        values.push(waste);
      }
      if (idSource) {
        conditions.push("w.id_sumber = ?");
        values.push(idSource);
      }
      if (idWaste) {
        conditions.push("w.id_limbah = ?");
        values.push(idWaste);
      }
      if (scale) {
        conditions.push("w.id_timbangan = ?");
        values.push(scale);
      }
      if (nik) {
        conditions.push("w.nik = ?");
        values.push(nik);
      }
      if (category) {
        conditions.push("l.kategori_limbah = ?");
        values.push(category);
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const rows = db
        .prepare(
          `
                SELECT w.id_log, w.id_transaksi, w.id_timbangan, w.nik,
                    o.operator, o.divisi, w.id_limbah, l.kategori_limbah,
                    l.jenis_limbah, w.id_sumber, s.sumber_limbah, w.berat,
                    w.tanggal AS date,
                    w.waktu AS time,
                    w.created_at AS created_at,
                    w.id_log AS id, l.kategori_limbah AS kategori
                FROM weighing_logs w
                JOIN master_operator o ON o.nik = w.nik
                JOIN master_limbah l ON l.kode_limbah = w.id_limbah
                JOIN master_sumber_limbah s ON s.id_sumber = w.id_sumber
                ${where}
                ORDER BY w.tanggal DESC, w.waktu DESC, w.id_log DESC
            `,
        )
        .all(...values);
      return responseJSON(res, 200, rows);
    } catch (error) {
      return responseJSON(res, 500, { success: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/summary") {
    try {
      const table = url.searchParams.get("table");
      const conditions = [];
      const values = [];
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      if (startDate) {
        conditions.push("date(w.tanggal) >= ?");
        values.push(startDate);
      }
      if (endDate) {
        conditions.push("date(w.tanggal) <= ?");
        values.push(endDate);
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      let query;
      if (table === "category-trend") {
        const period = url.searchParams.get("period") || "day";
        const periodExpressions = {
          day: "strftime('%Y-%m-%d', w.tanggal)",
          week: "date(w.tanggal, '-' || ((strftime('%w', w.tanggal) + 6) % 7) || ' days')",
          month: "strftime('%Y-%m', w.tanggal)",
          year: "strftime('%Y', w.tanggal)",
        };
        const periodExpression = periodExpressions[period];
        if (!periodExpression) {
          return responseJSON(res, 400, {
            success: false,
            error: "Parameter period tidak valid",
          });
        }
        query = `
                    SELECT ${periodExpression} AS period,
                        l.kategori_limbah,
                        SUM(w.berat) AS total_weight,
                        COUNT(*) AS count
                    FROM weighing_logs w
                    JOIN master_limbah l ON l.kode_limbah = w.id_limbah
                    ${where}
                    GROUP BY period, l.kategori_limbah
                    ORDER BY period, l.kategori_limbah
                `;
      } else if (table === "sumber_limbah") {
        query = `
                    SELECT s.sumber_limbah, COUNT(*) AS count,
                        SUM(w.berat) AS total_weight, AVG(w.berat) AS avg_weight,
                        COUNT(DISTINCT w.id_limbah) AS count_jenis_limbah,
                        MAX(w.created_at) AS last_update
                    FROM weighing_logs w
                    JOIN master_sumber_limbah s ON s.id_sumber = w.id_sumber
                    ${where}
                    GROUP BY w.id_sumber ORDER BY s.sumber_limbah
                `;
      } else if (table === "jenis_limbah") {
        query = `
                    SELECT l.jenis_limbah, COUNT(*) AS count,
                        SUM(w.berat) AS total_weight, AVG(w.berat) AS avg_weight,
                        COUNT(DISTINCT w.id_sumber) AS count_sumber_limbah,
                        MAX(w.created_at) AS last_update
                    FROM weighing_logs w
                    JOIN master_limbah l ON l.kode_limbah = w.id_limbah
                    ${where}
                    GROUP BY w.id_limbah ORDER BY l.jenis_limbah
                `;
      } else {
        return responseJSON(res, 400, {
          success: false,
          error: "Parameter table tidak valid",
        });
      }
      const rows = db.prepare(query).all(...values);
      return responseJSON(res, 200, rows);
    } catch (error) {
      return responseJSON(res, 500, { success: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/filter-history") {
    try {
      let rows;
      if (url.searchParams.has("sumber_limbah")) {
        rows = db
          .prepare(
            `
                    SELECT DISTINCT s.sumber_limbah AS sumber_limbah
                    FROM weighing_logs w JOIN master_sumber_limbah s ON s.id_sumber = w.id_sumber
                    ORDER BY s.sumber_limbah
                `,
          )
          .all();
      } else if (url.searchParams.has("jenis_limbah")) {
        rows = db
          .prepare(
            `
                    SELECT DISTINCT l.jenis_limbah
                    FROM weighing_logs w JOIN master_limbah l ON l.kode_limbah = w.id_limbah
                    ORDER BY l.jenis_limbah
                `,
          )
          .all();
      } else if (url.searchParams.has("kategori_limbah")) {
        rows = db
          .prepare(
            `
                    SELECT DISTINCT l.kategori_limbah
                    FROM weighing_logs w JOIN master_limbah l ON l.kode_limbah = w.id_limbah
                    ORDER BY l.kategori_limbah
                `,
          )
          .all();
      } else {
        return responseJSON(res, 400, {
          success: false,
          error: "Parameter filter tidak valid",
        });
      }
      return responseJSON(res, 200, rows);
    } catch (error) {
      return responseJSON(res, 500, { success: false, error: error.message });
    }
  }

  const sumberLimbahStatsMatch = url.pathname.match(
    /^\/api\/sumber-limbah-stats\/([^/]+)$/,
  );
  if (req.method === "GET" && sumberLimbahStatsMatch) {
    try {
      const params = new URLSearchParams(url.searchParams);
      params.set("sumber_limbah", decodeURIComponent(sumberLimbahStatsMatch[1]));
      const dateConditions = [];
      const values = [params.get("sumber_limbah")];
      if (params.get("startDate")) {
        dateConditions.push("date(w.tanggal) >= ?");
        values.push(params.get("startDate"));
      }
      if (params.get("endDate")) {
        dateConditions.push("date(w.tanggal) <= ?");
        values.push(params.get("endDate"));
      }
      const dateWhere = dateConditions.length
        ? `AND ${dateConditions.join(" AND ")}`
        : "";
      const stats = db
        .prepare(
          `
                SELECT COUNT(*) AS count, SUM(w.berat) AS total_weight, MAX(w.berat) AS max_weight
                FROM weighing_logs w
                JOIN master_sumber_limbah s ON s.id_sumber = w.id_sumber
                WHERE s.sumber_limbah = ? ${dateWhere}
            `,
        )
        .get(...values);
      return responseJSON(res, 200, [stats]);
    } catch (error) {
      return responseJSON(res, 500, { success: false, error: error.message });
    }
  }

  const sumberLimbahMatch = url.pathname.match(/^\/api\/sumber-limbah\/([^/]+)$/);
  if (req.method === "GET" && sumberLimbahMatch) {
    const source = decodeURIComponent(sumberLimbahMatch[1]);
    const conditions = ["s.sumber_limbah = ?"];
    const values = [source];
    if (url.searchParams.get("startDate")) {
      conditions.push("date(w.tanggal) >= ?");
      values.push(url.searchParams.get("startDate"));
    }
    if (url.searchParams.get("endDate")) {
      conditions.push("date(w.tanggal) <= ?");
      values.push(url.searchParams.get("endDate"));
    }
    try {
      const rows = db
        .prepare(
          `
                SELECT w.id_log, w.id_transaksi, w.id_timbangan, w.nik,
                    o.operator, o.divisi, w.id_limbah, l.kategori_limbah,
                    l.jenis_limbah, w.id_sumber, s.sumber_limbah, w.berat,
                    w.tanggal AS date,
                    w.waktu AS time,
                    w.created_at AS created_at,
                    w.id_log AS id, l.kategori_limbah AS kategori
                FROM weighing_logs w
                JOIN master_operator o ON o.nik = w.nik
                JOIN master_limbah l ON l.kode_limbah = w.id_limbah
                JOIN master_sumber_limbah s ON s.id_sumber = w.id_sumber
                WHERE ${conditions.join(" AND ")}
                ORDER BY w.tanggal DESC, w.waktu DESC, w.id_log DESC
            `,
        )
        .all(...values);
      return responseJSON(res, 200, rows);
    } catch (error) {
      return responseJSON(res, 500, { success: false, error: error.message });
    }
  }
  // URL TIDAK DITEMUKAN
  if (!url.pathname.startsWith("/api/") && req.method === "GET") {
    let requestPath;
    try {
      requestPath = decodeURIComponent(url.pathname);
    } catch {
      return responseJSON(res, 400, {
        success: false,
        message: "Path tidak valid",
      });
    }
    const relativePath =
      requestPath === "/" ? "index.html" : requestPath.slice(1);
    const filePath = path.resolve(publicDirectory, relativePath);
    if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
      return responseJSON(res, 403, {
        success: false,
        message: "Akses ditolak",
      });
    }
    const contentTypes = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".ico": "image/x-icon",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    };
    return fs.readFile(filePath, (error, content) => {
      if (error)
        return responseJSON(res, 404, {
          success: false,
          message: "File tidak ditemukan",
        });
      res.writeHead(200, {
        "Content-Type":
          contentTypes[path.extname(filePath)] || "application/octet-stream",
      });
      return res.end(content);
    });
  }
  return responseJSON(res, 404, {
    success: false,
    message: "API tidak ditemukan",
  });
});
// JALANKAN SERVER
const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log("=================================");
  console.log("API MARUGO berjalan");
  console.log(`http://localhost:${port}`);
  console.log("=================================");
});
