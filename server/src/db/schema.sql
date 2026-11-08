PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  student_no TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stalls (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  zone         TEXT NOT NULL,
  description  TEXT,
  is_open      INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  prep_minutes INTEGER NOT NULL DEFAULT 8,
  sort         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dishes (
  id          TEXT PRIMARY KEY,
  stall_id    TEXT NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status      TEXT NOT NULL CHECK (status IN ('on_sale', 'sold_out', 'off_shelf')),
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id    TEXT NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, dish_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                 TEXT PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stall_id           TEXT NOT NULL REFERENCES stalls(id),
  stall_name         TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('paid', 'preparing', 'ready', 'completed', 'cancelled')),
  items_total_cents  INTEGER NOT NULL CHECK (items_total_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL CHECK (delivery_fee_cents >= 0),
  total_cents        INTEGER NOT NULL CHECK (total_cents >= 0),
  address            TEXT NOT NULL,
  remark             TEXT,
  paid_at            TEXT NOT NULL,
  cancel_deadline    TEXT NOT NULL,
  cancelled_at       TEXT,
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id                   TEXT PRIMARY KEY,
  order_id             TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id              TEXT NOT NULL,
  name_snapshot        TEXT NOT NULL,
  price_cents_snapshot INTEGER NOT NULL CHECK (price_cents_snapshot >= 0),
  qty                  INTEGER NOT NULL CHECK (qty > 0)
);

CREATE TABLE IF NOT EXISTS order_status_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_dishes_stall ON dishes(stall_id, sort);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_logs_order ON order_status_logs(order_id, id);
