import type { Db } from '../db/connection.js';
import { queryAll, queryOne } from '../db/connection.js';
import { AppError } from '../errors.js';
import type { DishRow, DishView, StallRow, StallSummary } from './types.js';

interface StallAggRow extends StallRow {
  dish_count: number;
  available_count: number;
  sold_out_count: number;
  min_price_cents: number | null;
}

const STALL_BASE_SQL = `
  SELECT s.id, s.name, s.zone, s.description, s.is_open, s.prep_minutes, s.sort,
         COUNT(d.id) AS dish_count,
         COALESCE(SUM(CASE WHEN d.status = 'on_sale' THEN 1 ELSE 0 END), 0) AS available_count,
         COALESCE(SUM(CASE WHEN d.status = 'sold_out' THEN 1 ELSE 0 END), 0) AS sold_out_count,
         MIN(CASE WHEN d.status = 'on_sale' THEN d.price_cents END) AS min_price_cents
  FROM stalls s
  LEFT JOIN dishes d ON d.stall_id = s.id
`;

export interface ListStallsOptions {
  keyword?: string;
  filter?: 'all' | 'open' | 'hasSoldOut';
}

export function listStalls(db: Db, options: ListStallsOptions = {}): StallSummary[] {
  const keyword = options.keyword?.trim() ?? '';
  const filter = options.filter ?? 'all';

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (keyword) {
    conditions.push(
      `(s.name LIKE ? OR s.zone LIKE ? OR EXISTS (
         SELECT 1 FROM dishes sd WHERE sd.stall_id = s.id AND sd.name LIKE ?
       ))`,
    );
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  if (filter === 'open') {
    conditions.push('s.is_open = 1');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const having = filter === 'hasSoldOut' ? 'HAVING sold_out_count > 0' : '';

  const rows = queryAll<StallAggRow>(
    db,
    `${STALL_BASE_SQL} ${where} GROUP BY s.id ${having} ORDER BY s.sort ASC`,
    ...params,
  );

  return rows.map(toStallSummary);
}

export function getStallSummary(db: Db, stallId: string): StallSummary {
  const row = queryOne<StallAggRow>(
    db,
    `${STALL_BASE_SQL} WHERE s.id = ? GROUP BY s.id`,
    stallId,
  );
  if (!row) throw new AppError('STALL_NOT_FOUND', '档口不存在', 404, { stallId });
  return toStallSummary(row);
}

export function listDishesByStall(db: Db, stallId: string): DishView[] {
  const rows = queryAll<DishRow>(
    db,
    'SELECT * FROM dishes WHERE stall_id = ? ORDER BY sort ASC',
    stallId,
  );
  return rows.map(toDishView);
}

export function getDish(db: Db, dishId: string): DishView {
  const row = queryOne<DishRow>(db, 'SELECT * FROM dishes WHERE id = ?', dishId);
  if (!row) throw new AppError('DISH_NOT_FOUND', '菜品不存在', 404, { dishId });
  return toDishView(row);
}

export function toDishView(row: DishRow): DishView {
  return {
    id: row.id,
    stallId: row.stall_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    status: row.status,
    available: row.status === 'on_sale',
  };
}

function toStallSummary(row: StallAggRow): StallSummary {
  return {
    id: row.id,
    name: row.name,
    zone: row.zone,
    description: row.description,
    isOpen: row.is_open === 1,
    prepMinutes: row.prep_minutes,
    dishCount: row.dish_count,
    availableCount: row.available_count,
    soldOutCount: row.sold_out_count,
    minPriceCents: row.min_price_cents,
  };
}
