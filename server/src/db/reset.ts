import { existsSync, rmSync } from 'node:fs';
import { DEFAULT_DB_PATH } from '../config.js';
import { openDatabase } from './connection.js';
import { seedIfEmpty } from './seed.js';

const dbPath = process.env.DB_PATH ?? DEFAULT_DB_PATH;

for (const suffix of ['', '-shm', '-wal']) {
  const file = `${dbPath}${suffix}`;
  if (existsSync(file)) rmSync(file);
}

const db = openDatabase(dbPath);
const seeded = seedIfEmpty(db);
db.close();

console.log(`[db:reset] ${dbPath} ${seeded ? '已重建并写入演示数据' : '已就绪'}`);
