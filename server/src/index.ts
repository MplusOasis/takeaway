import { DEFAULT_DB_PATH, DEFAULT_PORT } from './config.js';
import { openDatabase } from './db/connection.js';
import { seedIfEmpty } from './db/seed.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const dbPath = process.env.DB_PATH ?? DEFAULT_DB_PATH;

const db = openDatabase(dbPath);
const seeded = seedIfEmpty(db);

const app = createApp(db);
const server = app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  console.log(`[server] db = ${dbPath}${seeded ? '（已写入演示数据）' : ''}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
