import { Router } from 'express';
import type { Db } from '../db/connection.js';
import {
  addItem,
  clearCart,
  getCart,
  removeItem,
  updateItemQty,
} from '../domain/cartService.js';
import { currentUser, requireAuth } from '../http/authMiddleware.js';
import { body, requiredInt, requiredString } from '../http/parse.js';

export function cartRoutes(db: Db): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json({ data: { cart: getCart(db, currentUser(req).id) } });
  });

  router.post('/items', (req, res) => {
    const payload = body(req);
    const dishId = requiredString(payload.dishId, 'dishId');
    const qty = requiredInt(payload.qty ?? 1, 'qty');
    const cart = addItem(db, currentUser(req).id, dishId, qty);
    res.status(201).json({ data: { cart } });
  });

  router.patch('/items/:dishId', (req, res) => {
    const payload = body(req);
    const qty = requiredInt(payload.qty, 'qty');
    const cart = updateItemQty(db, currentUser(req).id, req.params.dishId, qty);
    res.json({ data: { cart } });
  });

  router.delete('/items/:dishId', (req, res) => {
    const cart = removeItem(db, currentUser(req).id, req.params.dishId);
    res.json({ data: { cart } });
  });

  router.delete('/', (req, res) => {
    res.json({ data: { cart: clearCart(db, currentUser(req).id) } });
  });

  return router;
}
