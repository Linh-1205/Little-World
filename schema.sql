-- Our Little World · cơ sở dữ liệu D1
-- Chạy: wrangler d1 execute our-little-world --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT
);

-- 02 · Our Story
CREATE TABLE IF NOT EXISTS timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  story TEXT,
  photo_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 03 · Memories
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  caption TEXT,
  tag TEXT,
  media_key TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  w INTEGER,
  h INTEGER,
  from_who TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_memories_date ON memories(date);

-- 04 · Love Letters
CREATE TABLE IF NOT EXISTS letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_who TEXT NOT NULL,
  to_who TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  unlock_at TEXT,
  opened_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 05 · Our Playlist
CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT,
  url TEXT,
  reason TEXT,
  memory TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 06 · Special Days
CREATE TABLE IF NOT EXISTS special_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  yearly INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 07 · Our Bucket List
CREATE TABLE IF NOT EXISTS bucket (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 08 · Little Things
CREATE TABLE IF NOT EXISTS little (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'moment',
  body TEXT NOT NULL,
  from_who TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 09 · Surprise
CREATE TABLE IF NOT EXISTS surprises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT,
  content TEXT,
  photo_key TEXT,
  unlock_at TEXT,
  from_who TEXT NOT NULL,
  opened INTEGER NOT NULL DEFAULT 0,
  opened_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Chống dò mật mã
CREATE TABLE IF NOT EXISTS login_fails (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_fails ON login_fails(ip, ts);

-- Ảnh lưu trực tiếp trong D1 (dùng khi không bật R2)
CREATE TABLE IF NOT EXISTS media (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  size INTEGER,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Cuốn sổ: mỗi chương một trang tự do (chữ + ảnh dán), lưu dạng JSON
CREATE TABLE IF NOT EXISTS notebook (
  chapter TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  by_who TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
