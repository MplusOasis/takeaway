# 实施计划（PLAN）

> 拆分原则：**纵向切片**。每个任务从页面打通到数据库，单次会话可完成，且自带验证命令。
> 每个任务 = 一份任务契约：交付物 / 允许修改的文件 / 不做什么 / 验证命令。

## 全局约束（对每个任务生效）

- 技术栈不可替换：React 18 + TS + Tailwind + Vite ／ Express + TS ／ SQLite（`node:sqlite`）。
- 金额只用整数「分」；禁止 `any`；禁止在 `routes` 里写业务判断。
- 订单总额只由服务端计算；客户端传来的 `totalCents` 一律忽略。
- 禁止改动 `SPEC.md`、`ARCHITECTURE.md` 的验收结论（发现问题记入 `REVIEW.md`，不自行放宽）。
- 不安装与本任务无关的依赖。

---

## T1 · 工程骨架与质量门禁

| 项 | 内容 |
|---|---|
| 交付物 | 根 `package.json`（workspaces）、`tsconfig.base.json`、`eslint.config.js`、`.gitignore`、`client/` 与 `server/` 的空壳可启动 |
| 允许修改 | `package.json`、`tsconfig*.json`、`eslint.config.js`、`.gitignore`、`client/{package.json,index.html,vite.config.ts,tsconfig.json,tailwind.config.js,postcss.config.js,src/main.tsx,src/index.css}`、`server/{package.json,tsconfig.json,src/index.ts}` |
| 不做什么 | 不写业务逻辑，不建数据库表，不做页面布局 |
| 验证 | `npm run verify`（tsc + eslint）通过；`npm run dev` 能同时起 5173/5174 |

## T2 · 数据层与种子数据

| 项 | 内容 |
|---|---|
| 交付物 | `server/src/db/connection.ts`（含 `withTransaction`）、`schema.sql`、`seed.ts`（6 档口 / 24 菜品 / 2 学生）、`server/src/index.ts` 启动时自动迁移与种子 |
| 允许修改 | `server/src/db/**`、`server/src/index.ts` |
| 不做什么 | 不写路由；不写定价逻辑；不引入 ORM |
| 验证 | `npm run db:reset -w server` 后 `sqlite` 表存在且 `stalls` 计数为 6；`npm test -w server -- db` 通过 |

## T3 · 鉴权与目录接口（纵向：登录 → 首页数据）

| 项 | 内容 |
|---|---|
| 交付物 | `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`；`GET /api/stalls`、`GET /api/stalls/:id`；`authMiddleware`、`errorHandler`、`AppError` |
| 允许修改 | `server/src/http/**`、`server/src/routes/auth.ts`、`server/src/routes/catalog.ts`、`server/src/app.ts`、`server/src/index.ts` |
| 不做什么 | 不做注册/密码/找回；不返回菜品成本字段；不做分页 |
| 验证 | `npm test -w server -- auth catalog` 通过（AC-16 覆盖） |

## T4 · 购物车（纵向：加购 → 购物车视图）

| 项 | 内容 |
|---|---|
| 交付物 | `domain/cartService.ts`（加购/改量/删除/清空/分组视图）；`routes/cart.ts` |
| 允许修改 | `server/src/domain/cartService.ts`、`server/src/domain/pricing.ts`、`server/src/routes/cart.ts`、`server/src/app.ts` |
| 不做什么 | 不在加购时锁定库存；不做「猜你喜欢」；不合并不同用户的购物车 |
| 验证 | `npm test -w server -- cart` 通过（AC-01/02/03/04） |

## T5 · 下单与订单状态（纵向：结算 → 订单）

| 项 | 内容 |
|---|---|
| 交付物 | `domain/pricing.ts`（配送费与总额）、`domain/statusMachine.ts`、`domain/orderService.ts`（拆单、快照、清车、取消、读时收敛）、`routes/orders.ts` |
| 允许修改 | `server/src/domain/**`、`server/src/routes/orders.ts`、`server/src/app.ts` |
| 不做什么 | 不接真实支付；不做退款；不做部分取消；不实现「修改订单」 |
| 验证 | `npm test -w server -- orders` 通过（AC-05 ~ AC-15） |

