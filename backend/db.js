const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function setupDatabase() {
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  // 1. 課程表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT
    )
  `);

  // 2. 課堂場次表 (包含開啟時間與限時分鐘數)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      title TEXT,
      session_date TEXT,
      is_active INTEGER DEFAULT 0,
      activated_at TEXT,
      limit_minutes INTEGER DEFAULT 0
    )
  `);

  // 3. 學生表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      student_id TEXT UNIQUE
    )
  `);

  // 4. 家屬對應表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_attendee_mappings (
      user_email TEXT,
      attendee_id INTEGER,
      PRIMARY KEY (user_email, attendee_id)
    )
  `);

  // 5. 裝置綁定表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_device_bindings (
      user_email TEXT PRIMARY KEY,
      device_uuid TEXT
    )
  `);

  // 6. 簽到紀錄表 (包含 status 欄位：準時 vs 遲到)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      user_email TEXT,
      attendee_id INTEGER,
      device_uuid TEXT,
      status TEXT DEFAULT '準時',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, attendee_id)
    )
  `);

  return db;
}

module.exports = setupDatabase;