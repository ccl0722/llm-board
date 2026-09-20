/* ==========================================================
   charts.js · 图表层
   --------------------------------------------------------
   两张图：
     rankChart()   指标排行柱状图 —— 柱下挂真实品牌标识，这是识别的主通道
     scatterChart() 智能指数 × 单任务成本散点 —— 含帕累托前沿与优先区

   配色约定（重要）：
     厂商色只承担「聚类」—— 一眼看出某家占据了榜首那一片。
     它**不承担识别**：识别由柱下 logo、名称、图例、悬停提示与下方表格承担。
     16 个分类色在数学上无法两两可分（最糟一对正常视觉 ΔE 7.4，
     色盲视角下品红与绿会重合），所以任何一处都不能只靠颜色读懂。
     需要精确区分时用「单色」模式：一个色 + 选中态强调。

   几何规范（照数据可视化通用规范）：
     柱宽 ≤24px · 顶端 4px 圆角、底端切平 · 相邻柱留 2px 表面间隙
     网格线为 1px 实线（不用虚线）· 标记 ≥8px 且带 2px 表面描边
     数值标签只给少数几根，其余交给坐标轴与悬停
   ========================================================== */

const CH = (function(){
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const el = (n, a) => { const e = document.createElementNS(NS, n); for(const k in a){ if(a[k]!=null) e.setAttribute(k, a[k]); } return e; };
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* 读取当前主题令牌，图表文字一律走文字色，绝不穿数据色 */
function tok(name, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* ---------- 共用：悬停提示 ---------- */
function mkTip(host){
  let tip = host.querySelector('.ch-tip');
  if(!tip){ tip = document.createElement('div'); tip.className = 'ch-tip'; tip.hidden = true; host.appendChild(tip); }
  return {
    show(html, x, y){
      tip.innerHTML = html; tip.hidden = false;
      const hb = host.getBoundingClientRect(), tb = tip.getBoundingClientRect();
      let left = x - tb.width/2;
      left = Math.max(4, Math.min(hb.width - tb.width - 4, left));
      tip.style.left = left + 'px';
      tip.style.top  = Math.max(4, y - tb.height - 12) + 'px';
    },
    hide(){ tip.hidden = true; }
  };
}

/* 把一组 mark 接上悬停 / 键盘焦点 —— 提示只做增强，值在表格里同样拿得到 */
function bindMark(node, tip, html, host){
  const at = () => { const b = node.getBoundingClientRect(), h = host.getBoundingClientRect();
                     return [b.left - h.left + b.width/2, b.top - h.top]; };
  const on  = () => { const [x,y] = at(); tip.show(html, x, y); };
  node.addEventListener('mouseenter', on);
  node.addEventListener('focus', on);
  node.addEventListener('mouseleave', tip.hide);
  node.addEventListener('blur', tip.hide);
}

/* ==========================================================
   指标排行柱状图
   opts: {metric, rows:[{id,name,org,brand,value,disp,unit,logo,dim,marked}],
          better, basis, note, colorBy:'lab'|'mono', max}
   ========================================================== */
function rankChart(host, opts){
  host.innerHTML = '';
  const rows = opts.rows;
  if(!rows.length){
    host.innerHTML = '<div class="empty"><b>这一项还没有可比数据</b>换一个指标，或到下方表格查看完整记录。</div>';
    return;
  }

  const ink   = tok('--ink','#EFEDE6'), ink2 = tok('--ink-2','#B7B4AA'), ink3 = tok('--ink-3','#8D8B82');
  const line  = tok('--line','rgba(238,234,226,.085)'), line2 = tok('--line-2','rgba(238,234,226,.155)');
  const surf  = tok('--surface','#171A17');
  const sage  = tok('--sage','#A8B39C');

  const W = Math.max(520, host.clientWidth || 900);
  const PAD = {t:18, r:10, b:118, l:46};
  const PLOT_H = 224;
  const H = PAD.t + PLOT_H + PAD.b;

  const plotW = W - PAD.l - PAD.r;
  const band  = plotW / rows.length;
  const colW  = Math.max(5, Math.min(24, band - 2));      // 柱宽上限 24px，band 余量即 2px 表面间隙

  const vals = rows.map(r => r.value);
  const lo = Math.min(0, Math.min.apply(null, vals));
  const hi = Math.max.apply(null, vals);
  const {top, step} = niceScale(lo, hi, 4);
  const Y = v => PAD.t + PLOT_H - (v - lo) / (top - lo) * PLOT_H;

  const svg = el('svg', {width:'100%', viewBox:`0 0 ${W} ${H}`, class:'ch-svg',
                         role:'img', 'aria-label': opts.aria || (opts.metric + ' 排行')});
  svg.style.height = H + 'px';

  /* --- 网格：一步之差的灰、1px 实线、在数据之下 --- */
  const ticks = []; for(let t = lo; t <= top + 1e-9; t += step) ticks.push(+t.toFixed(6));
  ticks.forEach(t => {
    svg.appendChild(el('line', {x1:PAD.l, x2:W-PAD.r, y1:Y(t), y2:Y(t), stroke: t===lo?line2:line, 'stroke-width':1}));
    const tx = el('text', {x:PAD.l-8, y:Y(t)+3.5, 'text-anchor':'end', class:'ch-tick'});
    tx.textContent = fmtTick(t, opts.tickFmt);
    svg.appendChild(tx);
  });

  /* --- 坐标轴标题 --- */
  if(opts.yTitle){
    const yt = el('text', {x:0, y:0, class:'ch-axis', transform:`translate(13 ${PAD.t+PLOT_H/2}) rotate(-90)`, 'text-anchor':'middle'});
    yt.textContent = opts.yTitle; svg.appendChild(yt);
  }

  /* --- 柱 --- */
  const tip = mkTip(host);
  rows.forEach((r, i) => {
    const cx = PAD.l + band*i + band/2;
    const x  = cx - colW/2;
    const y  = Y(r.value), h = Math.max(1.5, PAD.t + PLOT_H - y);
    const rad = Math.min(4, colW/2);

    const g = el('g', {class:'ch-col' + (r.dim ? ' dim' : '') + (r.marked ? ' marked' : ''),
                       tabindex:0, role:'listitem'});
    /* 顶端 4px 圆角、底端切平：用 path 而不是 rect，避免底部也被圆掉 */
    const d = `M${x},${y+h} L${x},${y+rad} Q${x},${y} ${x+rad},${y} L${x+colW-rad},${y} Q${x+colW},${y} ${x+colW},${y+rad} L${x+colW},${y+h} Z`;
    /* 满色渲染：柱宽只有 24px，属于「细标记」而非大色块；
       深色底上降不透明度只会变暗发脏，不会变得克制（详见 data.js 的说明） */
    g.appendChild(el('path', {d, fill: r.color}));
    svg.appendChild(g);

    bindMark(g, tip,
      '<b>'+esc(r.name)+'</b><span class="o">'+esc(r.orgName)+'</span>'+
      '<span class="v">'+esc(r.disp)+'</span>'+
      (r.sub ? '<span class="s">'+esc(r.sub)+'</span>' : ''), host);

    /* --- 柱下品牌标识：识别的主通道 --- */
    if(r.logo){
      const sz = Math.min(17, Math.max(11, colW));
      svg.appendChild(el('image', {href:r.logo, x:cx-sz/2, y:PAD.t+PLOT_H+9, width:sz, height:sz,
                                   preserveAspectRatio:'xMidYMid meet', class:'ch-logo'}));
    }

    /* --- 旋转的名称 --- */
    const ty = PAD.t + PLOT_H + 36;
    const t = el('text', {x:cx, y:ty, class:'ch-name'+(r.marked?' on':''),
                          transform:`rotate(-52 ${cx} ${ty})`, 'text-anchor':'end'});
    t.textContent = r.name.length > 20 ? r.name.slice(0,19)+'…' : r.name;
    svg.appendChild(t);
  });

  /* --- 数值标签：只给前三与已选中的，其余交给坐标轴与悬停 --- */
  rows.forEach((r,i) => {
    if(!(i < 3 || r.marked)) return;
    const cx = PAD.l + band*i + band/2, y = Y(r.value);
    const label = el('text', {x:cx, y:y-7, 'text-anchor':'middle', class:'ch-val'});
    label.textContent = r.disp;
    /* 放不下就不放 —— 绝不裁切 */
    if(colW >= 18 || rows.length <= 24) svg.appendChild(label);
  });

  host.appendChild(svg);
}

/* ==========================================================
   散点：智能指数 × 单任务成本
   ========================================================== */
function scatterChart(host, opts){
  host.innerHTML = '';
  const pts = opts.points;
  if(pts.length < 3){
    host.innerHTML = '<div class="empty"><b>可靠数据不足，改用表格</b>两项都有数据的模型少于 3 个，画散点没有意义。</div>';
    return;
  }
  const line = tok('--line','rgba(238,234,226,.085)'), line2 = tok('--line-2','rgba(238,234,226,.155)');
  const surf = tok('--surface','#171A17'), sage = tok('--sage','#A8B39C');

  const W = Math.max(520, host.clientWidth || 900);
  const PAD = {t:26, r:20, b:62, l:56};
  const PLOT_H = 300, H = PAD.t + PLOT_H + PAD.b;
  const plotW = W - PAD.l - PAD.r;

  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  const x0 = Math.log10(Math.min.apply(null,xs)*0.7), x1 = Math.log10(Math.max.apply(null,xs)*1.45);
  const y0 = Math.max(0, Math.floor(Math.min.apply(null,ys)/10)*10-3), y1 = Math.ceil(Math.max.apply(null,ys)/10)*10+3;
  const X = v => PAD.l + (Math.log10(v)-x0)/(x1-x0)*plotW;
  const Y = v => PAD.t + PLOT_H - (v-y0)/(y1-y0)*PLOT_H;

  const svg = el('svg', {width:'100%', viewBox:`0 0 ${W} ${H}`, class:'ch-svg',
                         role:'img', 'aria-label': opts.aria || '智能指数与单任务成本散点图'});
  svg.style.height = H + 'px';

  /* --- 帕累托前沿：没有任何模型在两个维度上都更好的那条边 --- */
  const sorted = pts.slice().sort((a,b)=> a.x-b.x || b.y-a.y);
  const front = [];
  let bestY = -Infinity;
  sorted.forEach(p => { if(p.y > bestY){ front.push(p); bestY = p.y; } });

  /* --- 网格：1px 实线 --- */
  for(let i=0;i<=4;i++){
    const v = y0 + (y1-y0)/4*i, y = Y(v);
    svg.appendChild(el('line', {x1:PAD.l, x2:W-PAD.r, y1:y, y2:y, stroke: i===0?line2:line, 'stroke-width':1}));
    const t = el('text', {x:PAD.l-8, y:y+3.5, 'text-anchor':'end', class:'ch-tick'});
    t.textContent = Math.round(v); svg.appendChild(t);
  }
  [0.05,0.1,0.25,0.5,1,2,5,10,20].forEach(v => {
    if(Math.log10(v) < x0 || Math.log10(v) > x1) return;
    const x = X(v);
    svg.appendChild(el('line', {x1:x, x2:x, y1:PAD.t, y2:PAD.t+PLOT_H, stroke:line, 'stroke-width':1}));
    const t = el('text', {x, y:PAD.t+PLOT_H+16, 'text-anchor':'middle', class:'ch-tick'});
    t.textContent = '$'+(v<1?v.toFixed(2):v); svg.appendChild(t);
  });

  /* --- 帕累托前沿：没有任何模型能同时更强又更便宜的那条边 --- */
  if(front.length > 1){
    svg.appendChild(el('polyline', {
      points: front.map(p=>X(p.x)+','+Y(p.y)).join(' '),
      fill:'none', stroke:sage, 'stroke-width':2, 'stroke-linejoin':'round', 'stroke-linecap':'round',
      'stroke-opacity':.5, class:'ch-front'}));
    const lead = front[front.length-1];
    const lb = el('text', {x:X(lead.x)-8, y:Y(lead.y)-14, 'text-anchor':'end', class:'ch-axis'});
    lb.textContent = '帕累托前沿'; svg.appendChild(lb);
  }

  /* --- 坐标轴标题 --- */
  const xt = el('text', {x:PAD.l+plotW/2, y:H-6, 'text-anchor':'middle', class:'ch-axis'});
  xt.textContent = '单任务实测成本（美元 · 对数刻度）→ 越左越便宜';
  svg.appendChild(xt);
  const yt = el('text', {x:0, y:0, class:'ch-axis', transform:`translate(14 ${PAD.t+PLOT_H/2}) rotate(-90)`, 'text-anchor':'middle'});
  yt.textContent = 'AA 智能指数 v4.3 →';
  svg.appendChild(yt);

  /* --- 点：r≥4，带 2px 表面描边，避免重叠处糊在一起 --- */
  const tip = mkTip(host);
  const placed = [];
  const frontSet = new Set(front.map(p=>p.id));
  /* 前沿上的点优先获得标签 —— 它们是这张图真正要讲的 */
  pts.slice().sort((a,b)=> (frontSet.has(b.id)?1:0)-(frontSet.has(a.id)?1:0) || b.y-a.y).forEach(p => {
    p.onFront = frontSet.has(p.id);
    const cx = X(p.x), cy = Y(p.y);
    const g = el('g', {class:'ch-pt'+(p.marked?' marked':''), tabindex:0, role:'listitem'});
    g.appendChild(el('circle', {cx, cy, r:p.marked?6:5, fill:p.color, stroke:surf, 'stroke-width':2}));
    svg.appendChild(g);
    bindMark(g, tip,
      '<b>'+esc(p.name)+'</b><span class="o">'+esc(p.orgName)+'</span>'+
      '<span class="v">'+esc(p.yDisp)+' · '+esc(p.xDisp)+'</span>'+
      (p.onFront ? '<span class="s">位于帕累托前沿</span>' : ''), host);

    /* 标签避让：挤在一起的只保留第一个，其余靠悬停 */
    const clash = placed.some(q => Math.abs(q.x-cx) < 130 && Math.abs(q.y-cy) < 15);
    if(!clash || p.marked){
      placed.push({x:cx,y:cy});
      const flip = cx > PAD.l + plotW*0.62;
      const t = el('text', {x: cx + (flip?-10:10), y: cy+3.5,
                            'text-anchor': flip?'end':'start', class:'ch-plabel'+(p.marked?' on':'')});
      t.textContent = p.name;
      svg.appendChild(t);
    }
  });

  host.appendChild(svg);
  return {frontIds: front.map(p=>p.id)};
}

/* ---------- 刻度：选一个「好看的步长」，让 n 格刚好盖住数据 ---------- */
function niceScale(lo, hi, n){
  const span = Math.max(hi - lo, 1e-6);
  const raw  = span / n;
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return {top: Math.ceil(hi / step) * step, step};
}
function fmtTick(v, fmt){
  if(fmt === 'money') return '$' + (v >= 10 ? v.toFixed(0) : v.toFixed(v < 1 ? 2 : 1));
  if(Math.abs(v) >= 1000) return (v/1000).toFixed(v%1000?1:0)+'k';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

return {rankChart, scatterChart};
})();
