const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.resolve(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(dbDir, 'cablepay.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        )
      `, (err) => {
        if (err) console.error('Error creating users table:', err);
      });

      // Create homes table
      db.run(`
        CREATE TABLE IF NOT EXISTS homes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          home_id INTEGER UNIQUE NOT NULL,
          customer_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          set_top_box_id TEXT NOT NULL,
          monthly_amount INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Error creating homes table:', err);
      });

      // Create payments table
      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          home_id INTEGER NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          status TEXT CHECK(status IN ('paid', 'unpaid')) NOT NULL,
          collected_amount INTEGER DEFAULT 0,
          paid_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (home_id) REFERENCES homes(home_id),
          UNIQUE(home_id, month, year)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating payments table:', err);
          reject(err);
        } else {
          // Check if collected_amount exists, if not add it (for existing databases)
          db.run(`ALTER TABLE payments ADD COLUMN collected_amount INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              // Ignore duplicate column error, but log others
              console.error('Migration notice (can usually be ignored):', err.message);
            }
            console.log('✅ Database schema initialized');
            resolve();
          });
        }
      });
    });
  });
};

module.exports = { db, initDatabase };
