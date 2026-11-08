import { Router } from 'express';
import type { Db } from '../db/connection.js';
import {
  getStallSummary,
  listDishesByStall,
  listStalls,
} from '../domain/catalogService.js';
import { optionalEnum } from '../http/parse.js';

export function catalogRoutes(db: Db): Router {
  const router = Router();

  router.get('/stalls', (req, res) => {
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : '';
    const filter = optionalEnum(req.query.filter, 'filter', ['all', 'open', 'hasSoldOut'] as const);
    const stalls = listStalls(db, { keyword, filter: filter ?? 'all' });
    res.json({ data: { stalls } });
  });

  router.get('/stalls/:id', (req, res) => {
    const stallId = req.params.id;
    const stall = getStallSummary(db, stallId);
    const dishes = listDishesByStall(db, stallId);
    res.json({ data: { stall, dishes } });
  });

  return router;
}
