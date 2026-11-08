# 代码 Review 报告（REVIEW）

> 审查方式：**独立复审**——只依据 `SPEC.md`／`ARCHITECTURE.md`／测试结果与源码本身，不参考编码时的思路叙述。
> 每条意见附文件路径与行号；结论分「已修复」与「未修复（需人决策）」两类。
> 审查日期：2026-11-08 ｜ 审查基线：`npm run verify`、70 条自动化测试、10 条浏览器级检查全部通过之后。

---

## 1. 结论摘要

| 维度 | 结论 |
|---|---|
| 规格一致性 | 18 条验收标准全部有对应断言，未发现「实现了但没写进 SPEC」的越界功能 |
| 安全底线 | 三条（总价服务端重算 / 状态不可跳步 / 越权拦截）均**独立验证通过**，见第 4 节 |
| 数据一致性 | 下单使用事务；读时收敛的状态推进幂等；未发现重复写日志的路径 |
| 主要风险 | CORS 全开、登录无限流、会话不清理、列表 N+1 —— 均为课程范围内的已知取舍，已逐条列出 |

本次共发现 9 条问题：**3 条已在本轮修复**（附证据），6 条记录在案未修复。

---

## 2. 已修复

### F-1 地址全为空白字符时错误码与 SPEC 不一致（高）

- 位置：`server/src/routes/orders.ts`（原第 21 行 `requiredString(payload.address, 'address')`）→ `server/src/domain/orderService.ts:58`
- 现象：`POST /api/orders` 传 `{ address: "   " }` 返回 `INVALID_PAYLOAD`，而 `SPEC.md` AC-05 要求 `ADDRESS_REQUIRED`。
- 根因：路由层的 `requiredString` 先于领域规则拦截了「trim 后为空」的情况，导致同一语义有两套错误码。
- 修复：路由只判断「是不是字符串」，是否「填了」交由 domain 判定，错误码回归单一出口。
- 证据：修复前 `integration.orders.test.ts` 红（`expected 'INVALID_PAYLOAD' to be 'ADDRESS_REQUIRED'`），修复后 70/70 通过。

### F-2 测试与运行都起不来：`node:sqlite` 无法被 Vite 解析（阻断）

- 位置：`server/src/db/connection.ts:16`
- 现象：`vitest` 报 `Failed to load url sqlite (resolved id: sqlite)`，5 个测试文件全部 0 test。
- 根因：Vite 5 的内置模块列表早于 `node:sqlite`，把 `node:` 前缀剥掉后当成三方包解析。这属于「按训练记忆假设工具支持某特性」的典型失误，实际应以运行结果为准。
- 修复：改用 `process.getBuiltinModule('node:sqlite')` 在运行时取模块（Node ≥ 22.3），静态类型仍用 `import type` 保留。
- 后果与约束：`package.json` 已声明 `engines.node >= 22.5`；若换回 `better-sqlite3`，只需改这一个文件。

### F-3 售罄菜品在列表里被标注两次（低，视觉噪音）

- 位置：`client/src/components/DishRow.tsx`（原「已售罄」图章 + 按钮文案）
- 现象：同一行出现两次「已售罄」，且图章与删除线叠加，破坏 `PROTOTYPE_DECISIONS.md` 中「售罄只用灰 + 删除线」的约定。
- 修复：移除图章，仅保留删除线与按钮上的状态文案（满足 AC-17「按钮标注已售罄」）。
- 证据：`docs/screenshots/02-home.png` 为修复前，`03-cart.png` 为修复后。

---

## 3. 未修复（需人决策）

