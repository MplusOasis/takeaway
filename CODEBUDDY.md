# CODEBUDDY.md · 校园外卖平台工程约定

> 本文件只保留**工具无法自动校验**的约定。凡是 ESLint / `tsc` / 测试能判定的，一律交给命令，不写在这里（规则越少，越容易被遵守）。
> 事实来源优先级：`SPEC.md`（做什么）> `ARCHITECTURE.md`（怎么做）> 本文件（怎么写）> 对话记录。

## 1. 一句话项目说明

PC Web 版校园外卖平台，只做用户端：选档口 → 跨店加购 → 提交订单（按档口拆单）→ 跟踪状态 → 25 秒内可取消。
技术栈：React 18 + TypeScript + Tailwind CSS + Vite ／ Express + TypeScript ／ SQLite（Node 内置 `node:sqlite`）。

## 2. 常用命令

```bash
npm install                 # 安装（workspaces：client + server）
npm run db:reset            # 重建 server/data/takeaway.db 并写入演示数据
npm run dev                 # 同时起后端 5174 与前端 5173
npm run verify              # tsc（前后端）+ ESLint，提交前必须通过
npm test                    # 单元 + 集成测试（真实 HTTP + 内存 SQLite）
npm run test:e2e            # 端到端（真实进程 + 真实库文件）
npm run build               # 前端生产构建（含 tsc）
node scripts/ui-check.mjs   # 可选：真实浏览器走主流程并截图（需先 npm run dev）
```

## 3. 目录边界（改代码前先确认自己在哪一层）

| 目录 | 职责 | 严禁 |
|---|---|---|
| `server/src/domain/**` | 业务规则唯一实现处 | import `express`；直接读 `req` |
| `server/src/routes/**` | 参数校验 + 装配响应 | 写业务判断（金额、状态、可售性） |
| `server/src/db/**` | 连接、迁移、种子 | 写业务判断 |
| `server/src/http/**` | 鉴权、错误出口、入参解析 | 依赖具体业务表 |
| `client/src/pages/**` | 页面编排 | 自己拼金额、自己推断订单是否可取消 |
| `client/src/components/**` | 展示与交互 | 直接 `fetch`（统一走 `api/client.ts`） |

## 4. 业务不变量（违反即视为 bug，不论测试是否覆盖）

1. **金额只由服务端算**。任何前端传上来的 `totalCents` / `deliveryFeeCents` 必须被忽略；前端展示的金额只能来自接口响应。
2. **状态只由服务端推进**。状态机白名单在 `domain/statusMachine.ts`；不存在「客户端指定目标状态」的接口，也不允许新增。
3. **读取订单前必须先 `syncStatus`**。所有订单读取路径（列表 / 详情 / 取消）都要先收敛状态，否则会出现「列表里还停在已支付」的假象。
4. **可售性校验两处都要做**：加购时、提交订单时。任何一处缺失都会让售罄菜品进入订单。
5. **订单明细用快照**：菜名与单价写入 `order_items`，不允许把订单展示改成联表查 `dishes`。
6. **越权返回 403**（`FORBIDDEN_ORDER`），不要为了「不泄露存在性」改成 404 —— 这是 `SPEC.md` AC-15 的验收口径。
7. **金额只用整数分**。`yuan()`（客户端）与 `¥` 展示只做格式化，不做四则运算以外的处理。

## 5. 代码风格（工具之外的约定）

- 命名：类型 `PascalCase`、函数/变量 `camelCase`、SQL 列 `snake_case`；接口返回的视图对象一律 camelCase，DB 行类型保留 snake_case。
- 错误：业务错误一律 `throw new AppError(code, message, status, details)`，不要 `res.status(400).json(...)` 就地返回 —— 否则 `code` 会散落各处。
- 注释只解释「为什么」，不解释「做了什么」；每条与 SPEC 关联的规则在注释里标注 AC 编号。
- 中文文案：面向学生，说人话（「先移除不可售菜品」而不是「操作失败：409」）。
- 禁止 `any`；需要不确定类型时用 `unknown` + 收窄，或用具体行类型接口。

## 6. 不可做的事（越界清单）

- 不新增商家端、支付对接、骑手配送、图片上传、注册/密码、优惠券（见 `SPEC.md` 第 3 节）。
- 不引入 UI 组件库、状态管理库、ORM、CSS-in-JS（技术栈已锁定）。
- 不为了让测试变绿而删用例、放宽断言、mock 数据库。
- 不修改 `SPEC.md` 的验收标准来迁就实现；发现问题写进 `REVIEW.md` 并让人决策。

## 7. 单任务工作流（避免长会话失忆）

1. 从 `PLAN.md` 取一个任务，只改「允许修改的文件」。
2. 改完立即跑 `npm run verify`，再跑相关测试（`npx vitest run server/tests -- orders`）。
3. 涉及金额、状态、权限的改动，额外跑 `npm run test:e2e`。
4. 写一句交接说明（改了什么、为什么、还剩什么），再开新会话。

## 8. 交接文档模板

```
任务：<PLAN 编号与标题>
改动：<文件列表 + 一句话说明>
验证：verify / test / e2e 的实际结果（贴退出码或用例数）
遗留：<未做的事 / 需要人决策的问题>
```
