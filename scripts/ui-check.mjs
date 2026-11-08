/**
 * 界面级验证（可选，需要本机 Chrome/Edge）。
 * 用真实浏览器走一遍：登录 → 加购（含售罄禁用）→ 地址为空不提交 → 提交 → 订单详情 → 取消。
 * 产物：docs/screenshots/*.png 与 docs/screenshots/ui-check.json，作为 TEST-REPORT 的界面证据。
 *
 * 前置：后端 5174 与前端 5173 已启动（npm run dev）。
 * 运行：node scripts/ui-check.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.UI_BASE ?? 'http://localhost:5173';
const OUT_DIR = 'docs/screenshots';
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: process.env.UI_CHANNEL ?? 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

/** 记录下单请求，用来验证「地址为空不发起请求」（AC-18） */
const orderRequests = [];
page.on('request', (request) => {
  if (request.url().includes('/api/orders') && request.method() === 'POST') {
    orderRequests.push(request.postData() ?? '');
  }
});

try {
  // 1. 登录
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT_DIR}/01-login.png` });

  await page.fill('#studentNo', '2021001');
  await page.fill('#name', '林可');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });
  await page.waitForSelector('text=川味小炒', { timeout: 20_000 });
  await page.screenshot({ path: `${OUT_DIR}/02-home.png` });

  const stallCount = await page.locator('aside button.plastic').count();
  record('首页渲染档口索引（应为 6 家）', stallCount === 6, `实际 ${stallCount} 家`);

  // 2. 售罄禁用态（AC-17）
  const soldOutButton = page.locator('button', { hasText: '已售罄' }).first();
  record('售罄菜品按钮为禁用态（AC-17）', await soldOutButton.isDisabled());

  // 3. 加购
  await page.locator('button:has-text("加购")').first().click();
  await page.waitForSelector('text=已加入这一单', { timeout: 15_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT_DIR}/03-cart.png` });

  const headerText = (await page.locator('header').first().innerText()).replace(/\s+/g, ' ');
  record('加购后顶栏计数更新', headerText.includes('1 件'), `顶栏：${headerText}`);

  // 4. 结算：地址为空不提交（AC-18）
  await page.click('button:has-text("去结算")');
  await page.waitForURL(`${BASE}/checkout`, { timeout: 15_000 });
  await page.screenshot({ path: `${OUT_DIR}/04-checkout.png` });

  const before = orderRequests.length;
  await page.click('button:has-text("提交订单")');
  await page.waitForTimeout(900);
  const errorVisible = await page.locator('text=请填写配送地址').first().isVisible();
  record('地址为空时给出提示（AC-18）', errorVisible);
  record(
    '地址为空时未发起下单请求（AC-18）',
    orderRequests.length === before,
    `新增请求 ${orderRequests.length - before} 次`,
  );

  // 5. 正常提交
  await page.fill('#address', '菜鸟驿站 3 号楼 门口');
  await page.fill('#remark', '少辣，不要香菜');
  await page.click('button:has-text("提交订单")');
  await page.waitForSelector('text=去我的订单', { timeout: 20_000 });
  await page.screenshot({ path: `${OUT_DIR}/05-order-created.png` });
  record('提交订单后进入结果页', orderRequests.length > before, `下单请求 ${orderRequests.length} 次`);

  // 6. 订单详情 + 25 秒倒计时 + 取消
  await page.locator('a[href^="/orders/"]').first().click();
  await page.waitForSelector('text=取餐信息', { timeout: 15_000 });
  await page.screenshot({ path: `${OUT_DIR}/06-order-detail.png` });
  record('订单详情展示状态时间线', await page.locator('ol[aria-label="订单状态时间线"]').isVisible());
  record('订单详情展示取消倒计时', await page.locator('text=可取消剩余').first().isVisible());

  await page.click('button:has-text("取消订单")');
  await page.waitForSelector('text=已取消，这单不会再出餐', { timeout: 15_000 });
  await page.screenshot({ path: `${OUT_DIR}/07-order-cancelled.png` });
  record('窗口内取消成功', await page.locator('text=已取消').first().isVisible());

  // 7. 订单列表
  await page.click('a[href="/orders"]');
  await page.waitForURL(`${BASE}/orders`, { timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT_DIR}/08-orders.png` });
  record('订单列表可见已结束订单', await page.locator('text=已结束').first().isVisible());
} catch (error) {
  record('执行过程未抛异常', false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT_DIR}/ui-check.json`, JSON.stringify(results, null, 2), 'utf8');
  const failed = results.filter((item) => !item.ok);
  console.log(`\n界面验证：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length > 0) process.exitCode = 1;
}