| # | 级别 | 位置 | 问题 | 建议 |
|---|---|---|---|---|
| O-1 | 中 | `server/src/app.ts:17` | `cors()` 未限制来源，任意站点可携带 token 调用接口（token 存 localStorage，无法被第三方站点自动读取，风险可控但不严谨） | 上线前改为白名单 `origin: ['https://takeaway.example.edu']` |
| O-2 | 中 | `server/src/domain/authService.ts:40-63` | 登录无速率限制，且每次登录都新插一条 `sessions`，旧 token 不失效、表只增不减 | 课程范围内可接受；生产应加限流 + token 过期 + 定期清理 |
| O-3 | 低 | `server/src/domain/cartService.ts:135、150、180` | 数量超过 `MAX_ITEM_QTY`（20）时**静默截断**，接口仍返回 201，前端以为加满了 | 改为返回 `409 QTY_LIMIT_EXCEEDED`，或响应里回带最终 qty 让 UI 提示 |
| O-4 | 低 | `server/src/domain/orderService.ts:180` | `listOrders` 对每笔订单各查 2 次（明细 + 状态日志），订单多时是 N+1 | 数据量 <10⁴ 时可接受；需要时改为一次 `IN (...)` 批量取 |
| O-5 | 低 | `server/src/domain/orderService.ts:341` | 订单号取 UUID 前 8 位十六进制（约 4.3×10⁹ 组合），理论碰撞会触发唯一索引报 500 | 碰撞时重试生成，或直接用完整 UUID 派生 |
| O-6 | 低 | `client/src/pages/OrdersPage.tsx:27` | 每 5 秒轮询，页面不可见时仍在请求 | 轮询前判断 `document.visibilityState === 'visible'` |

---

## 4. SPEC 三条安全底线的独立复核

### 4.1 总价是否由服务端重算

- 复核方式：直接读 `server/src/routes/orders.ts`，确认请求体只取 `address` 与 `remark`；再读 `orderService.createOrders`，确认总额来自 `Σ(dishes.price_cents × qty)`。
- 断言：`integration.orders.test.ts > 请求体里的 totalCents 被忽略`（传 `totalCents: 1` 仍得 1300）；`订单表与明细表真实落库，总额等于明细重算值`（直接查库比对）。
- 结论：**通过**。客户端不存在任何影响金额的字段。

### 4.2 订单状态能否跳步

- 复核方式：`domain/statusMachine.ts` 的白名单表是唯一写入口；全仓库搜索 `UPDATE orders SET status`，只出现在 `syncStatus` 与 `cancelOrder` 两处，前者每次都过 `assertTransition`。
- 断言：`unit.statusMachine.test.ts` 覆盖 `paid → ready`、`ready → preparing`、`cancelled → preparing` 三种非法流转；`integration.orders.test.ts > 任何试图直接改状态的请求都落到 404` 覆盖 `PUT/PATCH /orders/:id` 与 `POST /orders/:id/advance`。
- 结论：**通过**。

### 4.3 能否越权查看他人订单

- 复核方式：`getOrder` / `cancelOrder` 在读取后立即比较 `row.user_id !== userId`，且**先按 id 查、后判归属**（因此能稳定返回 403 而不是 404）。
- 断言：`查看他人订单返回 403 FORBIDDEN_ORDER`、`取消他人订单返回 403，且订单状态不变`、`订单列表只包含本人订单`、E2E `他人无法查看这笔订单`。
- 结论：**通过**。

---

## 5. 逐模块意见

| 模块 | 观察 | 判定 |
|---|---|---|
| `domain/pricing.ts` | 边界用 `>=` 而非 `>`，恰好 ¥20 免配送费，与 SPEC 一致 | 通过 |
| `domain/cartService.ts` | 不可售条目仍留在购物车但金额为 0，并在 `issues` 中显式列出——比「静默删除」更符合用户预期 | 通过 |
| `domain/orderService.ts` | 拆单与清车在同一事务内，任一失败整体回滚；`removeDishesFromCart` 在事务内不做二次开事务 | 通过 |
| `db/connection.ts` | 自行实现 `withTransaction`（`node:sqlite` 无此 API），回滚失败不吞原始错误 | 通过 |
| `http/errorHandler.ts` | 未知错误统一 500 且不泄露堆栈；`SyntaxError` 单独映射为 `INVALID_PAYLOAD` | 通过 |
| `client/api/client.ts` | 401 统一广播事件，避免每个页面各写一遍登录态清理 | 通过 |
| `client/state/CartContext.tsx` | 一律用服务端返回替换本地状态，不做本地累加 → 不会出现「界面数量对、库里的不对」 | 通过 |
| `client/pages/OrderDetailPage.tsx` | 不自行判断能否取消，直接读服务端 `cancellable` | 通过 |

## 6. 合并建议

可以合并。理由：三条安全底线有独立证据，70 条自动化测试全绿，18 条验收标准全部有断言。

合并前需确认：O-1（CORS）与 O-2（登录限流）属于课程简化，若计划对外演示，请先处理这两条。
