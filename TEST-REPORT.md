# 验收结果报告（TEST-REPORT）

> 原则：每条结论都有可复现的命令或截图作为依据；**未测的写未测，不用「已通过」覆盖未验证的部分**。
> 报告生成时间：2026-11-08 ｜ 环境：Windows 11 / Node v22.22.2 / Chrome（playwright-core 驱动）。

---

## 1. 执行摘要

| 项 | 命令 | 结果 | 依据 |
|---|---|---|---|
| 类型检查 | `npm run typecheck` | 通过（0 error） | 前后端各一份 tsconfig，`strict: true` |
| 静态检查 | `npm run lint` | 通过（0 problem） | ESLint 9 flat config + typescript-eslint |
| 前端构建 | `npm run build` | 通过 | `dist/index.html` + 204 KB JS + 22 KB CSS |
| 单元 + 集成 | `npm test` | **70 / 70 通过**（6 个文件，2.70s） | `docs/test-results.txt` |
| 端到端 | `npm run test:e2e` | **9 / 9 通过**（真实进程 + 真实 .db 文件） | 同上第 87~90 行 |
| 界面验证 | `node scripts/ui-check.mjs` | **10 / 10 通过**（真实浏览器） | `docs/screenshots/ui-check.json` + 8 张截图 |

**总计 80 条自动化断言全绿，0 失败。** 另有 4 项明确标注为「未测」，见第 4 节。

## 2. 验收标准逐条结论（SPEC 第 6 节）

| AC | 结论 | 依据（用例 / 截图） |
|---|---|---|
| AC-01 已售罄不可加购 | **通过** | `unit.cart > 已售罄菜品不可加购…`；`e2e > 售罄菜品加购被服务端拒绝`（409 DISH_NOT_AVAILABLE） |
| AC-02 已下架不可加购 | **通过** | `unit.cart > 已下架菜品不可加购` |
| AC-03 跨档口购物车分组 | **通过** | `unit.cart > 两家档口的菜品同时存在并按档口分组`；`e2e > 跨两家档口加购…`；截图 `03-cart.png` |
| AC-04 数量改 0 即移除 | **通过** | `unit.cart > 数量改到 0 等于移除（AC-04）` |
| AC-05 空地址不建单 | **通过** | `integration.orders > 地址只有空白字符时返回 400，不创建订单，购物车保留`（断言订单数不变 + 购物车仍为 1 件） |
| AC-06 拆单与配送费 | **通过** | `integration.orders > 两家档口拆成两笔订单…`（¥12→¥13，¥25→¥25）；`unit.pricing` 6 条 |
| AC-07 忽略客户端金额 | **通过** | `integration.orders > 请求体里的 totalCents 被忽略`（传 `totalCents: 1` 实得 1300） |
| AC-08 价格快照 | **通过** | `integration.orders > 下单后改菜品价格，历史订单仍按快照显示`（改价到 ¥99 后订单仍是 ¥16） |
| AC-09 下单瞬间二次校验 | **通过** | `integration.orders > 加购后菜品被置为售罄时整单被拒绝`（409 + details 带 dishId + 订单数不变） |
| AC-10 下单后清车 | **通过** | `integration.orders > 已下单的菜品从购物车移除`；`e2e > 订单列表能查到刚下的两单，购物车已清空` |
| AC-11 25 秒后进入备餐中且只写一条日志 | **通过** | `integration.orders > 25 秒后查询推进到备餐中，且只写一条日志`（查库 `COUNT(*)=1`） |
| AC-12 不可跳步/不可逆向 | **通过** | `unit.statusMachine` 4 条（含 paid→ready、ready→preparing）；`integration.orders > 任何试图直接改状态的请求都落到 404` |
| AC-13 窗口内取消成功 | **通过** | `integration.orders > 窗口内取消成功并写入 cancelled_at`；界面 `ui-check > 窗口内取消成功`；截图 `07-order-cancelled.png` |
| AC-14 超时取消被拒 | **通过** | `integration.orders > 超过 25 秒取消被拒绝，状态保持备餐中`（409 CANCEL_WINDOW_CLOSED + 库里仍是 preparing） |
| AC-15 越权查看订单 | **通过** | `integration.orders > 查看他人订单返回 403`、`取消他人订单返回 403`；`e2e > 他人无法查看这笔订单` |
| AC-16 未登录访问受保护接口 | **通过** | `integration.orders > 未携带 token 访问购物车与订单返回 401`；`integration.auth > /auth/me 需要 token` |
| AC-17 售罄按钮禁用 | **通过** | `ui-check > 售罄菜品按钮为禁用态（AC-17）`（真实浏览器 `isDisabled()`）；截图 `02-home.png` |
| AC-18 空地址不发请求 | **通过** | `ui-check > 地址为空时给出提示` + `地址为空时未发起下单请求`（拦截网络，新增请求 0 次）；截图 `04-checkout.png` |

