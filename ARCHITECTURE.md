# 校园外卖平台 · 技术方案（ARCHITECTURE）

> 输入：`SPEC.md`、`PROTOTYPE_DECISIONS.md`
> 技术栈（已锁定，不得替换）：React 18 + TypeScript + Tailwind CSS + Vite ／ Express + TypeScript ／ SQLite

---

## 1. 约束与前置假设

| # | 约束/假设 | 影响 |
|---|---|---|
| C1 | 单机部署、单进程、无外部服务 | 不引入 Redis、消息队列、对象存储；会话与状态全部落 SQLite |
| C2 | 数据量级：档口 < 50，菜品 < 500，订单 < 10⁴ | 全表扫描可接受，仅对 `orders(user_id)`、`cart_items(user_id)` 建索引 |
| C3 | 运行环境 Node ≥ 22.5，可用内置 `node:sqlite` | 数据库驱动选型见 ADR-002 |
| C4 | 金额一律以「分」为整数存储与计算 | 杜绝浮点误差；前后端都不出现 `0.1 + 0.2` |
| C5 | 只有学生一个角色，登录仅校验学号 | 鉴权模型可保持极简，但**服务端必须校验订单归属** |

### 安全底线（作为实现的前置约束，不可协商）

1. 订单总额、配送费、折扣**只能**由服务端按数据库价格重算，忽略客户端任何金额字段（AC-07）。
2. 订单状态流转只走白名单，禁止跳步与逆向；状态推进由服务端按时间计算，客户端无权指定目标状态（AC-11/AC-12）。
3. 所有订单读写都带 `user_id` 归属校验，越权返回 403 而非 404 以外的任何信息泄露（AC-15）。
4. 取消窗口以服务端 `paid_at` 为准，不信任前端倒计时（AC-13/AC-14）。
5. 菜品可售状态在「加购」与「提交订单」两个时点各校验一次（AC-01/AC-09）。

---

## 2. 组件划分

```
┌───────────────────────────── client（浏览器） ─────────────────────────────┐
│  pages/      HomePage  StallPage  CheckoutPage  OrdersPage  OrderDetailPage │
│  components/ TopBar  StallIndex  DishRow  CartPanel  OrderTicket  Timeline  │
│  state/      AuthContext（token）   CartContext（服务端购物车镜像）           │
│  api/        fetch 封装：统一 Authorization、错误码映射、401 跳登录           │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ HTTP /api/*  (JSON)
┌───────────────────────────────────▼───────────────────────────────────────┐
│                           server（Express + TS）                           │
│  routes/    auth.ts  catalog.ts  cart.ts  orders.ts   ← 只做参数校验与装配   │
│  domain/    cartService.ts  orderService.ts  pricing.ts  statusMachine.ts  │
│             ↑ 业务规则的唯一实现处（可被单测直接调用，不依赖 Express）        │
│  db/        connection.ts  schema.sql  seed.ts        ← SQLite 与种子数据    │
│  http/      authMiddleware.ts  errorHandler.ts  errors.ts                   │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ better-sqlite3 风格同步 API（node:sqlite）
                              takeaway.db（文件 / 测试时为 :memory:）
```

**分层规则**：`routes` 不写业务判断，`domain` 不 import Express，`db` 不做业务判断。
这条规则使得「单元测试可以直接调用 domain」，「集成测试走 HTTP」，两者共用同一份规则实现。

---

## 3. 数据模型（ER）

```
users 1───n cart_items n───1 dishes n───1 stalls
  │                                            
  └──1───n orders 1───n order_items ──(快照)──> dishes 的历史价格
              │
              └──1───n order_status_logs
sessions n───1 users
```

### 表结构

