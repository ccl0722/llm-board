/**
 * regression-test.js · 交互回归测试
 *
 * 作用：用无头 Chromium 打开页面，跑一遍核心交互，输出结构计数与行为快照。
 *      改 JS / DOM 前后各跑一次，两份 JSON 应逐项一致（数据本身变了除外）。
 *
 * 运行：
 *   1) npm i playwright-core        （在本目录内执行）
 *   2) node regression-test.js ../index.html
 *   3) node regression-test.js ../src/index.html    ← 拆分源码版同样可测
 *
 * 需用环境变量 CHROME_PATH 指定本机 Chrome / Chromium 路径，或改下面的 EXE。
 *
 * 覆盖：四个视图切换 / 搜索 / 筛选 / 排序 / 加入与移出对比 / 对比上限 /
 *      只看差异 / 清空 / 抽屉 / Logo 加载 / 横向溢出 / 控制台报错
 *
 * 注意：不要用截图像素对比做验收。页面有过渡动画与字体异步加载，
 *      两次截图的像素几乎不会完全一致 —— 看这个脚本的 JSON 输出即可。
 */

const path = require('path');
const { chromium } = require('playwright-core');

const EXE = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const target = process.argv[2];
  if (!target) { console.error('用法: node regression-test.js <index.html 路径>'); process.exit(1); }
  const url = 'file:///' + encodeURI(path.resolve(target).split(String.fromCharCode(92)).join('/'));

  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|fonts\.googleapis|fonts\.gstatic|ERR_/i.test(m.text()))
      errors.push('CONSOLE: ' + m.text());
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const out = {};
  const count = s => page.$$eval(s, e => e.length);
  const text  = s => page.$eval(s, e => e.textContent.trim()).catch(() => null);
  const pick  = id => page.click(`#modelTable [data-cmp="${id}"]`);

  // ---------- 结构 ----------
  await page.click('a[href="#models"]'); await page.waitForTimeout(600);
  out.navItems   = await count('#navMain a');
  // 排行图：柱数 / 柱下品牌标识数 / 图例项数必须齐全
  out.rankCols   = await count('#rankChart .ch-col');
  out.rankLogos  = await count('#rankChart .ch-logo');
  out.rankLegend = await count('#rankLegend .lg');
  out.rankMetricBtns = await count('#rankMetric button');
  out.modelRows  = await count('#modelTable tbody tr');
  out.orgFilters = await count('[data-org]');
  out.changes    = await count('#changes .chg');

  // ---------- 图表换指标 ----------
  await page.click('[data-rank="cpt"]'); await page.waitForTimeout(500);
  out.rankColsAfterMetricSwitch = await count('#rankChart .ch-col');
  out.rankTitleAfterSwitch = await text('#rankTitle');
  await page.click('[data-rank="aaii"]'); await page.waitForTimeout(400);
  // 单色模式：图例应收起
  await page.click('#rankColor'); await page.waitForTimeout(400);
  out.legendHiddenInMono = await page.$eval('#rankLegend', e => e.classList.contains('mono'));
  await page.click('#rankColor'); await page.waitForTimeout(400);

  // ---------- Logo ----------
  await page.click('a[href="#intel"]'); await page.waitForTimeout(300);
  await page.click('a[href="#pricing"]'); await page.waitForTimeout(400);
  await page.click('a[href="#models"]'); await page.waitForTimeout(300);
  out.logoImgs    = await count('.logo img');
  out.logoBroken  = await page.$$eval('img', is => is.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')));
  out.logoFallbackText = await count('.logo-txt');   // 没有真实标识时才会出现

  // ---------- 搜索 ----------
  await page.fill('#q', 'opus');  await page.waitForTimeout(250);
  out.searchOpus  = await count('#modelTable tbody tr');
  await page.fill('#q', 'zzz不存在'); await page.waitForTimeout(250);
  out.searchEmpty = await text('#modelTable .empty b');
  await page.click('#qClear'); await page.waitForTimeout(250);
  out.afterClear  = await count('#modelTable tbody tr');

  // ---------- 筛选 ----------
  await page.click('[data-org="anthropic"]'); await page.waitForTimeout(200);
  out.filterOneOrg = await count('#modelTable tbody tr');
  await page.click('[data-flag="open"]');     await page.waitForTimeout(200);
  out.filterOrgPlusOpen = await count('#modelTable tbody tr');
  await page.click('#fReset');                await page.waitForTimeout(200);
  out.afterReset = await count('#modelTable tbody tr');

  // ---------- 排序（缺失值必须永远排最后） ----------
  out.sortAaiiDescFirst = await text('#modelTable tbody tr:first-child .nm');
  await page.click('th[data-sort="aaii"]'); await page.waitForTimeout(200);
  out.sortAaiiAscFirst  = await text('#modelTable tbody tr:first-child .nm');
  out.sortAaiiAscLastHasNoScore = await page.$eval('#modelTable tbody tr:last-child td:nth-child(4)', e => /暂无数据/.test(e.textContent));
  out.sortAaiiAscLastName = await text('#modelTable tbody tr:last-child .nm');
  await page.click('th[data-sort="aaii"]'); await page.waitForTimeout(200);

  // ---------- 对比：上限不得清空已选 ----------
  for (const id of ['claude-fable51', 'gpt6-astra', 'glm53', 'ds-v4pro']) { await pick(id); await page.waitForTimeout(120); }
  out.cmpCount4 = await text('#cmpCount');
  out.cmpCols   = await count('#cmpBody table.cmp thead th');     // 1 指标列 + 4 模型列
  out.cmpRows   = await count('#cmpBody table.cmp tbody tr');
  await pick('claude-opus5'); await page.waitForTimeout(250);
  out.overLimitToast   = await text('#toast');
  out.overLimitKeeps4  = await text('#cmpCount');                 // 必须仍是 4

  // ---------- 最优值：动态算出，且不硬编码 ----------
  out.bestMarks = await count('#cmpBody .cval.best');
  out.noBestReasons = await page.$$eval('#cmpBody .warnline', es => [...new Set(es.map(e => e.textContent.trim()))]);

  // ---------- 只看差异 ----------
  await page.click('#trayClear'); await page.waitForTimeout(200);
  await pick('gpt56-terra'); await pick('gpt56-luna'); await page.waitForTimeout(300);
  out.diffOffRows = await count('#cmpBody table.cmp tbody tr');
  await page.click('#btnDiff'); await page.waitForTimeout(300);
  out.diffOnRows  = await count('#cmpBody table.cmp tbody tr');   // 应少于 diffOffRows
  await page.click('#btnDiff'); await page.waitForTimeout(150);

  // ---------- 移出 / 清空 ----------
  await page.click('#cmpBody .drop'); await page.waitForTimeout(200);
  out.afterDrop  = await text('#cmpCount');
  await page.click('#trayClear');     await page.waitForTimeout(200);
  out.afterClearAll = await text('#cmpCount');
  out.emptyState    = await text('#cmpBody .empty b');

  // ---------- 其它视图 ----------
  await page.click('a[href="#pricing"]'); await page.waitForTimeout(450);
  out.priceRows  = await count('#priceTable tbody tr');
  out.specRows   = await count('#specTable tbody tr');
  out.scatterPoints  = await count('#chartBox .ch-pt');
  out.scatterFrontier= await count('#chartBox .ch-front');
  out.scatterLegend  = await count('#scatterLegend .lg');
  out.subPlans   = await count('#subsGrid .plan');
  await page.click('a[href="#intel"]'); await page.waitForTimeout(350);
  out.vendorRows = await count('#vendorTable tbody tr');
  out.timeline   = await count('#timeline .tli');
  out.notes      = await count('#notes .row-x');
  out.conflicts  = await count('#conflictTable tbody tr');

  // ---------- 抽屉 + 键盘 ----------
  await page.click('#vendorTable [data-vendor="zai"]'); await page.waitForTimeout(300);
  out.drawerTitle = await text('#drawerTitle');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  out.drawerClosedByEsc = await page.$eval('#drawer', e => !e.classList.contains('open'));

  // ---------- 布局 ----------
  out.viewports = {};
  for (const w of [1440, 1280, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    const per = {};
    for (const h of ['overview', 'models', 'pricing', 'intel']) {
      await page.evaluate(x => location.hash = x, h);
      await page.waitForTimeout(300);
      per[h] = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    }
    out.viewports[w] = { horizontalOverflow: per };
  }

  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();

  const bad = errors.length
    || out.overLimitKeeps4 !== '4'
    || out.logoBroken.length
    || out.rankCols === 0 || out.rankLogos !== out.rankCols
    || out.scatterPoints === 0
    || Object.values(out.viewports).some(v => Object.values(v.horizontalOverflow).some(Boolean));
  process.exit(bad ? 1 : 0);
})();
