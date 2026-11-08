import { Router } from 'express';
import type { Db } from '../db/connection.js';
import { login, logout } from '../domain/authService.js';
import { currentUser, requireAuth } from '../http/authMiddleware.js';
import { body } from '../http/parse.js';

export function authRoutes(db: Db): Router {
  const router = Router();

  router.post('/login', (req, res) => {
    const payload = body(req);
    const result = login(db, payload.studentNo, payload.name);
    res.status(201).json({ data: result });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ data: { user: currentUser(req) } });
  });

  router.post('/logout', (req, res) => {
    if (req.token) logout(db, req.token);
    res.json({ data: { ok: true } });
  });

  return router;
}
