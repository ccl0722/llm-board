/**
 * geometry-snapshot.js  ·  视觉回归验证（确定性）
 *
 * 为什么不用截图像素对比？
 *   页面有 CSS 过渡、异步字体与散点图的运行时定位，任何两张截图都不可能
 *   逐像素相同。所以改用「布局几何 + 计算样式」快照：脚本会先停掉动画与
 *   过渡再采样，结果完全确定，可直接做哈希比对。
 *
 * 用途：改 CSS 前后各跑一次，diff 两份 JSON 即可确认改动范围。
 *   —— 它比对的是「你改动前 vs 改动后」，不是「旧版设计 vs 新版设计」。
 *      重设计本来就会改变几何，不要把两版一致当成目标。
 *
 * 运行：
 *   npm i playwright-core
 *   node geometry-snapshot.js ../index.html > after.json
 *   node geometry-snapshot.js ../index.html.bak > before.json
 *
 * 提示：页面是四视图切换（hash 路由），未激活的视图 display:none，
 *      采样时只会覆盖当前视图。需要覆盖全部视图时，分别传
 *      ../index.html#models 等 hash 各跑一次。
 *
 * 需用环境变量 CHROME_PATH 指定本机 Chrome / Chromium 路径。
 */

const { chromium } = require('playwright-core');

const EXE = process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const SELECTORS = [
  'nav', '.hero', '.stat', '.today-panel', '.filter-bar', '.sec-title',
  '.lb-card', '.tab', '.row', '.mo', '.org-logo', '.org-logo img', '.bar-wrap', '.bar i',
  '.hm-wrap', '.hm td', '.bench', '.brow', '.btrack .track i',
  '.hl', '.ptable', '.prow', '.pt', '.combo', '.cc', '.cc-bar i',
  '.vcard', '.vlogo', '.vlogo img', '.vs-pick', '.vs-item', '.tl-item', '.voice',
  '.update-fab', '.chip', '.note-line', '.cell-best', '.top-bar',
];

const PROPS = [
  'backgroundColor', 'color', 'borderTopColor', 'borderLeftColor',
  'fontSize', 'fontWeight', 'fontFamily', 'width', 'height', 'opacity', 'borderRadius',
];

(async () => {
  const target = process.argv[2];
  if (!target) { console.error('用法: node geometry-snapshot.js <index.html 路径>'); process.exit(1); }
  const url = 'file:///' + encodeURI(require('path').resolve(target).replace(/\\/g, '/'));

  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(url, { waitUntil: 'load' });
  // 停掉所有动画与过渡，消除采样抖动
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none !important;transition:none !important}' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const data = await page.evaluate(({ sels, props }) => {
    const out = { docHeight: document.documentElement.scrollHeight, els: {} };
    for (const s of sels) {
      const list = [...document.querySelectorAll(s)];
      if (!list.length) { out.els[s] = null; continue; }
      out.els[s] = list.map(el => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const o = { box: [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100) };
        for (const p of props) o[p] = cs[p];
        return o;
      });
    }
    return out;
  }, { sels: SELECTORS, props: PROPS });

  console.log(JSON.stringify({ errors, data }, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
