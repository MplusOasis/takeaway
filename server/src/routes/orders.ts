import { Router } from 'express';
import type { Db } from '../db/connection.js';
import {
  cancelOrder,
  createOrders,
  getOrder,
  listOrders,
} from '../domain/orderService.js';
import { currentUser, requireAuth } from '../http/authMiddleware.js';
import { body, optionalString } from '../http/parse.js';

export function orderRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/', (req, res) => {
    const payload = body(req);
    // 地址是否「填了」由 domain 判定（空白字符要统一返回 ADDRESS_REQUIRED，见 SPEC AC-05）
    const address = typeof payload.address === 'string' ? payload.address : '';
    // 注意：请求体里的任何金额字段都被忽略（SPEC AC-07）
    const orders = createOrders(db, currentUser(req).id, {
      address,
      remark: optionalString(payload.remark, 'remark') ?? null,
    });
    res.status(201).json({ data: { orders } });
  });

  router.get('/', (req, res) => {
    res.json({ data: { orders: listOrders(db, currentUser(req).id) } });
  });

  router.get('/:id', (req, res) => {
    const order = getOrder(db, currentUser(req).id, req.params.id);
    res.json({ data: { order } });
  });

  router.post('/:id/cancel', (req, res) => {
    const order = cancelOrder(db, currentUser(req).id, req.params.id);
    res.json({ data: { order } });
  });

  return router;
}
