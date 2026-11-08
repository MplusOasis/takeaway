import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync as DatabaseSyncInstance } from 'node:sqlite';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * `node:sqlite` 是 Node 22 的实验性内置模块，部分打包器（Vite 5 的 builtins 列表）不认识
 * `node:` 前缀会尝试当成三方包解析。这里用运行时查找拿到它，既避免打包期解析，
 * 也保持与静态 import 一致的运行时行为。
 */
const sqlite = process.getBuiltinModule('node:sqlite') as {
  DatabaseSync: new (path: string) => DatabaseSyncInstance;
};

export type Db = DatabaseSyncInstance;

/** SQLite 允许绑定的标量类型 */
export type SqlParam = string | number | bigint | null | Uint8Array;

const SCHEMA = readFileSync(join(here, 'schema.sql'), 'utf8');

/**
 * 打开数据库并保证表结构就绪。
 * 内存库（':memory:'）用于测试，不创建目录。
 */
export function openDatabase(dbPath: string): Db {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new sqlite.DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/**
 * node:sqlite 未提供 better-sqlite3 的 transaction() 语法糖，这里补一个。
 * 任何多写操作（下单、取消）必须通过它执行，保证原子性。
 */
export function withTransaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // 回滚失败时保留原始错误，交由上层记录
    }
    throw error;
  }
}

export function queryAll<T>(db: Db, sql: string, ...params: SqlParam[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function queryOne<T>(db: Db, sql: string, ...params: SqlParam[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function execute(db: Db, sql: string, ...params: SqlParam[]): void {
  db.prepare(sql).run(...params);
}