```sql
users(id TEXT PK, student_no TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL)

stalls(id TEXT PK, name TEXT NOT NULL, zone TEXT NOT NULL, description TEXT,
       is_open INTEGER NOT NULL DEFAULT 1, prep_minutes INTEGER NOT NULL DEFAULT 8,
       sort INTEGER NOT NULL DEFAULT 0)

dishes(id TEXT PK, stall_id TEXT NOT NULL REFERENCES stalls(id), name TEXT NOT NULL,
       description TEXT, price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
       status TEXT NOT NULL CHECK(status IN ('on_sale','sold_out','off_shelf')),
       sort INTEGER NOT NULL DEFAULT 0)

cart_items(id TEXT PK, user_id TEXT NOT NULL REFERENCES users(id),
           dish_id TEXT NOT NULL REFERENCES dishes(id), qty INTEGER NOT NULL CHECK(qty > 0),
           created_at TEXT NOT NULL, UNIQUE(user_id, dish_id))

orders(id TEXT PK, code TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
       stall_id TEXT NOT NULL REFERENCES stalls(id), stall_name TEXT NOT NULL,
       status TEXT NOT NULL CHECK(status IN ('paid','preparing','ready','completed','cancelled')),
       items_total_cents INTEGER NOT NULL, delivery_fee_cents INTEGER NOT NULL,
       total_cents INTEGER NOT NULL, address TEXT NOT NULL, remark TEXT,
       paid_at TEXT NOT NULL, cancel_deadline TEXT NOT NULL, cancelled_at TEXT,
       created_at TEXT NOT NULL)

order_items(id TEXT PK, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            dish_id TEXT NOT NULL, name_snapshot TEXT NOT NULL,
            price_cents_snapshot INTEGER NOT NULL, qty INTEGER NOT NULL)

order_status_logs(id INTEGER PK AUTOINCREMENT, order_id TEXT NOT NULL, from_status TEXT,
                  to_status TEXT NOT NULL, at TEXT NOT NULL)

sessions(token TEXT PK, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_cart_user   ON cart_items(user_id);
```

**为什么 `order_items` 冗余菜名与单价**：SPEC R6。菜品改价后历史订单必须不变，因此订单不从 `dishes` 联表取价（AC-08）。
`orders.stall_name` 同理，避免档口改名污染历史订单。

---

## 4. API 契约

统一响应：成功 `200/201 { data }`；失败 `4xx { error: { code, message, details? } }`。
鉴权：`Authorization: Bearer <token>`。

| 方法 | 路径 | 鉴权 | 请求 | 响应 | 关键错误码 |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | - | `{ studentNo, name? }` | `{ token, user }` | `INVALID_STUDENT_NO` |
| POST | `/api/auth/logout` | ✔ | - | `{ ok: true }` | `UNAUTHENTICATED` |
| GET | `/api/auth/me` | ✔ | - | `{ user }` | `UNAUTHENTICATED` |
| GET | `/api/stalls` | - | `?keyword=&filter=open\|hasSoldOut` | `{ stalls: StallSummary[] }` | - |
| GET | `/api/stalls/:id` | - | - | `{ stall, dishes: Dish[] }` | `STALL_NOT_FOUND` |
| GET | `/api/cart` | ✔ | - | `CartView`（按档口分组的 items + totals + issues） | `UNAUTHENTICATED` |
| POST | `/api/cart/items` | ✔ | `{ dishId, qty }` | `CartView` | `DISH_NOT_FOUND` / `DISH_NOT_AVAILABLE` |
| PATCH | `/api/cart/items/:dishId` | ✔ | `{ qty }` | `CartView` | `CART_ITEM_NOT_FOUND` |
| DELETE | `/api/cart/items/:dishId` | ✔ | - | `CartView` | `CART_ITEM_NOT_FOUND` |
| DELETE | `/api/cart` | ✔ | - | `CartView` | - |
| POST | `/api/orders` | ✔ | `{ address, remark? }` | `{ orders: OrderDetail[] }` | `ADDRESS_REQUIRED` / `CART_EMPTY` / `CART_HAS_UNAVAILABLE_DISH` |
| GET | `/api/orders` | ✔ | - | `{ orders: OrderSummary[] }` | `UNAUTHENTICATED` |
| GET | `/api/orders/:id` | ✔ | - | `{ order: OrderDetail }` | `ORDER_NOT_FOUND` / `FORBIDDEN_ORDER` |
| POST | `/api/orders/:id/cancel` | ✔ | - | `{ order }` | `FORBIDDEN_ORDER` / `CANCEL_WINDOW_CLOSED` / `ORDER_NOT_CANCELLABLE` |

数据结构（节选）：

