import type { Db } from './connection.js';
import { execute, queryOne } from './connection.js';

interface StallSeed {
  id: string;
  name: string;
  zone: string;
  description: string;
  isOpen: number;
  prepMinutes: number;
  sort: number;
}

interface DishSeed {
  id: string;
  stallId: string;
  name: string;
  description: string;
  priceCents: number;
  status: 'on_sale' | 'sold_out' | 'off_shelf';
  sort: number;
}

interface UserSeed {
  id: string;
  studentNo: string;
  name: string;
}

const STALLS: StallSeed[] = [
  {
    id: 'st-chuan',
    name: '川味小炒',
    zone: '一食堂 · 二层 12 号窗',
    description: '现炒现出锅，辣度可备注',
    isOpen: 1,
    prepMinutes: 8,
    sort: 1,
  },
  {
    id: 'st-noodle',
    name: '面点档',
    zone: '二食堂 · 一层 3 号窗',
    description: '手工面与现包包子，出餐最快',
    isOpen: 1,
    prepMinutes: 5,
    sort: 2,
  },
  {
    id: 'st-casserole',
    name: '砂锅居',
    zone: '一食堂 · 一层 7 号窗',
    description: '一锅一焖，量大管饱',
    isOpen: 1,
    prepMinutes: 12,
    sort: 3,
  },
  {
    id: 'st-salad',
    name: '轻食沙拉',
    zone: '三食堂 · 一层 2 号窗',
    description: '现拌轻食，酱汁另装',
    isOpen: 1,
    prepMinutes: 6,
    sort: 4,
  },
  {
    id: 'st-braise',
    name: '卤味小站',
    zone: '二食堂 · 二层 9 号窗',
    description: '老卤现捞，按份称重',
    isOpen: 1,
    prepMinutes: 4,
    sort: 5,
  },
  {
    id: 'st-drink',
    name: '茶饮铺',
    zone: '三食堂 · 二层 1 号窗',
    description: '现泡茶底，少冰可备注',
    isOpen: 0,
    prepMinutes: 3,
    sort: 6,
  },
];

