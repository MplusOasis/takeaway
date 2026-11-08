import { randomUUID } from 'node:crypto';
import type { Db } from '../db/connection.js';
import { execute, queryOne } from '../db/connection.js';
import { AppError } from '../errors.js';

export interface SessionUser {
  id: string;
  studentNo: string;
  name: string;
}

interface UserJoinRow {
  id: string;
  student_no: string;
  name: string;
}

const STUDENT_NO_PATTERN = /^\d{6,12}$/;

/**
 * 学号登录：首次登录自动建档（SPEC Non-Goals 第 6 条）。
 * 不校验密码，这是本课程的简化约定，不是可上线的鉴权方案。
 */
export function login(db: Db, rawStudentNo: unknown, rawName: unknown): {
  token: string;
  user: SessionUser;
} {
  const studentNo = typeof rawStudentNo === 'string' ? rawStudentNo.trim() : '';
  if (!STUDENT_NO_PATTERN.test(studentNo)) {
    throw new AppError('INVALID_STUDENT_NO', '请输入 6~12 位数字学号', 400);
  }

  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 20) : '';

  let row = queryOne<UserJoinRow>(
    db,
    'SELECT id, student_no, name FROM users WHERE student_no = ?',
    studentNo,
  );

  if (!row) {
    const id = `u-${randomUUID().slice(0, 8)}`;
    const finalName = name || `同学${studentNo.slice(-4)}`;
    execute(
      db,
      'INSERT INTO users (id, student_no, name, created_at) VALUES (?, ?, ?, ?)',
      id,
      studentNo,
      finalName,
      new Date().toISOString(),
    );
    row = { id, student_no: studentNo, name: finalName };
  }

  const token = randomUUID();
  execute(
    db,
    'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)',
    token,
    row.id,
    new Date().toISOString(),
  );

  return { token, user: { id: row.id, studentNo: row.student_no, name: row.name } };
}

export function getUserByToken(db: Db, token: string): SessionUser | null {
  const row = queryOne<UserJoinRow>(
    db,
    `SELECT u.id, u.student_no, u.name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    token,
  );
  if (!row) return null;
  return { id: row.id, studentNo: row.student_no, name: row.name };
}

export function logout(db: Db, token: string): void {
  execute(db, 'DELETE FROM sessions WHERE token = ?', token);
}