```ts
type OrderStatus = 'paid' | 'preparing' | 'ready' | 'completed' | 'cancelled';

interface OrderDetail {
  id: string; code: string; stallId: string; stallName: string;
  status: OrderStatus;
  itemsTotalCents: number; deliveryFeeCents: number; totalCents: number;
  address: string; remark: string | null;
  paidAt: string; cancelDeadline: string;  // ISO
  cancellable: boolean;                    // 服务端算好的结论，前端不自行推断
  items: { dishId: string; name: string; priceCents: number; qty: number }[];
  timeline: { status: OrderStatus; at: string | null }[];
  freeDeliveryThresholdCents: number;
}
```

`cancellable` 由服务端返回，避免「前端以为能取消、服务端拒绝」的错位（页面按钮仍以服务端结论为准）。

---

## 5. 关键流程

### 5.1 提交订单（跨档口拆单）

```
Client                     Express                 domain/orderService          SQLite
  │ POST /api/orders         │                            │                        │
  │ {address, remark}        │                            │                        │
  ├─────────────────────────►│ 校验登录 / 地址非空          │                        │
  │                          ├───────────────────────────►│ 事务开始                │
  │                          │                            ├───────────────────────►│ 读 cart_items+dish
  │                          │                            │ 空车? → CART_EMPTY      │
  │                          │                            │ 任一菜品不可售? → 409    │
  │                          │                            │ 按 stallId 分组         │
  │                          │                            │ 每组：Σ(单价×数量)       │
  │                          │                            │   配送费 = 满20免/否则1  │
  │                          │                            │   写 orders + items(快照)│
  │                          │                            │   写 status_log(paid)   │
  │                          │                            │ 清空已下单 cart_items    │
  │                          │◄───────────────────────────┤ 提交事务                │
  │◄─────────────────────────┤ 201 { orders }             │                        │
```

幂等性：同一请求重放时，第一次已清空购物车，第二次必然 `CART_EMPTY` 失败，不会产生重复订单。

### 5.2 状态推进（读时收敛，无定时器）

```
paid  --(paid_at+25s)-->  preparing  --(+75s)-->  ready  --(+180s)-->  completed
  └──(用户取消，< 25s)──>  cancelled
```

每次读取订单前调用 `syncStatus(order)`：从当前状态出发，**逐级**判断是否到达下一级的时间阈值，每跨越一级写一条 `order_status_logs` 并更新 `orders.status`。逐级推进天然满足「不可跳步」。

时间阈值集中在 `domain/statusMachine.ts` 一处（`CANCEL_WINDOW_MS = 25_000`，`PREPARING_AT = 25_000`，`READY_AT = 75_000`，`COMPLETED_AT = 180_000`），测试通过注入 `now()` 控制。

### 5.3 鉴权

登录 → 生成 `randomUUID()` token 写入 `sessions` → 前端存 `localStorage` → 每次请求带 Bearer → 中间件查库得 `user`，失败 401。

---

## 6. 架构决策记录（ADR）

### ADR-001 采用前后端分离 + 单仓库双包（npm workspaces）

- **背景**：需要 PC Web 前端与独立后端，课程要求 TypeScript 全栈。
- **备选**：(a) Next.js 一体化；(b) Vite + Express 分离；(c) 纯静态 + mock。
- **决策**：选 (b)，根 `package.json` 用 workspaces 管理 `client`、`server`，`npm run dev` 并发启动。
- **取舍**：多一个构建配置与代理配置；换来前后端依赖隔离、后端可被集成测试独立启动（测试不需要浏览器）。
- **影响**：Vite dev 需 `/api` 代理到 5174；生产由 Express 托管 `client/dist`（可选，不阻塞验收）。

### ADR-002 SQLite 驱动使用 Node 内置 `node:sqlite`，不引入 `better-sqlite3`

- **背景**：`better-sqlite3` 需要编译原生模块，Windows + 非标准 Node 环境下安装失败率高。
- **备选**：(a) `better-sqlite3`；(b) `sqlite3`（异步回调 API）；(c) `node:sqlite`（Node ≥ 22.5 内置）；(d) `sql.js`（WASM，非真正落盘）。
- **决策**：选 (c)。API 与 `better-sqlite3` 同为同步风格（`DatabaseSync` + `prepare().run/all/get`），改动成本极低，且零依赖、零编译。
- **取舍**：仍标记为 experimental（启动时有 ExperimentalWarning）；不提供 `db.transaction()` 语法糖，需自行 `BEGIN/COMMIT/ROLLBACK` 封装。
- **影响**：`package.json` 约束 `engines.node >= 22.5`；`db/connection.ts` 提供 `withTransaction(fn)` 补上缺失的事务封装。
- **风险与兜底**：若目标环境 Node < 22.5，替换为 `better-sqlite3` 只需改 `connection.ts` 一个文件（domain 层不感知驱动）。