## 3. 端到端测试事实（`e2e/full-flow.test.ts`）

真实链路：`spawn` 一个独立 Node 进程运行 `server/src/index.ts` → 监听 5311 → 使用临时目录下的真实 `e2e.db` → 通过 HTTP 驱动全部接口 → 最后用另一个连接直接读 `.db` 文件核对落库。

| 步骤 | 断言内容 |
|---|---|
| 1 | 登录后档口列表 6 家 |
| 2 | 跨两家档口加购，购物车读回 2 组、总额 3800 分 |
| 3 | 售罄菜品加购 → 409 |
| 4 | 提交订单 → 2 笔订单，均 `paid` |
| 5 | 订单列表 2 笔；购物车 0 件 |
| 6 | 订单详情有 `timeline`、地址、备注、可取消 |
| 7 | 他人访问 → 403 |
| 8 | 窗口内取消 → `cancelled`；另一单仍 `paid` |
| 9 | **直接读库**：`orders=2`、`order_items=3`、`order_status_logs≥3`、`cart_items=0` |

第 9 条是本报告最关键的一条：它证明「界面显示成功」与「数据真的落库」是同一件事。

## 4. 未测项（明确声明，不含推测）

| # | 项目 | 未测原因 | 影响 |
|---|---|---|---|
| U-1 | 提交订单接口 P95 延迟 < 120ms | 未做压测工具接入；本地实测单次请求在毫秒级，但没有分布数据 | `SPEC` 第 7 节的成功指标未取得证据，不能声称达标 |
| U-2 | 并发下单（多用户同时提交） | 单进程同步驱动天然串行，未构造并发场景 | 高并发下的行为未知 |
| U-3 | 订单在详情页停留超过 25 秒后按钮自动变灰 | 浏览器检查在 25 秒内完成取消；未构造「停留等待超时」的时间旅行（前端无注入点） | 逻辑上由服务端 `cancellable` + 4 秒轮询保证，但缺少界面级证据 |
| U-4 | 移动端 / 窄屏布局 | `SPEC` 第 3 节明确不做适配 | 仅保证不横向溢出，未验证 |

## 5. 界面证据（`docs/screenshots/`）

| 文件 | 内容 |
|---|---|
| `01-login.png` | 学号登录页（DOSE 主题：暖纸底、单一药房绿、DM Mono 标签） |
| `02-home.png` | 首页三栏工作台：档口索引 / 菜品 / 常驻购物车（含售罄禁用态） |
| `03-cart.png` | 加购后：档口分组托盘 + 顶栏计数 1 件 |
| `04-checkout.png` | 结算页：地址必填、按档口分组的账单、应付合计 |
| `05-order-created.png` | 提交结果页：订单号、可取消提示 |
| `06-order-detail.png` | 订单详情：状态时间线 + `00:25` 倒计时快照 |
| `07-order-cancelled.png` | 取消成功后的状态 |
| `08-orders.png` | 订单列表：进行中 / 已结束分组 |
| `ui-check.json` | 10 条界面断言的结构化结果 |

## 6. 测试策略说明（为什么这样测）

- **单元**：只测纯规则（定价、状态机、可售性），不碰 HTTP，失败即定位到函数。
- **集成**：真实 Express + 真实 SQLite（`:memory:`），只对「时间」做受控改写（直接改 `paid_at`），不对数据库做 mock —— 覆盖 SQL 与事务。
- **端到端**：真进程 + 真文件库，验证「接口写完的东西确实在磁盘上」。
- **界面**：真实 Chromium（复用本机 Chrome，不下载浏览器），验证「点了按钮真的发出了/没发出请求」。

**保持诚实的三条自律**：不 mock 数据库；不为让用例变绿而删断言；每条失败先找根因再改代码（本轮 3 个问题见 `REVIEW.md` 第 2 节）。