## T6 · 前端外壳与视觉主题（纵向：登录 → 首页可点）

| 项 | 内容 |
|---|---|
| 交付物 | Tailwind DOSE 主题（`paper/ink/accent/tint`、字体、纸纹与塑料质感 class）、`TopBar`、`AuthContext`、`api/client.ts`、`LoginPage` |
| 允许修改 | `client/src/index.css`、`client/tailwind.config.js`、`client/src/{main.tsx,App.tsx}`、`client/src/api/**`、`client/src/state/**`、`client/src/components/{TopBar,Button,Field}.tsx`、`client/src/pages/LoginPage.tsx` |
| 不做什么 | 不引入 UI 组件库；不做移动端适配；不使用紫色渐变/Inter 默认组合 |
| 验证 | `npm run build -w client` 通过；登录后进入首页且 token 持久化 |

## T7 · 首页工作台与档口详情（纵向：看菜 → 加购）

| 项 | 内容 |
|---|---|
| 交付物 | `HomePage`（左档口索引 / 中菜品 / 右购物车三栏）、`StallIndex`、`DishRow`、`CartPanel`、`CartContext`、售罄与下架禁用态 |
| 允许修改 | `client/src/pages/HomePage.tsx`、`client/src/components/{StallIndex,DishRow,CartPanel,StallHeader}.tsx`、`client/src/state/CartContext.tsx`、`client/src/App.tsx` |
| 不做什么 | 不做无限滚动、不做单品瀑布流、不做图片上传 |
| 验证 | `npm run build -w client` 通过；售罄菜品按钮 disabled（AC-17） |

## T8 · 结算与订单页（纵向：提交 → 跟踪 → 取消）

| 项 | 内容 |
|---|---|
| 交付物 | `CheckoutPage`（地址必填校验、按档口分组账单）、`OrdersPage`、`OrderDetailPage`（状态时间线 + 服务端驱动的取消倒计时） |
| 允许修改 | `client/src/pages/{CheckoutPage,OrdersPage,OrderDetailPage}.tsx`、`client/src/components/{OrderTicket,StatusTimeline,Countdown}.tsx`、`client/src/App.tsx` |
| 不做什么 | 不在前端计算金额；不做订单编辑；不做消息通知 |
| 验证 | `npm run build -w client` 通过；地址为空时不发起请求（AC-18） |

## T9 · 测试与验收

| 项 | 内容 |
|---|---|
| 交付物 | 单元测试（状态机/定价/可售）、集成测试（HTTP + SQLite）、E2E（真实进程 + 真实库）、`TEST-REPORT.md`、`REVIEW.md`、`docs/project-map.html` |
| 允许修改 | `server/tests/**`、`e2e/**`、`*.md`、`docs/**` |
| 不做什么 | 不为了让测试变绿而删除用例或放宽断言；不 mock 数据库；不修改被测业务代码来迁就测试 |
| 验证 | `npm run verify && npm test -w server && npm run test:e2e` 全部通过，输出贴入 `TEST-REPORT.md` |

---

## 执行顺序与依赖

```
T1 ─► T2 ─► T3 ─┬─► T4 ─► T5 ─┐
                │             ├─► T9
      T6 ─► T7 ─┴─► T8 ───────┘
```

T4/T5 与 T6/T7 之间无文件交集，可并行；但 T7 依赖 T4 的响应结构（`CartView`），因此契约以 `ARCHITECTURE.md` 第 4 节为准，先定契约再并行。

## 完成定义（DoD）

1. 每个 P0 需求都有对应 AC，且 AC 在 `TEST-REPORT.md` 中有「通过/失败/未测」三态结论与证据。
2. `npm run verify`、`npm test -w server`、`npm run test:e2e` 三条命令全部退出码为 0。
3. `REVIEW.md` 中的高危问题已修复并留下复核记录，未修复的写明原因。