const DISHES: DishSeed[] = [
  // 川味小炒
  { id: 'd-chuan-1', stallId: 'st-chuan', name: '宫保鸡丁', description: '花生米另装，微辣', priceCents: 1600, status: 'on_sale', sort: 1 },
  { id: 'd-chuan-2', stallId: 'st-chuan', name: '麻辣香锅', description: '自选配菜，中辣', priceCents: 1800, status: 'sold_out', sort: 2 },
  { id: 'd-chuan-3', stallId: 'st-chuan', name: '番茄炒蛋', description: '番茄熬足 20 分钟', priceCents: 900, status: 'on_sale', sort: 3 },
  { id: 'd-chuan-4', stallId: 'st-chuan', name: '回锅肉', description: '二刀肉配蒜苗', priceCents: 1700, status: 'off_shelf', sort: 4 },
  // 面点档
  { id: 'd-noodle-1', stallId: 'st-noodle', name: '阳春面', description: '清汤猪油，可加葱', priceCents: 600, status: 'on_sale', sort: 1 },
  { id: 'd-noodle-2', stallId: 'st-noodle', name: '鲜肉包', description: '一笼两只', priceCents: 300, status: 'on_sale', sort: 2 },
  { id: 'd-noodle-3', stallId: 'st-noodle', name: '牛肉面', description: '牛骨汤底，牛肉三片', priceCents: 1400, status: 'on_sale', sort: 3 },
  { id: 'd-noodle-4', stallId: 'st-noodle', name: '葱油拌面', description: '现熬葱油', priceCents: 800, status: 'on_sale', sort: 4 },
  // 砂锅居
  { id: 'd-cass-1', stallId: 'st-casserole', name: '黄焖鸡米饭', description: '配米饭一碗', priceCents: 1800, status: 'on_sale', sort: 1 },
  { id: 'd-cass-2', stallId: 'st-casserole', name: '砂锅粥', description: '两人份', priceCents: 1200, status: 'sold_out', sort: 2 },
  { id: 'd-cass-3', stallId: 'st-casserole', name: '梅菜扣肉饭', description: '带一份青菜', priceCents: 1600, status: 'on_sale', sort: 3 },
  { id: 'd-cass-4', stallId: 'st-casserole', name: '酸菜鱼', description: '黑鱼片，微辣', priceCents: 2200, status: 'on_sale', sort: 4 },
  // 轻食沙拉
  { id: 'd-salad-1', stallId: 'st-salad', name: '鸡胸沙拉', description: '油醋汁另装', priceCents: 1500, status: 'on_sale', sort: 1 },
  { id: 'd-salad-2', stallId: 'st-salad', name: '牛油果沙拉', description: '半颗牛油果', priceCents: 1900, status: 'on_sale', sort: 2 },
  { id: 'd-salad-3', stallId: 'st-salad', name: '藜麦碗', description: '配烤南瓜', priceCents: 1700, status: 'on_sale', sort: 3 },
  { id: 'd-salad-4', stallId: 'st-salad', name: '全麦三明治', description: '现做现切', priceCents: 1100, status: 'on_sale', sort: 4 },
  // 卤味小站
  { id: 'd-braise-1', stallId: 'st-braise', name: '卤鸡腿', description: '老卤浸泡 4 小时', priceCents: 700, status: 'on_sale', sort: 1 },
  { id: 'd-braise-2', stallId: 'st-braise', name: '卤蛋', description: '一只', priceCents: 200, status: 'on_sale', sort: 2 },
  { id: 'd-braise-3', stallId: 'st-braise', name: '卤豆干', description: '三块一份', priceCents: 400, status: 'on_sale', sort: 3 },
  { id: 'd-braise-4', stallId: 'st-braise', name: '卤鸭翅', description: '两只', priceCents: 900, status: 'off_shelf', sort: 4 },
  // 茶饮铺
  { id: 'd-drink-1', stallId: 'st-drink', name: '柠檬茶', description: '手打鸭屎香', priceCents: 800, status: 'on_sale', sort: 1 },
  { id: 'd-drink-2', stallId: 'st-drink', name: '豆浆', description: '现磨，无糖可选', priceCents: 300, status: 'on_sale', sort: 2 },
  { id: 'd-drink-3', stallId: 'st-drink', name: '奶茶', description: '阿萨姆茶底', priceCents: 1000, status: 'sold_out', sort: 3 },
  { id: 'd-drink-4', stallId: 'st-drink', name: '冰美式', description: '双份浓缩', priceCents: 900, status: 'on_sale', sort: 4 },
];

const USERS: UserSeed[] = [
  { id: 'u-lin', studentNo: '2021001', name: '林可' },
  { id: 'u-zhou', studentNo: '2021002', name: '周小满' },
];

/**
 * 写入演示数据。幂等：已有档口时直接返回，不会重复插入。
 */
export function seedIfEmpty(db: Db): boolean {
  const existing = queryOne<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM stalls');
  if (existing && existing.count > 0) return false;

  const now = new Date().toISOString();
  for (const stall of STALLS) {
    execute(
      db,
      `INSERT INTO stalls (id, name, zone, description, is_open, prep_minutes, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      stall.id,
      stall.name,
      stall.zone,
      stall.description,
      stall.isOpen,
      stall.prepMinutes,
      stall.sort,
    );
  }
  for (const dish of DISHES) {
    execute(
      db,
      `INSERT INTO dishes (id, stall_id, name, description, price_cents, status, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      dish.id,
      dish.stallId,
      dish.name,
      dish.description,
      dish.priceCents,
      dish.status,
      dish.sort,
    );
  }
  for (const user of USERS) {
    execute(
      db,
      'INSERT INTO users (id, student_no, name, created_at) VALUES (?, ?, ?, ?)',
      user.id,
      user.studentNo,
      user.name,
      now,
    );
  }
  return true;
}

export const SEED_STALL_COUNT = STALLS.length;
export const SEED_DISH_COUNT = DISHES.length;