### ADR-003 允许跨档口加购，提交时按档口拆单

- **背景**：SPEC Q1。主流外卖按「一单一店」，但校园美食城的档口物理相邻，学生常一次买两家的主食与饮品。
- **备选**：(a) 一单一店，加购他店时提示清空；(b) 跨店加购、拆单；(c) 跨店加购、合并为一单。
- **决策**：选 (b)。配送费与出餐进度天然以档口为单位，拆单后订单状态互不干扰。
- **取舍**：一笔提交产生 N 笔订单，前端需按档口分组呈现结果；取消也需逐单进行。
- **影响**：`orders.stall_id/stall_name` 为订单级字段而非明细级；配送费按档口计而非按整单计。

### ADR-004 订单状态用「读时收敛」而非定时器

- **背景**：需要「25 秒后自动进入备餐中」的效果。
- **备选**：(a) `setInterval` 轮询扫表；(b) 每个订单一个 `setTimeout`；(c) 读时按时间戳计算并落库。
- **决策**：选 (c)。无后台任务、进程重启不丢状态、测试可注入时间。
- **取舍**：没有请求时数据库中的状态是「过期」的；但对学生端而言不存在无人访问却需要状态正确的场景。
- **影响**：所有订单读取路径（列表/详情/取消/报告）都必须先 `syncStatus`，这条规则写入 `CODEBUDDY.md`。

### ADR-005 购物车持久化在服务端而非 localStorage

- **背景**：跨页面保留选择，且下单时服务端必须重新校验可售状态。
- **决策**：服务端表 `cart_items`，前端只做镜像与乐观更新失败回滚。
- **取舍**：每次加减购都走一次网络；换取「加购与下单使用同一份数据源」，规避前端购物车与服务端不一致。

---

## 7. 前端结构

| 关注点 | 方案 |
|---|---|
| 路由 | `react-router-dom` v6：`/login`、`/`（含档口详情内联切换）、`/checkout`、`/orders`、`/orders/:id` |
| 服务端状态 | 轻量：`useState` + `api` 封装；购物车用 `CartContext` 持有服务端返回的 `CartView`，任何加减购直接用响应替换（不做本地累加） |
| 鉴权 | `AuthContext` 持有 token 与 user，401 时清 token 并跳 `/login` |
| 样式 | Tailwind 自定义主题色（DOSE token），`tailwind.config.js` 内定义 `paper/ink/accent/tint-*`；字体走 `@font-face`（Google Fonts CDN，失败时回退系统字体） |
| 可访问性 | 所有按钮 `type="button"`，禁用态带 `aria-disabled`，倒计时用 `aria-live="off"` 避免读屏焦虑 |

---

## 8. 验证策略（前置定义，实现后不得修改结论）

| 层级 | 覆盖 | 运行命令 |
|---|---|---|
| 单元 | 状态机不可跳步/不可逆向、定价与配送费、可售校验 | `npm test -w server` |
| 集成 | 真实 HTTP + 真实 SQLite（`:memory:`）：拆单、重算、快照、清车、越权、取消窗口 | `npm test -w server` |
| E2E | 真实进程 + 真实 SQLite 文件：跨店加购 → 提交 → 查看订单 → 取消 | `npm run test:e2e` |
| 静态 | `tsc --noEmit`、ESLint、`vite build` | `npm run verify` |

**测试不得失真**：断言由 SPEC 的 AC 编号驱动；E2E 不允许 mock 数据库；每条 AC 在 `TEST-REPORT.md` 中标注「通过 / 失败 / 未测」及证据。

---

## 9. 已知缺口（明确不在本期解决）

1. 无并发压测与连接池治理（单进程同步驱动，写操作串行）。
2. 无审计日志与操作追踪（除 `order_status_logs`）。
3. Token 无过期时间与刷新机制，登出仅删库记录。
4. 无图片资源与 CDN，菜品以图标与配色区分。
