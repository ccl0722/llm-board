/* ==========================================================
   app.js · 行为层
   依赖 data.js 暴露的：META BRANDS SOURCES METRICS METRIC_GROUPS
                      MODELS SCENES CHANGES AGENT_* SUBSCRIPTIONS
                      VENDORS TIMELINE NOTES VOICES CONFLICTS
   全部渲染都从数据算出，页面里不硬编码任何分数、名次或「最优」。
   ========================================================== */
(function(){
'use strict';

/* ---------------- 基础工具 ---------------- */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> [].slice.call((r||document).querySelectorAll(s));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = {}; MODELS.forEach(m=> byId[m.id]=m);
const MET  = {}; METRICS.forEach(m=> MET[m.k]=m);

/* localStorage 在 file:// 或隐私模式下可能抛错，一律兜底 */
const store = {
  get(k,d){ try{ const v=localStorage.getItem('llmboard.'+k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('llmboard.'+k, JSON.stringify(v)); }catch(e){} }
};

/* ---------------- 数值格式化 ---------------- */
function fmtTok(n){
  if(n==null) return null;
  if(n>=1e6){ const x=n/1e6; return (x%1?x.toFixed(2).replace(/0$/,''):x)+'M'; }
  if(n>=1e3) return Math.round(n/1e3)+'K';
  return String(n);
}
function fmtPar(n){
  if(n==null) return null;
  if(n>=1e12){ const x=n/1e12; return (x%1?x.toFixed(2).replace(/0+$/,'').replace(/\.$/,''):x)+'T'; }
  if(n>=1e9)  return Math.round(n/1e9)+'B';
  return String(n);
}
function fmtVal(mk, val){
  const m = MET[mk]; if(!val) return null;
  if(val.disp) return val.disp;
  if(m.fmt==='tok') return fmtTok(val.v);
  if(m.fmt==='par') return fmtPar(val.v);
  let n = val.v;
  if(m.money){
    /* 统一两位小数，价格列的小数点才能对齐；不足一分的用四位 */
    return '$' + (n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2));
  }
  return m.dec != null ? (n % 1 === 0 && m.dec > 0 ? n.toFixed(m.dec) : n.toFixed(m.dec)) : String(n);
}
function unitOf(mk){
  const m = MET[mk];
  /* 只有「每百万 token」计价的三项才带 /M；单任务成本是每次任务的绝对金额 */
  if(m.perM) return ' /M';
  if(m.money) return '';
  return m.unit || '';
}
const KIND_LABEL = {ind:'独立评测', vendor:'官方自报', est:'估算', edit:'编辑判断'};
/* full=true 时标出全部非独立口径（对比表 / 详情抽屉）；
   密集表格里只标「估算」，否则满屏「官方自报」会淹掉真正的提示。 */
function kindTag(val, full){
  if(!val || val.kind==='ind') return '';
  if(!full && val.kind!=='est') return '';
  return '<span class="kind '+val.kind+'" title="'+esc(KIND_LABEL[val.kind]||'')+'">'+esc(KIND_LABEL[val.kind]||'')+'</span>';
}

/* ---------------- 品牌标识 ---------------- */
function brandOf(key){ return BRANDS[key] || null; }
function logoHTML(key, cls){
  const b = brandOf(key);
  const c = 'logo' + (cls?' '+cls:'') + (b && b.wide ? ' wide' : '');
  if(b && b.logo) return '<span class="'+c+'" aria-hidden="true"><img src="'+b.logo+'" alt="" decoding="async"></span>';
  /* 找不到可核实的真实标识时，显示品牌全名文字，不用首字母头像顶替 */
  return '<span class="logo-txt">'+esc(b?b.name:key)+'</span>';
}
function orgName(key){ const b = brandOf(key); return b?b.name:key; }

/* ---------------- 全局状态 ---------------- */
const state = {
  view:  'overview',
  q:     '',
  orgs:  new Set(),
  flags: {open:false, scored:false, current:false},
  sort:  {k:'aaii', dir:-1},
  cols:  null,   /* 见下方 initCols()：要过滤掉 localStorage 里残留的旧指标 key */
  cmp:   (store.get('cmp', []) || []).filter(id=>byId[id]).slice(0,4),
  fav:   (store.get('fav', []) || []).filter(id=>byId[id]),
  diffOnly: false,
  chgAll: false,
  voiceAll: false
};
const MAXCMP = 4;
const DEFAULT_COLS = ['aaii','cai','tb40','cpt','priceOut','ctx','license'];

const COLS = [
  {k:'aaii'},{k:'cai'},{k:'tb40'},{k:'tb21'},{k:'swe'},{k:'gdpval'},{k:'gpqa'},{k:'scicode'},
  {k:'lcr'},{k:'nonhall'},{k:'arena'},
  {k:'cpt'},{k:'priceIn'},{k:'priceOut'},{k:'priceCache'},{k:'speed'},
  {k:'ctx'},{k:'maxOut'},{k:'paramsTotal'},
  {k:'license', label:'许可', short:'许可', special:true}
];
function colLabel(c){ return c.special ? c.short : MET[c.k].short; }
/* 列头副标题 = 这一列的单位，写清楚免得「分数 / 百分比 / 美元 / token」混淆 */
const COL_UNIT = {
  aaii:'v4.3 指数', cai:'v1.5 指数', tb40:'%', tb21:'%', swe:'% · 已归档', gdpval:'%', gpqa:'%',
  scicode:'%', lcr:'%', nonhall:'%', arena:'Elo',
  cpt:'$ / 任务', priceIn:'$ / 百万 token', priceOut:'$ / 百万 token', priceCache:'$ / 百万 token',
  speed:'token / 秒', ctx:'token', maxOut:'token', paramsTotal:'参数', paramsAct:'参数', license:'权重'
};
/* 概览右栏空间有限，用短单位 */
const COL_UNIT_SHORT = Object.assign({}, COL_UNIT, {aaii:'指数', cai:'指数', cpt:'$/任务', priceIn:'$/M', priceOut:'$/M', priceCache:'$/M', speed:'t/s', swe:'%'});

/* 指标集会随榜单换代而变（例如 tb30 -> tb40），
   所以读 localStorage 时要把已经不存在的列 key 丢掉，否则表头会空一列 */
function initCols(){
  const known = COLS.map(c=>c.k);
  const saved = (store.get('cols', null) || []).filter(k=>known.indexOf(k)>=0);
  state.cols = saved.length ? saved : DEFAULT_COLS.slice();
}
initCols();

/* ---------------- 排序 / 筛选 ---------------- */
function cmpBy(a, b, k, dir){
  if(k==='license'){
    const av=a.openWeights===true?2:(a.openWeights==='pending'?1:0), bv=b.openWeights===true?2:(b.openWeights==='pending'?1:0);
    return (bv-av)*dir*-1*-1;
  }
  const av = a[k], bv = b[k];
  if(!av && !bv) return 0;
  if(!av) return 1;            // 缺失永远排最后，不按 0 参与
  if(!bv) return -1;
  return (av.v - bv.v) * dir;
}
function filtered(){
  const q = state.q.trim().toLowerCase();
  return MODELS.filter(m=>{
    if(q){
      const hay = (m.name+' '+m.id+' '+orgName(m.org)+' '+m.org+' '+(m.tag||'')+' '+(m.variant||'')).toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    if(state.orgs.size && !state.orgs.has(m.org)) return false;
    if(state.flags.open    && !(m.openWeights===true)) return false;
    if(state.flags.scored  && !m.aaii) return false;
    if(state.flags.current && m.status!=='current') return false;
    return true;
  }).sort((a,b)=> cmpBy(a,b,state.sort.k,state.sort.dir) || a.name.localeCompare(b.name));
}

/* ---------------- 最优值：动态计算，绝不硬编码 ----------------
   规则：① 指标无优劣方向 -> 不评
        ② 有效值少于 2 个 -> 不评
        ③ 选中模型里出现了不同的取值类型（独立评测 / 官方自报 / 估算）
           说明口径不一致 -> 不评
        ④ 只在有值的模型之间比，缺失的不按 0 参与                     */
function bestOf(list, mk){
  const m = MET[mk];
  if(!m || !m.better) return {v:null, reason:'nodir'};
  const vals = list.map(x=>x[mk]).filter(Boolean);
  if(vals.length < 2) return {v:null, reason:'thin'};
  const kinds = new Set(vals.map(v=>v.kind));
  if(kinds.size > 1) return {v:null, reason:'mixed'};
  if(kinds.has('est')) return {v:null, reason:'est'};
  const nums = vals.map(v=>v.v);
  return {v: m.better==='high' ? Math.max.apply(null,nums) : Math.min.apply(null,nums),
          partial: vals.length < list.length, have: vals.length};
}

/* ---------------- 对比选择 ---------------- */
function inCmp(id){ return state.cmp.indexOf(id) >= 0; }
function toggleCmp(id){
  const i = state.cmp.indexOf(id);
  if(i >= 0){ state.cmp.splice(i,1); }
  else{
    /* 已达上限时保留已选，提示先移除 —— 不清空重来 */
    if(state.cmp.length >= MAXCMP){
      toast('最多同时对比 '+MAXCMP+' 个模型，请先移除一个', true);
      return false;
    }
    state.cmp.push(id);
  }
  store.set('cmp', state.cmp);
  renderCompareUI();
  return true;
}
function toggleFav(id){
  const i = state.fav.indexOf(id);
  if(i>=0) state.fav.splice(i,1); else state.fav.push(id);
  store.set('fav', state.fav);
  renderFav(); renderModelTable(); renderOverview();
}

let toastTimer = null;
function toast(msg, warn){
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (warn?' warn':'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.className = 'toast' + (warn?' warn':''), 2600);
}

/* ================================================================
   导航
   ================================================================ */
const VIEWS = [
  {k:'overview', name:'概览',        icon:'M2 8h5V3H2v5Zm0 5h5V9H2v4Zm6 0h6V8H8v5Zm0-10v4h6V3H8Z'},
  {k:'models',   name:'模型库与对比', icon:'M2 3h12M2 8h12M2 13h12'},
  {k:'pricing',  name:'价格与使用',   icon:'M8 2v12M11 5H6.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H4'},
  {k:'intel',    name:'动态与资料',   icon:'M3 13V6M6.5 13V3M10 13V8M13.5 13v-3'}
];
function navCount(k){
  if(k==='models')  return MODELS.length;
  if(k==='pricing') return MODELS.filter(m=>m.priceIn||m.priceOut).length;
  if(k==='intel')   return VENDORS.length;
  return '';
}
function renderNav(){
  $('#navMain').innerHTML = VIEWS.map(v =>
    '<a href="#'+v.k+'" role="listitem" data-view="'+v.k+'"'+(state.view===v.k?' aria-current="page"':'')+'>'+
      '<svg class="ico" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="'+v.icon+'"/></svg>'+
      esc(v.name)+'<span class="n">'+navCount(v.k)+'</span></a>').join('');
}
function go(view){
  if(!VIEWS.some(v=>v.k===view)) view = 'overview';
  state.view = view;
  $$('.view').forEach(s=> s.classList.toggle('on', s.id === 'view-'+view));
  renderNav();
  if(location.hash.slice(1) !== view) history.replaceState(null,'','#'+view);
  window.scrollTo({top:0, behavior:'auto'});
  if(view==='pricing') drawChart();
}

/* ================================================================
   概览
   ================================================================ */
const KIND_COLOR = {'价格':'brass','评测':'sage','榜单':'sage','厂商':'','生态':'','安全':'warn'};
function renderChanges(){
  const top = CHANGES.slice().sort((a,b)=>a.rank-b.rank);
  const N = 4;
  const show = state.chgAll ? top : top.slice(0,N);
  $('#chgSub').textContent = '共 '+top.length+' 条 · 默认展示影响选型最大的 '+N+' 条（排序为编辑判断）';
  $('#chgMore').textContent = state.chgAll ? '收起' : '展开其余 '+(top.length-N)+' 条';
  $('#changes').innerHTML = show.map(c=>
    '<article class="chg">'+
      '<div class="chg-meta"><span class="tag '+(KIND_COLOR[c.kind]||'')+'">'+esc(c.kind)+'</span><span class="d">'+esc(c.date.slice(5))+'</span></div>'+
      '<div>'+
        '<h3>'+esc(c.title)+'</h3>'+
        '<p>'+esc(c.detail)+'</p>'+
        (c.impact?'<p class="impact"><b>影响：</b>'+esc(c.impact)+'</p>':'')+
        (c.models.length ? '<div class="chg-refs">'+c.models.map(id=>{
            const m = byId[id]; if(!m) return '';
            return '<button class="mref" type="button" data-model="'+id+'">'+logoHTML(m.brand)+esc(m.name)+'</button>';
          }).join('')+'</div>' : '')+
      '</div>'+
    '</article>').join('');
}

function miniTable(list, opts){
  opts = opts || {};
  const cols = opts.cols || ['aaii','cai','cpt'];
  return '<thead><tr><th class="pick"><span class="sr">加入对比</span></th><th>模型</th>'+
    cols.map(k=>'<th class="n">'+esc(MET[k].short)+'<span class="th-sub">'+esc(COL_UNIT_SHORT[k]||'')+'</span></th>').join('')+
    '</tr></thead><tbody>'+
    list.map(m=>
      '<tr'+(inCmp(m.id)?' class="picked"':'')+' data-row="'+m.id+'">'+
        '<td class="pick"><button class="ck'+(inCmp(m.id)?' on':'')+'" type="button" data-cmp="'+m.id+'" aria-pressed="'+inCmp(m.id)+'" aria-label="把 '+esc(m.name)+' 加入对比">✓</button></td>'+
        '<td><span class="mcell">'+logoHTML(m.brand)+'<span class="txt"><span class="nm">'+esc(m.name)+'</span><span class="sub">'+esc(orgName(m.org))+'</span></span></span></td>'+
        cols.map(k=>{
          const val = m[k], t = fmtVal(k, val);
          return '<td class="n">'+(t ? esc(t)+'<span class="u">'+esc(unitOf(k))+'</span>' : '<span class="na">暂无数据</span>')+'</td>';
        }).join('')+
      '</tr>').join('')+'</tbody>';
}

function renderOverview(){
  $('#sbSnap').textContent  = META.dataSnapshot;
  $('#sbBasis').textContent = META.dataBasis;
  $('#sbBuilt').textContent = META.pageBuilt;
  $('#topSnap').textContent = META.dataSnapshot;
  $('#footSnap').textContent = META.dataSnapshot;
  $('#footBuilt').textContent = META.pageBuilt;

  renderChanges();

  const top = MODELS.filter(m=>m.aaii).sort((a,b)=>b.aaii.v-a.aaii.v).slice(0,8);
  $('#topTable').innerHTML = miniTable(top, {cols:['aaii','cai','cpt']});

  /* ---- 场景推荐：候选与依据都从当前数据算出 ---- */
  $('#scenes').innerHTML = SCENES.map(sc=>{
    const primary = sc.metrics[0];
    let cands = MODELS.filter(m => m[primary]);
    cands.sort((a,b)=>{
      for(const k of sc.metrics){
        const dir = (MET[k] && MET[k].better==='low') ? 1 : -1;   /* 价格类越低越靠前 */
        const r = cmpBy(a,b,k,dir); if(r) return r;
      }
      return 0;
    });
    const list = cands.slice(0,3);
    const thin = list.length < 2;
    const ev = k => (m)=>{ const t = fmtVal(k,m[k]); return t ? t+unitOf(k) : '—'; };
    return '<div class="scene">'+
      '<h3>'+esc(sc.name)+'</h3>'+
      '<p class="why">'+esc(sc.why)+'</p>'+
      (thin
        ? '<div class="empty" style="padding:18px;margin-top:10px">这一项的可比数据不足，只能列出<b style="display:inline">待比较候选</b>，不给结论。</div>'
        : '<ol>'+list.map((m,i)=>
            '<li><span class="rk">'+(i+1)+'</span>'+
              '<button class="nm" type="button" data-model="'+m.id+'" style="text-align:left">'+esc(m.name)+'</button>'+
              '<span class="ev">'+esc(ev(primary)(m))+' <span>'+esc(MET[primary].short)+'</span></span></li>').join('')+'</ol>')+
      '<p class="caveat"><b>注意：</b>'+esc(sc.caveat)+'</p>'+
      (list.length ? '<div class="act"><button class="btn sm" type="button" data-cmpset="'+list.map(m=>m.id).join(',')+'">对比这 '+list.length+' 个 →</button></div>' : '')+
    '</div>';
  }).join('');

  renderFav();
}

function renderFav(){
  const list = state.fav.map(id=>byId[id]).filter(Boolean);
  const sec = $('#secFav');
  sec.hidden = list.length === 0;
  if(list.length) $('#favTable').innerHTML = miniTable(list, {cols:['aaii','cai','cpt']});

  const rail = $('#railFav');
  rail.hidden = list.length === 0;
  $('#favList').innerHTML = list.map(m=>
    '<a href="#models" data-model="'+m.id+'">'+logoHTML(m.brand,'')+'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(m.name)+'</span></a>').join('');
}

/* ================================================================
   模型库
   ================================================================ */
function renderFilters(){
  const orgs = [];
  MODELS.forEach(m=>{ if(orgs.indexOf(m.org)<0) orgs.push(m.org); });
  orgs.sort((a,b)=> MODELS.filter(m=>m.org===b).length - MODELS.filter(m=>m.org===a).length);
  const flag = (k,label) => '<button class="pill'+(state.flags[k]?' on':'')+'" type="button" data-flag="'+k+'" aria-pressed="'+state.flags[k]+'">'+esc(label)+'</button>';
  $('#filters').innerHTML =
    '<div class="fgroup"><span class="lbl">厂商</span>'+
      orgs.map(o=>'<button class="pill'+(state.orgs.has(o)?' on':'')+'" type="button" data-org="'+o+'" aria-pressed="'+state.orgs.has(o)+'">'+
        logoHTML(o)+esc(orgName(o))+'</button>').join('')+
    '</div>'+
    '<div class="fgroup"><span class="lbl">条件</span>'+
      flag('open','开源权重')+flag('scored','有 AAII 分数')+flag('current','仅当前主力')+
    '</div>'+
    '<div class="fstatus">'+
      '<span id="fCount"></span>'+
      '<button class="btn sm ghost" type="button" id="fReset">清空筛选</button>'+
      '<span class="pop" id="colPop"><button class="btn sm" type="button" id="colBtn" aria-expanded="false">列设置</button>'+
        '<div class="pop-menu"><h4>显示哪些列</h4>'+
          COLS.map(c=>'<label><input type="checkbox" data-col="'+c.k+'"'+(state.cols.indexOf(c.k)>=0?' checked':'')+'>'+esc(c.special?c.label:MET[c.k].label)+'</label>').join('')+
        '</div></span>'+
    '</div>';
}

function licenseShort(m){
  const t = m.license || '';
  if(!t) return '';
  if(/Apache/i.test(t)) return 'Apache 2.0';
  if(/MIT/.test(t))     return 'MIT';
  if(/预告|将开源/.test(t)) return '待开源';
  if(/闭源/.test(t))    return '闭源';
  if(/未确认/.test(t))  return '未确认';
  if(/开源/.test(t))    return '开源';
  return t;
}
function cellFor(m, ck){
  if(ck==='license'){
    const open = m.openWeights===true, pend = m.openWeights==='pending';
    return '<td class="lic">'+(m.license
      ? '<span class="tag '+(open?'open':(pend?'warn':''))+'" title="'+esc(m.license)+'">'+esc(licenseShort(m))+'</span>'
      : '<span class="na">暂无数据</span>')+'</td>';
  }
  const val = m[ck], t = fmtVal(ck, val);
  if(!t) return '<td class="n"><span class="na">暂无数据</span></td>';
  return '<td class="n">'+esc(t)+'<span class="u">'+esc(unitOf(ck))+'</span>'+kindTag(val)+'</td>';
}

function renderModelTable(){
  const list = filtered();
  const cols = COLS.filter(c=> state.cols.indexOf(c.k)>=0);
  const sortable = k => 'class="'+(k==='license'?'lic':'n')+' sortable'+(state.sort.k===k?' sorted':'')+'" data-sort="'+k+'" role="button" tabindex="0" aria-sort="'+(state.sort.k===k?(state.sort.dir<0?'descending':'ascending'):'none')+'"';
  const arw = k => state.sort.k===k ? '<span class="arw">'+(state.sort.dir<0?'▾':'▴')+'</span>' : '<span class="arw">▾</span>';

  $('#modelTable').innerHTML =
    '<thead><tr>'+
      '<th class="pick"><span class="sr">加入对比</span></th>'+
      '<th class="fav"><span class="sr">关注</span></th>'+
      '<th class="sortable'+(state.sort.k==='name'?' sorted':'')+'" data-sort="name" role="button" tabindex="0">模型'+arw('name')+'</th>'+
      cols.map(c=>'<th '+sortable(c.k)+'>'+esc(colLabel(c))+arw(c.k)+
        '<span class="th-sub">'+esc(COL_UNIT[c.k]||'')+'</span></th>').join('')+
    '</tr></thead>'+
    '<tbody>'+ (list.length ? list.map(m=>
      '<tr'+(inCmp(m.id)?' class="picked"':'')+' data-row="'+m.id+'">'+
        '<td class="pick"><button class="ck'+(inCmp(m.id)?' on':'')+'" type="button" data-cmp="'+m.id+'" aria-pressed="'+inCmp(m.id)+'" aria-label="把 '+esc(m.name)+' 加入对比">✓</button></td>'+
        '<td class="fav"><button class="star'+(state.fav.indexOf(m.id)>=0?' on':'')+'" type="button" data-fav="'+m.id+'" aria-pressed="'+(state.fav.indexOf(m.id)>=0)+'" aria-label="关注 '+esc(m.name)+'">'+
          '<svg width="13" height="13" viewBox="0 0 16 16" fill="'+(state.fav.indexOf(m.id)>=0?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.3"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8Z"/></svg></button></td>'+
        '<td><button class="mcell" type="button" data-model="'+m.id+'" style="text-align:left">'+logoHTML(m.brand)+
          '<span class="txt"><span class="nm">'+esc(m.name)+(m.fresh?' <span class="tag brass">本期</span>':'')+'</span>'+
          '<span class="sub">'+esc(orgName(m.org))+(m.variant?' · '+esc(m.variant):'')+(m.released?' · <span class="mono">'+esc(m.released.slice(5))+'</span>':'')+'</span></span></button></td>'+
        cols.map(c=>cellFor(m,c.k)).join('')+
      '</tr>').join('')
      : '<tr><td colspan="'+(cols.length+3)+'"><div class="empty"><b>没有匹配的模型</b>换个关键词，或清空筛选条件再试。</div></td></tr>')+
    '</tbody>';

  const cnt = $('#fCount');
  if(cnt) cnt.innerHTML = '显示 <b class="mono">'+list.length+'</b> / '+MODELS.length+' 个模型';
  $('#tableNote').innerHTML = '共收录 <b>'+MODELS.length+'</b> 个模型条目、<b>'+
    (new Set(MODELS.map(m=>m.org))).size+'</b> 家厂商（统计口径：本页模型库实际收录数，含已被取代的上代与受限模型，不是全球在售模型总数）。'+
    '缺失值显示「暂无数据」，<b>排序时永远排在最后，不按 0 计算</b>。';
}

/* ================================================================
   深度对比：模型为列、指标为行
   ================================================================ */
function renderCompareUI(){
  const list = state.cmp.map(id=>byId[id]).filter(Boolean);
  $('#cmpCount').textContent = list.length;
  $('#tray').classList.toggle('show', list.length > 0);
  $('#traySlots').innerHTML =
    list.map(m=>'<span class="cchip">'+logoHTML(m.brand)+esc(m.name)+
      '<button class="x" type="button" data-cmp="'+m.id+'" aria-label="从对比中移除 '+esc(m.name)+'">✕</button></span>').join('')+
    Array(Math.max(0, 2 - list.length)).fill('<span class="cslot">待选</span>').join('');
  $$('[data-cmp]').forEach(b=>{
    const on = inCmp(b.dataset.cmp);
    if(b.classList.contains('ck')){ b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
  });
  $$('tr[data-row]').forEach(tr => tr.classList.toggle('picked', inCmp(tr.dataset.row)));
  renderCompare();
}

function renderCompare(){
  const list = state.cmp.map(id=>byId[id]).filter(Boolean);
  const tools = $('#cmpTools'), body = $('#cmpBody');

  if(list.length === 0){
    tools.innerHTML = '';
    body.innerHTML = '<div class="empty"><b>还没有选择模型</b>在上面的表格里勾选 2–4 个模型，这里会生成按「能力 / 价格 / 规格 / 使用方式 / 场景」分组的并排对比。<br>最多同时对比 '+MAXCMP+' 个；选满后再加会提示先移除一个，已选的不会被清掉。</div>';
    return;
  }
  tools.innerHTML =
    '<button class="btn sm'+(state.diffOnly?' on':'')+'" type="button" id="btnDiff" aria-pressed="'+state.diffOnly+'">只看差异</button>'+
    '<button class="btn sm" type="button" id="btnCmpClear">清空</button>';

  if(list.length === 1){
    body.innerHTML = '<div class="empty" style="margin-bottom:14px"><b>再选一个就能开始比较</b>已选 <b style="display:inline">'+esc(list[0].name)+'</b>，单个模型没有可比对象，「只看差异」和「最优值」都不会生效。</div>' + compareTable(list);
    return;
  }
  body.innerHTML = compareTable(list);
}

function rowCells(list, mk){
  const best = bestOf(list, mk);
  const cells = list.map(m=>{
    const val = m[mk], t = fmtVal(mk, val);
    if(!t){
      const note = mk==='ctx' && m.ctxNote ? '<span class="cnote">'+esc(m.ctxNote)+'</span>' : '';
      return {txt:'—', html:'<td><span class="cval none">暂无数据</span>'+note+'</td>'};
    }
    const isBest = best.v != null && val.v === best.v;
    return {txt:t, html:'<td><span class="cval'+(isBest?' best':'')+'">'+esc(t)+'<span class="u">'+esc(unitOf(mk))+'</span></span>'+
      kindTag(val, true) + (val.note ? '<span class="cnote">'+esc(val.note)+'</span>' : '') + '</td>'};
  });
  return {cells, best};
}

function compareTable(list){
  const bestNote = {
    nodir:'该项无优劣之分，不评最优',
    thin:'有效数据不足 2 个，不评最优',
    mixed:'所选模型的取值口径不一致（独立评测 / 官方自报混用），不评最优',
    est:'含估算值，不评最优'
  };
  let rows = '';

  /* --- 数值指标：按分组 --- */
  ['cap','cost','spec'].forEach(g=>{
    const grp = METRIC_GROUPS.find(x=>x.g===g);
    const mets = METRICS.filter(m=>m.g===g);
    let inner = '';
    mets.forEach(met=>{
      const {cells, best} = rowCells(list, met.k);
      const allSame = cells.every(c=>c.txt === cells[0].txt);
      if(state.diffOnly && allSame) return;
      const flag = best.v==null && best.reason && best.reason!=='nodir'
        ? '<span class="warnline">'+esc(bestNote[best.reason])+'</span>'
        : (best.partial ? '<span class="warnline">仅 '+best.have+' / '+list.length+' 个有数据，最优值只在有数据的之间比较</span>' : '');
      inner += '<tr><th class="rowh" scope="row">'+esc(met.label)+
        (met.better?'<span class="basis">'+(met.better==='high'?'越高越好':'越低越好')+' · '+esc(met.basis)+'</span>'
                   :'<span class="basis">'+esc(met.basis)+'</span>')+
        (met.warn?'<span class="warnline">'+esc(met.warn)+'</span>':'')+ flag +'</th>'+
        cells.map(c=>c.html).join('')+'</tr>';
    });
    if(inner) rows += '<tr class="grp"><td colspan="'+(list.length+1)+'">'+esc(grp.title)+
      (grp.note?'<span class="gn">'+esc(grp.note)+'</span>':'')+'</td></tr>' + inner;
  });

  /* --- 文本行 --- */
  const textRows = [
    {g:'use',  label:'计价方式',   get:m=>m.priceMode || '', extra:m=>m.priceAlt||''},
    {g:'use',  label:'开放状态',   get:m=>m.license || ''},
    {g:'use',  label:'使用方式',   get:m=>m.access || ''},
    {g:'use',  label:'发布日期',   get:m=>m.released || '', mono:true},
    {g:'fit',  label:'适用场景',   get:m=>m.strength || ''},
    {g:'fit',  label:'已知限制',   get:m=>m.limits || ''},
    {g:'fit',  label:'技术要点',   get:m=>m.tech || ''},
    {g:'fit',  label:'数据来源',   get:m=>(m.srcs||[]).map(s=>SOURCES[s]?SOURCES[s].name:s).join(' · ')}
  ];
  ['use','fit'].forEach(g=>{
    const grp = METRIC_GROUPS.find(x=>x.g===g);
    let inner = '';
    textRows.filter(r=>r.g===g).forEach(r=>{
      const vals = list.map(m=>{
        let t = r.get(m); const ex = r.extra ? r.extra(m) : '';
        return {txt:t, html:'<td>'+(t ? '<span class="ctext'+(r.mono?' mono':'')+'">'+esc(t)+'</span>' : '<span class="cval none">暂无数据</span>')+
          (ex?'<span class="cnote">'+esc(ex)+'</span>':'')+'</td>'};
      });
      if(state.diffOnly && vals.every(v=>v.txt===vals[0].txt)) return;
      inner += '<tr><th class="rowh" scope="row">'+esc(r.label)+'</th>'+vals.map(v=>v.html).join('')+'</tr>';
    });
    if(inner) rows += '<tr class="grp"><td colspan="'+(list.length+1)+'">'+esc(grp.title)+'</td></tr>' + inner;
  });

  if(!rows) rows = '<tr><td colspan="'+(list.length+1)+'"><div class="empty"><b>这几个模型在所有指标上的展示值都相同</b>关掉「只看差异」可以看到完整对比。</div></td></tr>';

  return '<div class="cmp-wrap"><table class="cmp"><thead><tr>'+
    '<th class="rowh">指标</th>'+
    list.map(m=>'<th><div class="cmp-h"><div class="t">'+logoHTML(m.brand,'lg')+
      '<div><div class="nm">'+esc(m.name)+'</div><div class="org">'+esc(orgName(m.org))+(m.variant?' · '+esc(m.variant):'')+'</div></div></div>'+
      '<button class="drop" type="button" data-cmp="'+m.id+'">移出对比</button></div></th>').join('')+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

/* ================================================================
   价格与使用
   ================================================================ */
function renderPricing(){
  const priced = MODELS.filter(m=>m.priceIn || m.priceOut)
    .sort((a,b)=> cmpBy(a,b,'priceOut',1) || 0);
  $('#priceSub').textContent = '美元 / 每百万 token · 共 '+priced.length+' 个有公开标价的模型 · 核验日 '+META.dataBasis;
  $('#priceTable').innerHTML =
    '<thead><tr><th class="pick"><span class="sr">加入对比</span></th><th>模型</th>'+
      '<th class="n">输入<span class="th-sub">$ / 百万 token</span></th>'+
      '<th class="n">输出<span class="th-sub">$ / 百万 token</span></th>'+
      '<th class="n">缓存命中<span class="th-sub">$ / 百万 token</span></th>'+
      '<th>计价方式<span class="th-sub">促销 / 峰谷 / 渠道</span></th></tr></thead><tbody>'+
    priced.map(m=>
      '<tr'+(inCmp(m.id)?' class="picked"':'')+' data-row="'+m.id+'">'+
        '<td class="pick"><button class="ck'+(inCmp(m.id)?' on':'')+'" type="button" data-cmp="'+m.id+'" aria-pressed="'+inCmp(m.id)+'" aria-label="把 '+esc(m.name)+' 加入对比">✓</button></td>'+
        '<td><button class="mcell" type="button" data-model="'+m.id+'" style="text-align:left">'+logoHTML(m.brand)+
          '<span class="txt"><span class="nm">'+esc(m.name)+'</span><span class="sub">'+esc(orgName(m.org))+'</span></span></button></td>'+
        ['priceIn','priceOut','priceCache'].map(k=>{
          const t = fmtVal(k,m[k]);
          return '<td class="n">'+(t?esc(t):'<span class="na">暂无数据</span>')+(m[k]&&m[k].note?'<span class="cnote">'+esc(m[k].note)+'</span>':'')+'</td>';
        }).join('')+
        '<td style="font-size:12.5px;color:var(--ink-3);line-height:1.6;max-width:32ch">'+
          (m.priceMode?esc(m.priceMode):'<span class="na">暂无数据</span>')+
          (m.priceWas?'<br>原价 <span class="mono">'+esc(m.priceWas)+'</span>':'')+
          (m.priceAlt?'<br>'+esc(m.priceAlt):'')+'</td>'+
      '</tr>').join('')+
    '</tbody><tfoot><tr><td colspan="6">未列出的模型本期没有公开 API 标价（端侧、受限或仅走订阅），显示为「暂无数据」而不是 0。订阅套餐见本页最下方，两者不可相加。</td></tr></tfoot>';

  /* 速度与规格 */
  const spec = MODELS.filter(m=>m.speed||m.ctx||m.maxOut||m.paramsTotal)
    .sort((a,b)=> cmpBy(a,b,'ctx',-1) || cmpBy(a,b,'speed',-1));
  $('#specTable').innerHTML =
    '<thead><tr><th>模型</th>'+
      ['speed','ctx','maxOut','paramsTotal','paramsAct'].map(k=>'<th class="n">'+esc(MET[k].label)+'</th>').join('')+
    '</tr></thead><tbody>'+
    spec.map(m=>'<tr data-row="'+m.id+'"><td><button class="mcell" type="button" data-model="'+m.id+'" style="text-align:left">'+
      logoHTML(m.brand)+'<span class="txt"><span class="nm">'+esc(m.name)+'</span></span></button></td>'+
      ['speed','ctx','maxOut','paramsTotal','paramsAct'].map(k=>{
        const t = fmtVal(k,m[k]);
        return '<td class="n">'+(t?esc(t)+'<span class="u">'+esc(unitOf(k))+'</span>':'<span class="na">暂无数据</span>')+'</td>';
      }).join('')+'</tr>').join('')+
    '</tbody><tfoot><tr><td colspan="6">上下文窗口、最大输出长度、参数量是三件不同的事，本表分列。原始资料里把 753B、428B 这类参数量填进上下文列的条目已改为「暂无数据」并列入待核实清单。</td></tr></tfoot>';

  /* 模型 × Agent */
  $('#agentTable').innerHTML =
    '<thead><tr><th>模型 \\ Agent 框架</th>'+AGENT_FRAMEWORKS.map(f=>'<th class="n" style="text-align:center">'+esc(f)+'</th>').join('')+'</tr></thead><tbody>'+
    AGENT_MATRIX.map(r=>{
      const m = byId[r.id]; if(!m) return '';
      return '<tr><td><button class="mcell" type="button" data-model="'+m.id+'" style="text-align:left">'+logoHTML(m.brand)+
        '<span class="txt"><span class="nm">'+esc(m.name)+'</span></span></button></td>'+
        r.cells.map(c=>'<td class="c '+c.t+'">'+(c.s!=null?c.s.toFixed(1):(c.t==='native'?'✓':c.t==='compat'?'~':'—'))+
          (c.note?'<span class="sub">'+esc(c.note)+'</span>':'')+'</td>').join('')+'</tr>';
    }).join('')+'</tbody>';

  /* 订阅 */
  $('#subsGrid').innerHTML = SUBSCRIPTIONS.map(s=>
    '<div class="plan"><div class="sh">'+(s.multi?'':logoHTML(s.brand,'lg'))+'<div><div class="nm">'+esc(s.product)+'</div>'+
      '<div class="co">'+esc(s.multi ? (s.sub||'多家厂商') : orgName(s.brand))+'</div></div></div>'+
    '<dl>'+s.tiers.map(t=>'<div class="r"><dt>'+esc(t[0])+'</dt><dd>'+esc(t[1])+'</dd></div>').join('')+'</dl>'+
    (s.note?'<p class="note">'+esc(s.note)+'</p>':'')+'</div>').join('');
}

/* ---- 散点：AAII vs 输出单价（对数），两轴都是页面已有的单一口径数据 ---- */
function drawChart(){
  const box = $('#chartBox'); if(!box) return;
  const pts = MODELS.filter(m=>m.aaii && m.cpt);
  if(pts.length < 3){
    box.innerHTML = '<div class="empty"><b>可靠数据不足，改用表格</b>同时具备智能指数与单任务成本的模型少于 3 个，画散点没有意义。</div>';
    return;
  }
  const xs = pts.map(p=>p.cpt.v), ys = pts.map(p=>p.aaii.v);
  const x0 = Math.log10(Math.min.apply(null,xs)*0.72), x1 = Math.log10(Math.max.apply(null,xs)*1.35);
  const y0 = Math.max(0, Math.floor(Math.min.apply(null,ys)/10)*10 - 2), y1 = Math.ceil(Math.max.apply(null,ys)/10)*10 + 2;

  box.innerHTML = '<div class="chart" id="chart" role="img" aria-label="散点图：纵轴为 Artificial Analysis 智能指数 v4.3，横轴为跑完一道智能指数任务的实测成本，美元，对数刻度"></div><span class="ax-x">单任务实测成本（美元，对数刻度）→ 越左越便宜</span>';
  const c = $('#chart');
  const W = c.clientWidth, H = c.clientHeight;
  const X = v => ((Math.log10(v)-x0)/(x1-x0))*W;
  const Y = v => (1-(v-y0)/(y1-y0))*H;
  let html = '<span class="ax-y">AAII 智能指数 →</span>';
  for(let i=0;i<=4;i++){
    const val = y0 + (y1-y0)/4*i, top = Y(val);
    html += '<span class="gl" style="top:'+top+'px"></span><span class="gy" style="top:'+top+'px">'+val.toFixed(0)+'</span>';
  }
  [0.05,0.1,0.25,0.5,1,2,5,10].forEach(t=>{ if(Math.log10(t)>=x0 && Math.log10(t)<=x1) html += '<span class="gx" style="left:'+X(t)+'px">$'+t+'</span>'; });
  /* 标签避让：同一片区域只显示第一个标签，其余只留悬停提示，
     否则密集区会糊成一团。优先给智能指数高的点留标签。 */
  const placed = [];
  const sorted = pts.slice().sort((a,b)=> b.aaii.v - a.aaii.v);
  const showLabel = {};
  sorted.forEach(p=>{
    const px = X(p.cpt.v), py = Y(p.aaii.v);
    const clash = placed.some(q => Math.abs(q.x-px) < 96 && Math.abs(q.y-py) < 13);
    if(!clash || inCmp(p.id)){ showLabel[p.id] = true; placed.push({x:px,y:py}); }
  });
  pts.forEach(p=>{
    const px = X(p.cpt.v), py = Y(p.aaii.v);
    const flip = px > W*0.66;   /* 靠右的点，标签翻到左边，避免溢出画布 */
    const price = p.priceIn && p.priceOut ? ' · 标价 $'+p.priceIn.v+' / $'+p.priceOut.v+' 每百万 token' : '';
    html += '<span class="pt'+(inCmp(p.id)?' mark':'')+'" style="left:'+px+'px;top:'+py+'px" tabindex="0" role="button" data-model="'+p.id+'" '+
      'title="'+esc(p.name+' · 智能指数 '+p.aaii.v+' · 单任务成本 $'+p.cpt.v.toFixed(2)+price)+'">'+
      (showLabel[p.id] ? '<span class="pl'+(flip?' left':'')+'">'+esc(p.name)+'</span>' : '')+
      '</span>';
  });
  c.innerHTML = html;
}

/* ================================================================
   动态与资料
   ================================================================ */
function renderIntel(){
  $('#vendorTable').innerHTML =
    '<thead><tr><th>厂商</th><th>代表模型</th><th>本期一句话</th><th class="n">收录模型</th></tr></thead><tbody>'+
    VENDORS.map(v=>
      '<tr><td><button class="mcell" type="button" data-vendor="'+v.key+'" style="text-align:left">'+logoHTML(v.key,'lg')+
        '<span class="txt"><span class="nm">'+esc(orgName(v.key))+(v.fresh?' <span class="tag brass">本期</span>':'')+'</span></span></button></td>'+
      '<td style="font-size:12.5px;color:var(--ink-3);max-width:24ch">'+esc(v.family)+'</td>'+
      '<td style="font-size:13px;color:var(--ink-2);max-width:46ch">'+esc(v.lede)+'</td>'+
      '<td class="n">'+v.models.length+'</td></tr>').join('')+
    '</tbody>';

  $('#timeline').innerHTML = TIMELINE.slice().reverse().map(t=>
    '<div class="tli'+(t.hot?' hot':'')+'"><span class="d">'+esc(t.d)+(t.last?' ·':'')+'</span>'+
      '<h3>'+esc(t.t)+'</h3><p>'+esc(t.x)+'</p></div>').join('');

  $('#notesSub').textContent = '共 '+NOTES.length+' 条 · 点开看完整内容与来源';
  $('#notes').innerHTML = NOTES.map(n=>
    '<details class="row-x"><summary>'+
      '<span class="caret" aria-hidden="true">›</span>'+
      '<span class="fig">'+esc(n.n)+'</span>'+
      '<span class="ttl">'+esc(n.t)+'</span>'+
      '<span class="src">'+esc(n.s)+'</span>'+
    '</summary><div class="body">'+esc(n.d)+
      ((n.models&&n.models.length)?'<div class="refs">'+n.models.map(id=>{
        const m = byId[id]; return m?'<button class="mref" type="button" data-model="'+id+'">'+logoHTML(m.brand)+esc(m.name)+'</button>':'';
      }).join('')+'</div>':'')+
    '</div></details>').join('');

  renderVoices();

  $('#srcTable').innerHTML =
    '<thead><tr><th>来源</th><th>类型</th><th class="n">快照日期</th><th>覆盖内容</th></tr></thead><tbody>'+
    Object.keys(SOURCES).map(k=>{
      const s = SOURCES[k];
      const nm = s.url ? '<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.name)+' ↗</a>' : esc(s.name);
      return '<tr><td><span class="mcell">'+(s.brand?logoHTML(s.brand):'')+'<span class="txt"><span class="nm">'+nm+'</span>'+
        (s.url?'<span class="sub">仅站点首页链接，非逐条证据</span>':'<span class="sub">无统一链接</span>')+'</span></span></td>'+
        '<td class="u" style="font-size:12.5px;color:var(--ink-3)">'+esc(s.kind)+'</td>'+
        '<td class="n">'+esc(s.asOf)+'</td>'+
        '<td style="font-size:12.5px;color:var(--ink-3);max-width:40ch">'+esc(s.note||'')+'</td></tr>';
    }).join('')+'</tbody>';

  const todo = CONFLICTS.filter(c=>c.status==='待核实'||c.status==='数据缺失').length;
  $('#conflictSub').textContent = '共 '+CONFLICTS.length+' 条 · 其中 '+todo+' 条待核实';
  $('#conflictTable').innerHTML =
    '<thead><tr><th>模型</th><th>项目</th><th>两个说法</th><th>状态</th></tr></thead><tbody>'+
    CONFLICTS.map(c=>{
      const m = byId[c.model];
      const st = (c.status==='待核实'||c.status==='数据缺失') ? 'todo' : (c.status==='已修复'?'fixed':'');
      return '<tr><td>'+(m?'<button class="mcell" type="button" data-model="'+m.id+'" style="text-align:left">'+logoHTML(m.brand)+
        '<span class="txt"><span class="nm">'+esc(m.name)+'</span></span></button>':'<span class="dim">通用</span>')+'</td>'+
        '<td style="font-size:13px">'+esc(c.field)+'</td>'+
        '<td class="ab" style="max-width:48ch"><i>A</i> '+esc(c.a)+(c.b!=='—'?'<br><i>B</i> '+esc(c.b):'')+
          '<br><span class="dim" style="font-size:12px">'+esc(c.why)+'</span></td>'+
        '<td><span class="st '+st+'">'+esc(c.status)+'</span></td></tr>';
    }).join('')+'</tbody>';
}

function renderVoices(){
  const list = state.voiceAll ? VOICES : VOICES.filter(v=>v.key).concat(VOICES.filter(v=>!v.key)).slice(0,6);
  $('#voiceSub').textContent = '共 '+VOICES.length+' 条 · 默认展示 6 条';
  $('#voiceMore').textContent = state.voiceAll ? '收起' : '展开全部 '+VOICES.length+' 条';
  $('#voices').innerHTML = list.map(v=>
    '<figure class="quote'+(v.key?' key':'')+'"><q>'+esc(v.q)+'</q>'+
      '<figcaption class="by"><b>'+esc(v.a)+'</b> · '+esc(v.r)+'<span class="mono">'+esc(v.d)+'</span></figcaption></figure>').join('');
}

/* ================================================================
   抽屉
   ================================================================ */
let lastFocus = null;
function openDrawer(){ lastFocus = document.activeElement; $('#drawer').classList.add('open'); $('#drawer .x').focus(); }
function closeDrawer(){ $('#drawer').classList.remove('open'); if(lastFocus) lastFocus.focus(); }

function openModel(id){
  const m = byId[id]; if(!m) return;
  $('#drawerLogo').outerHTML = logoHTML(m.brand,'xl').replace('class="logo', 'id="drawerLogo" class="logo');
  $('#drawerTitle').textContent = m.name;
  $('#drawerSub').innerHTML = esc(orgName(m.org)) + (m.variant?' · '+esc(m.variant):'') +
    (m.released?' · 发布 <span class="mono">'+esc(m.released)+'</span>':'') + (m.tag?' · '+esc(m.tag):'');

  const specRow = (label, k) => {
    const t = fmtVal(k, m[k]);
    const note = (m[k] && m[k].note) ? '<small>'+esc(m[k].note)+'</small>' : (k==='ctx'&&m.ctxNote?'<small>'+esc(m.ctxNote)+'</small>':'');
    return '<div class="r"><span class="k">'+esc(label)+'</span><span class="v">'+
      (t? esc(t)+esc(unitOf(k))+kindTag(m[k], true) : '<span class="na">暂无数据</span>') + note + '</span></div>';
  };
  const group = g => METRICS.filter(x=>x.g===g).map(x=>specRow(x.label, x.k)).join('');

  $('#drawerBody').innerHTML =
    '<div class="dsec"><h3>能力与评测</h3><div class="dspecs">'+group('cap')+'</div></div>'+
    '<div class="dsec"><h3>价格与速度</h3><div class="dspecs">'+group('cost')+
      (m.priceMode?'<div class="r"><span class="k">计价方式</span><span class="v" style="font-family:var(--sans);font-size:12.5px">'+esc(m.priceMode)+(m.priceAlt?'<small>'+esc(m.priceAlt)+'</small>':'')+'</span></div>':'')+
      '</div></div>'+
    '<div class="dsec"><h3>上下文与输入输出</h3><div class="dspecs">'+group('spec')+'</div></div>'+
    '<div class="dsec"><h3>使用方式</h3><div class="dspecs">'+
      '<div class="r"><span class="k">开放状态</span><span class="v" style="font-family:var(--sans);font-size:13px">'+esc(m.license||'暂无数据')+'</span></div>'+
      '<div class="r"><span class="k">获取渠道</span><span class="v" style="font-family:var(--sans);font-size:13px;max-width:60%">'+esc(m.access||'暂无数据')+'</span></div>'+
    '</div></div>'+
    (m.strength?'<div class="dsec"><h3>适用场景</h3><p>'+esc(m.strength)+'</p></div>':'')+
    (m.limits  ?'<div class="dsec"><h3>已知限制</h3><p>'+esc(m.limits)+'</p></div>':'')+
    (m.tech    ?'<div class="dsec"><h3>技术要点</h3><p>'+esc(m.tech)+'</p></div>':'')+
    '<div class="dsec"><h3>数据来源</h3><p>'+ ((m.srcs&&m.srcs.length)
        ? m.srcs.map(s=>{const o=SOURCES[s]; return o? (o.url?'<a href="'+esc(o.url)+'" target="_blank" rel="noopener" style="border-bottom:1px solid var(--line-2)">'+esc(o.name)+' ↗</a>':esc(o.name)) : esc(s);}).join(' · ')
        : '<span class="na">本期无明确来源记录</span>') +
      '</p><p style="font-size:12px;color:var(--ink-3);margin-top:8px">这些链接指向来源站点首页，不是该模型每一项数据的逐条证据。</p></div>';

  $('#drawerFoot').innerHTML =
    '<button class="btn'+(inCmp(id)?' on':'')+'" type="button" data-cmp="'+id+'">'+(inCmp(id)?'已在对比中 · 移除':'加入对比')+'</button>'+
    '<button class="btn'+(state.fav.indexOf(id)>=0?' on':'')+'" type="button" data-fav="'+id+'">'+(state.fav.indexOf(id)>=0?'已关注':'关注')+'</button>'+
    '<button class="btn ghost" type="button" data-close style="margin-left:auto">关闭</button>';
  openDrawer();
}

function openVendor(key){
  const v = VENDORS.find(x=>x.key===key); if(!v) return;
  $('#drawerLogo').outerHTML = logoHTML(key,'xl').replace('class="logo', 'id="drawerLogo" class="logo');
  $('#drawerTitle').textContent = orgName(key);
  $('#drawerSub').textContent = v.family;
  $('#drawerBody').innerHTML =
    '<div class="dsec"><p>'+esc(v.lede)+'</p></div>'+
    (v.facts && v.facts.length ? '<div class="dfacts">'+v.facts.map(f=>'<div class="f"><span class="k">'+esc(f[0])+'</span><span class="v">'+esc(f[1])+'</span></div>').join('')+'</div>' : '')+
    (v.tech ? '<div class="dsec"><h3>技术特点</h3><p>'+esc(v.tech)+'</p></div>':'')+
    (v.scene?'<div class="dsec"><h3>优势场景</h3><p>'+esc(v.scene)+'</p></div>':'')+
    (v.keypoints?'<div class="dsec"><h3>关键点</h3><p>'+esc(v.keypoints)+'</p></div>':'')+
    '<div class="dsec"><h3>本页收录的模型（'+v.models.length+'）</h3><div class="dspecs">'+
      v.models.map(id=>{ const m=byId[id]; if(!m) return '';
        return '<div class="r"><span class="k"><button type="button" data-model="'+id+'" style="color:var(--ink);font-size:13px">'+esc(m.name)+'</button></span>'+
          '<span class="v">'+(m.aaii?'AAII '+fmtVal('aaii',m.aaii):'<span class="na">暂无分数</span>')+'</span></div>';
      }).join('')+'</div></div>'+
    (v.foot?'<div class="dsec"><h3>速览</h3><p class="mono" style="font-size:12.5px">'+esc(v.foot)+'</p></div>':'');
  /* 只有在确实有 2 个以上可比模型时才给「对比」按钮，
     否则点下去等于把已选的对比清空 */
  const cands = v.models.filter(id=>byId[id] && byId[id].aaii).slice(0, MAXCMP);
  $('#drawerFoot').innerHTML =
    (cands.length >= 2
      ? '<button class="btn" type="button" data-cmpset="'+cands.join(',')+'">对比该厂商的 '+cands.length+' 个模型</button>'
      : '<span class="dim" style="font-size:12.5px;align-self:center">该厂商本期只有 '+cands.length+' 个带分数的模型，不足以横向比较</span>')+
    '<button class="btn ghost" type="button" data-close style="margin-left:auto">关闭</button>';
  openDrawer();
}

/* ================================================================
   事件
   ================================================================ */
function setCmpSet(ids){
  const next = ids.filter(id=>byId[id]).slice(0, MAXCMP);
  if(!next.length){ toast('没有可加入对比的模型', true); return; }
  state.cmp = next;
  store.set('cmp', state.cmp);
  renderModelTable(); renderCompareUI(); renderOverview();
  go('models');
  setTimeout(()=>{ const el = $('#secCompare'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); }, 60);
}

document.addEventListener('click', function(e){
  const t = e.target.closest('[data-cmp],[data-fav],[data-model],[data-vendor],[data-org],[data-flag],[data-sort],[data-view],[data-goto],[data-cmpset],[data-close]');
  if(!t) { const pop = $('#colPop'); if(pop && !e.target.closest('#colPop')) pop.classList.remove('open'); return; }

  if(t.dataset.close !== undefined){
    closeDrawer(); $('#updDialog').classList.remove('open'); return;
  }
  if(t.dataset.cmpset !== undefined){ setCmpSet(t.dataset.cmpset.split(',').filter(Boolean)); closeDrawer(); return; }
  if(t.dataset.cmp){
    e.preventDefault();
    if(toggleCmp(t.dataset.cmp)){ renderModelTable(); renderOverview(); if(state.view==='pricing'){ renderPricing(); drawChart(); } }
    if($('#drawer').classList.contains('open')){ const id=t.dataset.cmp; if(t.closest('.df')) openModel(id); }
    renderCompareUI();
    return;
  }
  if(t.dataset.fav){ e.preventDefault(); toggleFav(t.dataset.fav); if($('#drawer').classList.contains('open')) openModel(t.dataset.fav); return; }
  if(t.dataset.model){ e.preventDefault(); openModel(t.dataset.model); return; }
  if(t.dataset.vendor){ e.preventDefault(); openVendor(t.dataset.vendor); return; }
  if(t.dataset.org){
    const o = t.dataset.org;
    state.orgs.has(o) ? state.orgs.delete(o) : state.orgs.add(o);
    renderFilters(); renderModelTable(); return;
  }
  if(t.dataset.flag){ state.flags[t.dataset.flag] = !state.flags[t.dataset.flag]; renderFilters(); renderModelTable(); return; }
  if(t.dataset.sort){
    const k = t.dataset.sort;
    if(state.sort.k === k) state.sort.dir *= -1;
    else{
      state.sort.k = k;
      /* 首次点某列时给一个符合直觉的方向：越低越好的列（价格）默认从便宜到贵 */
      state.sort.dir = (k==='name' || (MET[k] && MET[k].better==='low')) ? 1 : -1;
    }
    renderModelTable(); return;
  }
  if(t.dataset.view){ return; }                      /* 交给 hashchange */
  if(t.dataset.goto){ e.preventDefault(); location.hash = t.dataset.goto; return; }
});

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){ closeDrawer(); $('#updDialog').classList.remove('open'); $('#colPop') && $('#colPop').classList.remove('open'); }
  const d = e.target.dataset;
  if((e.key === 'Enter' || e.key === ' ') && d && (d.sort || d.model || d.vendor)){
    if(e.target.tagName !== 'BUTTON'){ e.preventDefault(); e.target.click(); }
  }
  /* 抽屉内做一个简单的焦点环，Tab 不跑到背后的页面上 */
  if(e.key === 'Tab'){
    const dr = $('#drawer');
    if(dr && dr.classList.contains('open')){
      const f = $$('button, a[href], input, [tabindex="0"]', dr).filter(x=>x.offsetParent !== null);
      if(f.length){
        const first = f[0], last = f[f.length-1];
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    }
  }
});

$('#q').addEventListener('input', function(){
  state.q = this.value;
  $('#qClear').hidden = !this.value;
  renderModelTable();
  if(state.view !== 'models' && this.value.trim()) location.hash = 'models';
});
$('#qClear').addEventListener('click', function(){ $('#q').value=''; state.q=''; this.hidden=true; renderModelTable(); $('#q').focus(); });

document.addEventListener('change', function(e){
  const cb = e.target.closest('[data-col]'); if(!cb) return;
  const k = cb.dataset.col, i = state.cols.indexOf(k);
  if(cb.checked && i<0) state.cols.push(k);
  if(!cb.checked && i>=0) state.cols.splice(i,1);
  /* 保持 COLS 里定义的列序，避免勾选顺序打乱表头 */
  state.cols.sort((a,b)=> COLS.findIndex(c=>c.k===a) - COLS.findIndex(c=>c.k===b));
  store.set('cols', state.cols);
  renderModelTable();
});

document.addEventListener('click', function(e){
  if(e.target.closest('#colBtn')){ const p = $('#colPop'); p.classList.toggle('open'); $('#colBtn').setAttribute('aria-expanded', p.classList.contains('open')); }
  if(e.target.closest('#fReset')){ state.orgs.clear(); state.flags={open:false,scored:false,current:false}; state.q=''; $('#q').value=''; $('#qClear').hidden=true; renderFilters(); renderModelTable(); }
  if(e.target.closest('#btnDiff')){ state.diffOnly = !state.diffOnly; renderCompare(); }
  if(e.target.closest('#btnCmpClear') || e.target.closest('#trayClear')){ state.cmp=[]; store.set('cmp',[]); renderModelTable(); renderCompareUI(); renderOverview(); if(state.view==='pricing') drawChart(); }
  if(e.target.closest('#trayGo') || e.target.closest('#btnCompare')){
    location.hash = 'models';
    setTimeout(()=>{ const el=$('#secCompare'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 60);
  }
  if(e.target.closest('#chgMore')){ state.chgAll = !state.chgAll; renderChanges(); }
  if(e.target.closest('#voiceMore')){ state.voiceAll = !state.voiceAll; renderVoices(); }
  if(e.target.closest('#favCompare')){ setCmpSet(state.fav.slice(0,MAXCMP)); }
  if(e.target.closest('#btnUpdate')){ $('#updDialog').classList.add('open'); $('#updCopy').focus(); }
});

/* 更新指令：这个按钮只做「复制文字」，不做也做不了真正的数据更新 */
$('#updCmd').textContent = META.updateCommand;
$('#updMeta').innerHTML = '当前数据抓取于 <b class="mono">'+esc(META.dataSnapshot)+'</b> · 页面生成 <b class="mono">'+esc(META.pageBuilt)+'</b><br>'+
  '这是一个纯静态页面，没有后端、没有定时任务，也没有抓取脚本。';
$('#updCopy').addEventListener('click', async function(){
  const txt = $('#updCmd').textContent.trim();
  let ok = false;
  try{ await navigator.clipboard.writeText(txt); ok = true; }
  catch(err){
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try{ ok = document.execCommand('copy'); }catch(e2){ ok = false; }
    ta.remove();
  }
  toast(ok ? '已复制更新指令，回到 AI 助手粘贴发送' : '复制失败，请手动选中上方文字复制', !ok);
});

window.addEventListener('hashchange', ()=> go(location.hash.slice(1)));
let rt = null;
window.addEventListener('resize', ()=>{ clearTimeout(rt); rt = setTimeout(()=>{ if(state.view==='pricing') drawChart(); }, 160); }, {passive:true});

/* ---------------- 启动 ---------------- */
renderNav();
renderOverview();
renderFilters();
renderModelTable();
renderPricing();
renderIntel();
renderCompareUI();
go(location.hash.slice(1) || 'overview');

})();
