import cors from 'cors';
import express, { type Express } from 'express';
import type { Db } from './db/connection.js';
import { attachUser } from './http/authMiddleware.js';
import { errorHandler, notFoundHandler } from './http/errorHandler.js';
import { authRoutes } from './routes/auth.js';
import { cartRoutes } from './routes/cart.js';
import { catalogRoutes } from './routes/catalog.js';
import { orderRoutes } from './routes/orders.js';

/**
 * 组装 Express 应用。db 由调用方注入，便于测试用 :memory: 库替换。
 */
export function createApp(db: Db): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(attachUser(db));

  app.get('/api/health', (_req, res) => {
    res.json({ data: { ok: true, time: new Date().toISOString() } });
  });

  app.use('/api/auth', authRoutes(db));
  app.use('/api', catalogRoutes(db));
  app.use('/api/cart', cartRoutes(db));
  app.use('/api/orders', orderRoutes(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
