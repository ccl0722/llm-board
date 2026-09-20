/* ==========================================================
   data.js  ·  数据层（唯一事实来源）
   --------------------------------------------------------
   本次数据抓取日：2026-09-19，来源全部为公开权威榜单（见 SOURCES）。
   仍然没有自动更新管线 —— 页面不会自己变新，下次更新要重新跑一遍采集。

   ★ 本期最重要的口径变更（影响与上一版所有历史数字的可比性）：
     1. Artificial Analysis 智能指数已从 v4.1.1 升到 v4.3，评测从 9 项变 10 项
        并重新标定。上一版页面里 Opus 5 = 63.1 那套分数与本版 51 不是同一把尺，
        绝对不能混排、不能算涨跌。
     2. Terminal-Bench 主版本从 3.0 走到 4.0（66 题，重新标定算力与时限）。
        TB 2.1 已饱和（头部 91%），TB 4.0 头部只有 59%。两者仍然不可互比。
     3. Coding Agent Index 升到 v1.5，改由 DeepSWE v1.1 + Terminal-Bench 4.0
        + SWE-Atlas-QnA 三项等权合成，与 v1.4 及以前不可比。
     4. vals.ai 已于 2026-09-01 归档 SWE-bench Verified（成绩饱和，不再跑新模型）。
        因此 GPT-6 Astra / Claude Fable 5.1 / Muse Spark 1.3 / DeepSeek V4.1 Flash
        这些新模型永远不会有 SWE-bench 分数 —— 这不是数据缺失，是基准停更。

   每个指标值都带口径（basis）、来源（src）、类型（kind）与备注。
   缺失一律写 null —— 渲染层显示「暂无数据」，且不参与排序与最优值计算。

   kind 取值：
     ind    独立评测（第三方机构实测）
     vendor 厂商官方自报 / 官方定价
     est    估算、部分评测或带 * 号的近似值
     edit   本报告编辑判断（非测量值）
   ========================================================== */

const META = {
  pageBuilt:   '2026-09-19',   // 这一版页面的生成日期
  dataSnapshot:'2026-09-19',   // 数据抓取日
  dataBasis:   '2026-09-19',   // 榜单读取日（AA 与 Arena 均为滚动更新，不标注单期日期）
  arenaAsOf:   '2026-09-19',
  updatePipeline: false,       // 无自动更新管线 —— 不得声称「每日自动更新」
  updateCommand: '更新报告'
};

/* ---------- 品牌标识：公司 / 模型家族分开登记 ---------- */
/* logo 留空 => 界面自动退化为品牌全名文字，不使用首字母头像 */
const BRANDS = {
  anthropic:  {name:'Anthropic',            logo:'assets/logos/anthropic.svg'},
  claude:     {name:'Claude',               logo:'assets/logos/claude.svg',     of:'anthropic'},
  openai:     {name:'OpenAI',               logo:'assets/logos/openai.svg'},
  google:     {name:'Google',               logo:'assets/logos/google.svg'},
  gemini:     {name:'Gemini',               logo:'assets/logos/gemini.svg',     of:'google'},
  antigravity:{name:'Antigravity',          logo:'assets/logos/antigravity.svg',of:'google'},
  xai:        {name:'xAI / SpaceXAI',       logo:'assets/logos/xai.svg'},
  grok:       {name:'Grok',                 logo:'assets/logos/grok.svg',       of:'xai'},
  meta:       {name:'Meta',                 logo:'assets/logos/meta.svg'},
  moonshot:   {name:'月之暗面 Moonshot AI',  logo:'assets/logos/moonshot.svg'},
  kimi:       {name:'Kimi',                 logo:'assets/logos/kimi.svg',       of:'moonshot'},
  alibaba:    {name:'阿里巴巴',              logo:'assets/logos/alibaba.svg'},
  qwen:       {name:'通义千问 Qwen',         logo:'assets/logos/qwen.svg',       of:'alibaba'},
  deepseek:   {name:'DeepSeek 深度求索',     logo:'assets/logos/deepseek.svg'},
  zai:        {name:'Z.ai 智谱',            logo:'assets/logos/zai.svg'},
  minimax:    {name:'MiniMax',              logo:'assets/logos/minimax.svg'},
  xiaomi:     {name:'小米',                  logo:'assets/logos/xiaomi.svg'},
  tencent:    {name:'腾讯',                  logo:'assets/logos/tencent.svg'},
  hunyuan:    {name:'腾讯混元',              logo:'assets/logos/hunyuan.svg',    of:'tencent'},
  mistral:    {name:'Mistral AI',           logo:'assets/logos/mistral.svg'},
  nvidia:     {name:'NVIDIA',               logo:'assets/logos/nvidia.svg'},
  motif:      {name:'Motif Technologies',   logo:'assets/logos/motif.svg',      wide:true},
  stepfun:    {name:'阶跃星辰 StepFun',      logo:'assets/logos/stepfun.svg'},
  devin:      {name:'Devin · Cognition',    logo:'assets/logos/devin.svg'},
  huggingface:{name:'Hugging Face',         logo:'assets/logos/huggingface.svg'},
  openrouter: {name:'OpenRouter',           logo:'assets/logos/openrouter.svg'}
};

/* ---------- 厂商图表色（只用于图表与模型行的色条，不用于 UI 框架） ----------
   构造：色相按「离各家品牌色最近」分配到 15 个均匀槽位（OpenAI 单独用象牙反白，
   对应它在深色背景下的标准用法）；明度手工指定 —— 强弱交替以拉开相邻色，
   同时尊重该色相本来的性格（黄必须高、深蓝深紫可以低）；
   彩度统一冲到该明度/色相下 sRGB 色域上限的 94%。

   实测（对石墨底 #171A17，全部 120 对）：
     · 对比度        16 色全部 >= 3:1        ✅ 通过
     · 正常视觉可分辨 最糟一对 ΔE 8.6（MiniMax 品红 ↔ 小米红）
     · 色盲可分辨     最糟一对 ΔE 1.6（MiniMax ↔ Motif）  ❌ 不通过

   ★ 所以这套色只承担「聚类」，不承担「识别」。
     16 个分类色在数学上无法两两可分 —— 这不是调参能解决的。
     识别由柱下真实 logo、名称、图例、悬停提示与下方表格共同承担，
     界面上任何一处都不得只靠颜色读懂。需要精确区分时切「单色」模式。

   ⚠️ 柱子**不要**再叠 fill-opacity。在深色底上降低不透明度不是「收敛」，
      是往黑里掺：实测会让实际彩度再掉 15% 并同时变暗，看着像禁用态。     */
const LAB_COLORS = {
  xiaomi:'#CF4047', anthropic:'#FA874C', mistral:'#C5821F', openai:'#C9C5BA',
  xai:'#E5C12F',    zai:'#97AA21',       nvidia:'#72DA68',  motif:'#229C75',
  tencent:'#2CC2BB', stepfun:'#1B8FA4',  meta:'#25B0F7',    deepseek:'#2F67D5',
  alibaba:'#8C7CF9', google:'#944EC1',   moonshot:'#F380E0', minimax:'#D64C86'
};
const MONO_COLOR = 'rgba(238,234,226,.30)';

/* ---------- 数据来源登记表 ---------- */
const SOURCES = {
  aa:      {name:'Artificial Analysis',   url:'https://artificialanalysis.ai/leaderboards/models', kind:'独立评测机构', asOf:'2026-09-19',
            note:'智能指数 v4.3（10 项评测）、Terminal-Bench 2.1 / 4.0、GDPval-AA v2、GPQA、SciCode、AA-LCR、非幻觉率、价格、速度、单任务成本 —— 本页绝大多数数值的来源', link:'site'},
  aacai:   {name:'AA Coding Agent Index',  url:'https://artificialanalysis.ai/agents/coding-agents', kind:'独立评测机构', asOf:'2026-09-19',
            note:'编码 Agent 指数 v1.5 = DeepSWE v1.1 + Terminal-Bench 4.0 + SWE-Atlas-QnA 等权合成，评测对象是「框架 × 模型」组合', link:'site'},
  arena:   {name:'LMArena（现 arena.ai）',  url:'https://arena.ai/leaderboard/text', kind:'真人盲测平台', asOf:'2026-09-19',
            note:'文本综合榜 Elo，含 ± 置信区间与名次区间；头部十余名互相统计并列', link:'site'},
  vals:    {name:'vals.ai',               url:'https://www.vals.ai/benchmarks/swebench', kind:'独立复测', asOf:'2026-09-01',
            note:'SWE-bench Verified（Mini-SWE-agent harness）· 已于 2026-09-01 归档，不再跑新模型', link:'site'},
  tbench:  {name:'Terminal-Bench（Laude Institute）', url:'https://tbench.ai', kind:'基准官方', asOf:'2026-09-19',
            note:'Terminal-Bench 4.0：66 题，覆盖软件 / 机器学习 / 科学 / 运维 / 安全 / 硬件 / 媒体；本页 TB 分数由 AA 独立复跑', link:'site'},
  vendor:  {name:'厂商官方发布与定价页',     url:'',  kind:'官方自报', asOf:'2026-09-19',
            note:'各厂商官网、API 文档与发布公告；定价以官方页面为准，能力数据未经独立复测'},
  press:   {name:'媒体与机构报道',          url:'',  kind:'二手报道', asOf:'2026-09-19',
            note:'路透 / 彭博 / Axios / VentureBeat / IT 之家 / 新浪科技 等，以转述为主，未逐条交叉核验'},
  editor:  {name:'本报告编辑判断',          url:'',  kind:'编辑判断', asOf:'2026-09-19',
            note:'变化条目的重要性排序、场景归类等，非测量值'}
};

/* ---------- 指标定义（对比表的行、模型库的列都从这里生成） ---------- */
/* better: 'high' 越高越好 / 'low' 越低越好 / null 无优劣之分（不算最优值） */
const METRICS = [
  {k:'aaii',   g:'cap',  label:'AAII 智能指数',       short:'AAII',    better:'high', dec:0,
   basis:'Artificial Analysis Intelligence Index v4.3', src:'aa',
   warn:'v4.3 已重新标定，与上一版页面的 v4.1.1 分数（Opus 5 曾为 63.1）不是同一把尺，不可跨版本比较',
   hint:'10 项评测等权合成：AA-Briefcase、GDPval-AA v2、AutomationBench-AA、Terminal-Bench 4.0、SciCode、HLE、GDP.pdf、CritPt、AA-Omniscience、AA-LCR。'},
  {k:'cai',    g:'cap',  label:'编码 Agent 指数',      short:'CAI',     better:'high', dec:0,
   basis:'AA Coding Agent Index v1.5（DeepSWE v1.1 + Terminal-Bench 4.0 + SWE-Atlas-QnA）', src:'aacai',
   warn:'评的是「框架 × 模型」组合，不是模型本身；各行括注了取得该分数的 harness'},
  {k:'tb40',   g:'cap',  label:'Terminal-Bench 4.0',  short:'TB 4.0',  better:'high', dec:0, unit:'%',
   basis:'Terminal-Bench 4.0（66 题）· AA 独立复跑，pass@1 取 3 次平均', src:'aa',
   warn:'与 TB 2.1 题目与标定都不同，两者分数不可互比'},
  {k:'tb21',   g:'cap',  label:'Terminal-Bench 2.1',  short:'TB 2.1',  better:'high', dec:0, unit:'%',
   basis:'Terminal-Bench 2.1 · AA 独立复跑', src:'aa',
   warn:'头部已饱和（多家 88–91%），区分度很低，判断长链能力请看 TB 4.0'},
  {k:'swe',    g:'cap',  label:'SWE-bench Verified',  short:'SWE',     better:'high', dec:1, unit:'%',
   basis:'vals.ai 独立复测 · Mini-SWE-agent harness · 500 题', src:'vals',
   warn:'该基准已于 2026-09-01 归档停更。9 月后发布的模型永远不会有分数，这不是缺数据'},
  {k:'gdpval', g:'cap',  label:'GDPval-AA v2 真实工作', short:'GDPval', better:'high', dec:0, unit:'%',
   basis:'GDPval-AA v2 真实职业工作任务 · AA 独立评测', src:'aa'},
  {k:'gpqa',   g:'cap',  label:'GPQA Diamond 科学',    short:'GPQA',    better:'high', dec:0, unit:'%',
   basis:'GPQA Diamond 研究生级科学问答 · AA 独立评测', src:'aa'},
  {k:'scicode',g:'cap',  label:'SciCode 科学编码',     short:'SciCode', better:'high', dec:0, unit:'%',
   basis:'SciCode · AA 独立评测', src:'aa'},
  {k:'lcr',    g:'cap',  label:'AA-LCR 长上下文推理',  short:'AA-LCR',  better:'high', dec:0, unit:'%',
   basis:'AA-LCR v1.1 长上下文推理 · AA 独立评测', src:'aa',
   hint:'比「上下文窗口有多大」更能说明长文档能力：窗口开得大不等于窗口内容真的用得上。'},
  {k:'nonhall',g:'cap',  label:'非幻觉率',             short:'非幻觉',   better:'high', dec:0, unit:'%',
   basis:'AA-Omniscience 非幻觉率（1 − 幻觉率）· AA 独立评测', src:'aa',
   hint:'不知道就说不知道的比例。分数低不代表知识差，代表它更倾向于硬答。'},

  {k:'cpt',       g:'cost', label:'单任务成本',  short:'单任务', better:'low',  dec:2, unit:' $', money:true,
   basis:'跑完一道智能指数任务的加权平均 API 成本（USD）· AA 实测', src:'aa',
   hint:'比单价更接近真实账单：它把推理 token 消耗量、缓存命中都算进去了。'},
  {k:'priceIn',   g:'cost', label:'输入价',     short:'输入', better:'low',  dec:2, unit:' $/M', money:true, perM:true,
   basis:'官方 API 标价 · 美元 · 每百万 token', src:'aa',
   hint:'不含批量、渠道折扣与分时优惠，这些写在「计价方式」列。'},
  {k:'priceOut',  g:'cost', label:'输出价',     short:'输出', better:'low',  dec:2, unit:' $/M', money:true, perM:true,
   basis:'官方 API 标价 · 美元 · 每百万 token', src:'aa'},
  {k:'priceCache',g:'cost', label:'缓存命中价', short:'缓存', better:'low',  dec:2, unit:' $/M', money:true, perM:true,
   basis:'官方 API 缓存读取标价 · 美元 · 每百万 token', src:'aa',
   hint:'高频 Agent 场景里缓存命中往往占账单大头，这一列比输入价更值得看。'},
  {k:'speed',     g:'cost', label:'输出速度',   short:'速度', better:'high', dec:0, unit:' t/s',
   basis:'AA 实测输出吞吐中位数（tokens / 秒）', src:'aa',
   hint:'吞吐高不等于总耗时短 —— 完成同一任务所需的轮数与 token 量差异更大，那部分看「单任务成本」。'},

  {k:'ctx',        g:'spec', label:'上下文窗口',   short:'上下文', better:'high', fmt:'tok',
   basis:'官方公布的最大输入上下文（token）', src:'aa',
   warn:'上下文窗口不是参数规模，本页两者分列'},
  {k:'maxOut',     g:'spec', label:'最大输出长度', short:'最大输出', better:'high', fmt:'tok',
   basis:'官方公布的单次最大输出 token', src:'vendor'},
  {k:'paramsTotal',g:'spec', label:'总参数量',     short:'总参数', better:null, fmt:'par',
   basis:'厂商公布的模型总参数规模', src:'vendor',
   hint:'参数量与能力不是单调关系，因此不参与「最优值」判断。'},
  {k:'paramsAct',  g:'spec', label:'激活参数量',   short:'激活参数', better:null, fmt:'par',
   basis:'MoE 架构单次前向的激活参数', src:'vendor'},
  {k:'arena',      g:'cap',  label:'LMArena Elo',  short:'Arena',   better:'high', dec:0,
   basis:'arena.ai 文本综合榜 Elo', src:'arena',
   warn:'头部十余名的置信区间互相重叠，名次差不构成能力差；各行备注了 ± 区间与对应档位'}
];

const METRIC_GROUPS = [
  {g:'cap',  title:'能力与评测',       note:'不同评测的题目与 harness 不同，只有同一行内可比。'},
  {g:'cost', title:'价格与速度',       note:'价格统一为美元 / 每百万 token；订阅价不在此表，见「价格与使用」。'},
  {g:'spec', title:'上下文与输入输出', note:'上下文、最大输出、参数量三者分列，互不换算。'},
  {g:'use',  title:'使用方式与开放状态'},
  {g:'fit',  title:'适用场景 · 已知限制 · 来源'}
];

/* ---------- 取值助手 ----------
   v(数值, 类型, 备注)  —— 缺失写 null，绝不写 0                      */
function v(val, kind, note, disp){
  if(val === null || val === undefined) return null;
  return {v: val, kind: kind || 'ind', note: note || '', disp: disp || null};
}
const K = 1000, M_ = 1000000;

/* ==========================================================
   模型库  ·  数据抓取日 2026-09-19
   —— 同一模型不同推理档位（effort）分数不同，本表统一取
      「Artificial Analysis 收录的最强配置」，档位写在 variant 字段。
   —— Arena 的档位常与 AA 不同，已在各行 note 里标出对应的是哪一档。
   ========================================================== */
const MODELS = [
{
  id:'claude-fable51', name:'Claude Fable 5.1', org:'anthropic', brand:'claude',
  variant:'max 档（含回退）', released:'2026-09-01', status:'current', tag:'旗舰', fresh:true,
  aaii:v(53,'ind','与 GPT-6 Astra 并列榜首'), cai:v(62,'ind','Claude Code + Fable 5.1 (max)，本期第一'),
  tb40:v(52,'ind'), tb21:v(91,'ind','TB 2.1 本期最高'), swe:null,
  gdpval:v(61,'ind'), gpqa:v(94,'ind'), scicode:v(63,'ind','SciCode 本期最高'), lcr:v(85,'ind'), nonhall:v(27,'ind'),
  arena:v(1498,'ind','claude-fable-5.1-max，±8，#5'),
  cpt:v(7.63,'ind'), speed:v(68,'ind'),
  priceIn:v(10,'vendor'), priceOut:v(50,'vendor'), priceCache:v(0.25,'vendor','9/1 起缓存读取价下调 75%（$1 → $0.25）'),
  priceMode:'标准价（与 Fable 5 同价）', priceAlt:'缓存写入 $12.50 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Claude API · AWS · Google Cloud · Azure · Claude 订阅',
  scenes:['coding','agent','daily'],
  strength:'编码与知识工作：CAI 62 与 TB 2.1 91% 都是本期第一，SciCode 63% 亦居首。',
  limits:'非幻觉率仅 27%（倾向于硬答而不是承认不知道）；单任务成本 $7.63 是本期最贵的一档；SWE-bench 因基准停更而永无分数。',
  tech:'9/1 与 Mythos 5.1 同日发布，同时上线 Enterprise Frontier Safeguards。官方称缓存降价可让典型负载省约 25%、复杂编码与高强度 Agent 场景省约 45%。',
  srcs:['aa','aacai','arena','vendor']
},
{
  id:'gpt6-astra', name:'GPT-6 Astra', org:'openai', brand:'openai',
  variant:'max 档', released:'2026-09-03', status:'current', tag:'旗舰', fresh:true,
  aaii:v(53,'ind','与 Claude Fable 5.1 并列榜首'), cai:v(62,'ind','Codex + GPT-6 Astra (max)'),
  tb40:v(59,'ind','TB 4.0 本期最高'), tb21:v(88,'ind'), swe:null,
  gdpval:v(54,'ind'), gpqa:v(96,'ind','GPQA 本期最高'), scicode:v(56,'ind'), lcr:v(81,'ind'), nonhall:v(49,'ind'),
  arena:v(1480,'ind','gpt-6-astra-max，±12，#24，票数仅 2.7k，区间很宽'),
  cpt:v(3.26,'ind'), speed:v(57,'ind'),
  priceIn:v(10,'vendor'), priceOut:v(50,'vendor'), priceCache:v(1.00,'vendor'),
  priceMode:'标准价', priceAlt:'Batch / Flex 半价 · Fast 模式双倍 · 缓存写入 $12.50 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'API · AWS · ChatGPT Plus/Pro/Business/Enterprise（分批开放）',
  scenes:['agent','coding','daily'],
  strength:'长链终端任务：TB 4.0 59% 大幅领先第二名（Fable 5.1 的 52%）；单任务成本只有 Fable 5.1 的四成多。',
  limits:'超过 272K 输入 token 会按更高档重新计价整个请求；发布初期走 Daybreak Access 分批开放；Arena 票数还太少，名次参考价值有限。',
  tech:'9/3 发布，1M 上下文。定价 $10/$50 与 Anthropic Fable 5.1 完全对齐，是 GPT-5.6 Sol 促销价的 2.5 倍。',
  srcs:['aa','aacai','arena','vendor','press']
},
{
  id:'claude-opus5', name:'Claude Opus 5', org:'anthropic', brand:'claude',
  variant:'max 档', released:'2026-07-24', status:'current', tag:'旗舰',
  aaii:v(51,'ind'), cai:v(60,'ind','Claude Code + Opus 5 (max)'),
  tb40:v(49,'ind'), tb21:v(89,'ind'), swe:v(97.0,'ind','±0.76，归档前的榜首'),
  gdpval:v(62,'ind','GDPval 本期最高'), gpqa:v(93,'ind'), scicode:v(56,'ind'), lcr:v(79,'ind'), nonhall:v(39,'ind'),
  arena:v(1493,'ind','claude-opus-5-high，±4，#10；max 档为 1487 / #14'),
  cpt:v(5.86,'ind'), speed:v(51,'ind'),
  priceIn:v(5,'vendor'), priceOut:v(25,'vendor'), priceCache:v(0.50,'vendor'),
  priceMode:'标准价', priceAlt:'缓存写入 $6.25 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Claude Max 订阅默认 · API',
  scenes:['coding','agent','daily'],
  strength:'真实职业工作任务 GDPval 62% 本期最高；SWE-bench 归档时以 97.0% 收尾，是该基准的终局冠军。',
  limits:'被同厂 Fable 5.1 与 GPT-6 Astra 在智能指数上反超；TB 4.0 49% 落后 Astra 10 个百分点。',
  tech:'effort 档位可调；Claude Code 自托管 Runner 走企业内网执行，但推理仍发往 Anthropic。',
  srcs:['aa','aacai','arena','vals']
},
{
  id:'muse13', name:'Muse Spark 1.3', org:'meta', brand:'meta',
  variant:'max 档', released:'2026-09-02', status:'current', tag:'旗舰', fresh:true,
  aaii:v(48,'ind'), cai:v(54,'ind','Muse Code + Muse Spark 1.3 (max)'),
  tb40:v(33,'ind'), tb21:v(84,'ind'), swe:null,
  gdpval:v(60,'ind'), gpqa:v(94,'ind'), scicode:v(59,'ind'), lcr:v(83,'ind'), nonhall:v(67,'ind'),
  arena:v(1493,'ind','muse-spark-1.3-max，±9，#8'),
  cpt:v(1.60,'ind'), speed:v(214,'ind'),
  priceIn:v(1.25,'vendor'), priceOut:v(4.25,'vendor'), priceCache:v(0.15,'vendor'),
  priceMode:'标准价（与 1.2 同价）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Muse Code · Meta Model API',
  scenes:['agent','daily','longdoc'],
  strength:'性价比最突出的一档：AAII 48 排本期第四，单任务成本只要 $1.60，吞吐 214 t/s；非幻觉率 67% 在头部里算高的。',
  limits:'TB 4.0 仅 33%，长链终端任务明显弱于前三名。',
  tech:'9/2 发布，距 1.2 只有四周；原生多模态，支持文本、图像、视频输入。',
  srcs:['aa','aacai','arena','press']
},
{
  id:'gpt56-sol', name:'GPT-5.6 Sol', org:'openai', brand:'openai',
  variant:'max 档', released:'2026-07-09', status:'current', tag:'上代旗舰',
  aaii:v(47,'ind'), cai:v(55,'ind','Codex + GPT-5.6 Sol (max)'),
  tb40:v(40,'ind'), tb21:v(88,'ind'), swe:v(96.2,'ind','±0.86'),
  gdpval:v(54,'ind'), gpqa:v(94,'ind'), scicode:v(57,'ind'), lcr:v(84,'ind'), nonhall:v(8,'ind','本期最低之一'),
  arena:v(1483,'ind','gpt-5.6-sol-xhigh，±5，#18'),
  cpt:v(1.99,'ind'), speed:v(61,'ind'),
  priceIn:v(4,'vendor'), priceOut:v(20,'vendor'), priceCache:v(0.40,'vendor'),
  priceMode:'促销价（2026-08-21 起，原价 $5 / $30）', priceWas:'$5 / $30', priceAlt:'缓存写入 $5.00 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'ChatGPT Plus / Pro · API · Codex',
  scenes:['agent','coding'],
  strength:'被 Astra 顶替后成了 OpenAI 的性价比档：$4/$20 只有 Astra 的四折，TB 4.0 40% 仍在第一梯队。',
  limits:'非幻觉率 8%，是本期最爱硬答的模型之一；METR 曾在部署前评估中点名其测试作弊率最高。',
  tech:'Ultra 模式 4 个并行子 Agent，6 档 effort；Codex Harness 已 Apache-2.0 开源。',
  srcs:['aa','aacai','arena','vals']
},
{
  id:'qwen38max', name:'Qwen3.8-Max（0902）', org:'alibaba', brand:'qwen',
  variant:'0902 版', released:'2026-09-02', status:'current', tag:'旗舰', fresh:true,
  aaii:v(45,'ind'), cai:v(43,'ind','Claude Code + Qwen3.8 Max'),
  tb40:v(39,'ind'), tb21:v(89,'ind'), swe:v(85.6,'ind','±1.57，为 0902 之前的版本'),
  gdpval:v(58,'ind'), gpqa:v(93,'ind'), scicode:v(52,'ind'), lcr:v(80,'ind'), nonhall:v(71,'ind'),
  arena:v(1481,'ind','qwen3.8-max，±6，#22'),
  cpt:v(5.41,'ind'), speed:v(37,'ind'),
  priceIn:v(2,'vendor'), priceOut:v(6,'vendor'), priceCache:v(0.25,'vendor'),
  priceMode:'标准价',
  ctx:v(984*K,'vendor'), maxOut:null, paramsTotal:v(2.4e12,'vendor'), paramsAct:v(95e9,'vendor'),
  license:'闭源（Max 级；2.4T A95B 开源版单列）', openWeights:false, access:'API · 千问 App · 阿里云百炼',
  scenes:['agent','daily'],
  strength:'TB 2.1 89% 与头部闭源持平；9 月登顶 Arena 前端开发子榜；非幻觉率 71% 明显高于美国头部。',
  limits:'单任务成本 $5.41 偏高（token 消耗大、吞吐只有 37 t/s）；CAI 43 在 Claude Code 上的适配还没调优。',
  tech:'9/2 发布 0902 版；同期另发 Qwen3.8-Omni-Flash（文本 / 图像 / 音频 / 视频同时输入，1M 上下文）。',
  srcs:['aa','aacai','arena','vals','press']
},
{
  id:'glm53', name:'GLM-5.3', org:'zai', brand:'zai',
  variant:'max 档', released:'2026-08-14', status:'current', tag:'开源旗舰',
  aaii:v(45,'ind'), cai:v(54,'ind','Opencode + GLM-5.3，开源模型里最高'),
  tb40:v(42,'ind','开源模型第一'), tb21:v(84,'ind'), swe:v(95.4,'ind','±0.94'),
  gdpval:v(57,'ind'), gpqa:v(92,'ind'), scicode:v(59,'ind'), lcr:v(80,'ind'), nonhall:v(70,'ind'),
  arena:v(1483,'ind','glm-5.3-max，±6，#19'),
  cpt:v(2.01,'ind'), speed:v(72,'ind'),
  priceIn:v(1.40,'vendor'), priceOut:v(4.40,'vendor'), priceCache:v(0.26,'vendor'),
  priceMode:'标准价（与 GLM-5.2 一致的「一口价」）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:v(753e9,'vendor','另有 744B 一说，见待核实清单'), paramsAct:v(40e9,'vendor'),
  license:'开源权重', openWeights:true, access:'ZCode · API · 权重开源 · 阿里云千问平台',
  scenes:['coding','agent'],
  strength:'开源阵营的天花板：CAI 54 与闭源的 Muse Spark 1.3 持平，TB 4.0 42% 是开源第一，价格只有旗舰的七分之一。',
  limits:'TB 2.1 84% 略低于同档闭源；Arena 名次落在统计并列区间，不必当成排名差异。',
  tech:'与 GLM-5.2 同基座、纯后训练；上一版页面里「上下文 = 753B」的错误已修正为 1M（753B 是参数量）。',
  srcs:['aa','aacai','arena','vals']
},
{
  id:'grok46', name:'Grok 4.6', org:'xai', brand:'grok',
  variant:'high 档', released:'2026-08-12', status:'current', tag:'旗舰',
  aaii:v(44,'ind'), cai:v(47,'ind','Grok Build + Grok 4.6 (xhigh)'),
  tb40:v(21,'ind'), tb21:v(88,'ind'), swe:v(95.6,'ind','±0.92'),
  gdpval:v(57,'ind'), gpqa:v(95,'ind'), scicode:v(56,'ind'), lcr:v(80,'ind'), nonhall:v(66,'ind'),
  arena:null,
  cpt:v(1.86,'ind'), speed:v(60,'ind'),
  priceIn:v(2,'vendor'), priceOut:v(6,'vendor'), priceCache:v(0.50,'vendor'),
  priceMode:'标准价', priceAlt:'超过 200K 上下文按 $4 / $12 计',
  ctx:v(500*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'X Premium · Cursor · AWS Bedrock',
  scenes:['coding','daily'],
  strength:'便宜且稳：GPQA 95%、TB 2.1 88% 与头部持平，单任务成本 $1.86。',
  limits:'TB 4.0 只有 21% —— 旧基准饱和掩盖了它在新一代长链任务上的短板，这是本期最大的落差之一；上下文窗口 500K 也是头部里最小的；此前披露的加密提示注入漏洞需自行评估。',
  tech:'同 1.5T 基座纯后训练 + xhigh 档；多步自验证。',
  srcs:['aa','aacai','vals']
},
{
  id:'kimi-k3', name:'Kimi K3', org:'moonshot', brand:'kimi',
  variant:'max 档', released:'2026-07-16', status:'current', tag:'开源旗舰',
  aaii:v(44,'ind'), cai:v(52,'ind','Kimi Code CLI + Kimi K3'),
  tb40:v(13,'ind'), tb21:v(85,'ind'), swe:v(93.4,'ind','±1.11'),
  gdpval:v(52,'ind'), gpqa:v(94,'ind'), scicode:v(59,'ind'), lcr:v(89,'ind','AA-LCR 本期最高'), nonhall:v(47,'ind'),
  arena:v(1485,'ind','kimi-k3-max，±5，#17'),
  cpt:v(2.00,'ind'), speed:v(38,'ind'),
  priceIn:v(3,'vendor'), priceOut:v(15,'vendor'), priceCache:v(0.30,'vendor'),
  priceMode:'标准价（1M 上下文全窗口统一计费）',
  ctx:v(1.05*M_,'vendor'), maxOut:null, paramsTotal:v(2.8e12,'vendor','约数'), paramsAct:null,
  license:'开源（Kimi K3 License，商业收入达标需协商分成）', openWeights:true,
  access:'免费 App · API · 权重开源',
  scenes:['longdoc','daily'],
  strength:'长上下文推理 AA-LCR 89% 本期最高，上下文 1.05M 也是最大的一档 —— 长文档场景的首选候选。',
  limits:'TB 4.0 仅 13%，长链终端任务几乎不能指望；吞吐 38 t/s 偏慢；许可不是自由开源，商业使用触发分成条款。',
  tech:'约 2.8T MoE，仍是开源规模纪录保持者之一。',
  srcs:['aa','aacai','arena','vals']
},
{
  id:'step5', name:'Step 5 Preview', org:'stepfun', brand:'stepfun',
  variant:'preview', released:null, status:'current', tag:'新入榜', fresh:true,
  aaii:v(44,'ind'), cai:null,
  tb40:v(33,'ind'), tb21:null, swe:null,
  gdpval:v(54,'ind'), gpqa:null, scicode:v(59,'ind'), lcr:v(88,'ind'), nonhall:v(57,'ind'),
  arena:null,
  cpt:v(0.71,'ind'), speed:v(100,'ind'),
  priceIn:v(1.00,'vendor'), priceOut:v(2.70,'vendor'), priceCache:v(0.05,'vendor'),
  priceMode:'标准价（preview）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'API（preview）',
  scenes:['longdoc','daily'],
  strength:'本期最值得关注的新面孔：AAII 44 与 Grok 4.6 / Kimi K3 同档，但单任务成本只要 $0.71，AA-LCR 88% 接近 Kimi K3。',
  limits:'preview 阶段，没有 Arena 数据、没有 GPQA、没有 SWE-bench；生态与工具链成熟度未知。',
  tech:'阶跃星辰（StepFun）出品。', srcs:['aa']
},
{
  id:'gpt56-terra', name:'GPT-5.6 Terra', org:'openai', brand:'openai',
  variant:'max 档', released:'2026-07-09', status:'current', tag:'中端',
  aaii:v(42,'ind'), cai:null,
  tb40:v(35,'ind'), tb21:v(88,'ind'), swe:v(95.4,'ind','±0.94'),
  gdpval:v(49,'ind'), gpqa:v(93,'ind'), scicode:v(55,'ind'), lcr:v(83,'ind'), nonhall:v(12,'ind'),
  arena:null,
  cpt:v(1.40,'ind'), speed:v(84,'ind'),
  priceIn:v(2,'vendor'), priceOut:v(12,'vendor'), priceCache:v(0.20,'vendor'),
  priceMode:'标准价', priceAlt:'缓存写入 $2.50 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'ChatGPT · API · Codex',
  scenes:['coding','daily'],
  strength:'TB 4.0 35% 高于 Muse Spark 1.3，单任务成本 $1.40，是 GPT 家族里性价比最好的一档。',
  limits:'非幻觉率 12% 偏低；智能指数与头部差 11 分。',
  tech:'', srcs:['aa','vals']
},
{
  id:'glm53flash', name:'GLM-5.3-Flash', org:'zai', brand:'zai',
  variant:'', released:'2026-08-26', status:'current', tag:'开源低价', fresh:true,
  aaii:v(42,'ind'), cai:null,
  tb40:v(33,'ind'), tb21:v(84,'ind'), swe:v(92.0,'ind','±1.21'),
  gdpval:v(58,'ind'), gpqa:v(91,'ind'), scicode:v(52,'ind'), lcr:v(80,'ind'), nonhall:v(72,'ind','本期开源里最高之一'),
  arena:v(1475,'ind','glm-5.3-flash，±7，#29'),
  cpt:v(0.25,'ind'), speed:v(95,'ind'),
  priceIn:v(0.15,'vendor'), priceOut:v(0.50,'vendor'), priceCache:v(0.03,'vendor'),
  priceMode:'标准价（9/9 前有 5 折促销）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:v(320e9,'vendor'), paramsAct:v(18e9,'vendor'),
  license:'开源权重', openWeights:true, access:'API · 权重开源',
  scenes:['daily','coding','longdoc'],
  strength:'本期性价比之王：AAII 42 与 GPT-5.6 Terra 齐平，单任务成本却只有 $0.25（Terra 的 1/5.6），GDPval 58% 甚至高于自家旗舰。',
  limits:'TB 4.0 33% 中游；吞吐 95 t/s 一般。',
  tech:'8/26 发布，GLM-5 系列首个原生多模态模型，320B 总参 / 18B 激活。',
  srcs:['aa','arena','vals','press']
},
{
  id:'gemini38', name:'Gemini 3.8 Flash', org:'google', brand:'gemini',
  variant:'high 档', released:'2026-09-02', status:'current', tag:'高吞吐', fresh:true,
  aaii:v(41,'ind'), cai:v(42,'ind','Antigravity SDK + Gemini 3.8 Flash (high)'),
  tb40:v(20,'ind'), tb21:v(88,'ind'), swe:v(80.0,'ind','±1.79'),
  gdpval:v(48,'ind'), gpqa:v(95,'ind'), scicode:v(57,'ind'), lcr:v(81,'ind'), nonhall:v(45,'ind'),
  arena:v(1493,'ind','gemini-3.8-flash-high，±9，#9，标注为初步结果'),
  cpt:v(1.24,'ind'), speed:v(298,'ind'),
  priceIn:v(0.75,'vendor'), priceOut:v(3.75,'vendor'), priceCache:v(0.07,'vendor'),
  priceMode:'标准价（与 3.7 Flash 同价）', priceAlt:'缓存写入 $0.75 / M',
  ctx:v(1*M_,'vendor'), maxOut:v(65*K,'vendor'), paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Google AI Pro / Ultra · API · Workspace · Antigravity',
  scenes:['daily','longdoc'],
  strength:'吞吐 298 t/s 是可用档位里最快的；GPQA 95% 与头部齐平；Arena 初步结果已进前十。',
  limits:'TB 4.0 仅 20%，长链终端任务是明确短板；CAI 42 在 Agent 组合里垫底区。',
  tech:'9/2 发布，六周内第三代 Flash；同期另发 Gemini 3.8 Flash Cyber 安全特化版。',
  srcs:['aa','aacai','arena','vals','press']
},
{
  id:'qwen38flashnext', name:'Qwen3.8-Flash-Next', org:'alibaba', brand:'qwen',
  variant:'', released:'2026-08-28', status:'current', tag:'开源低价',
  aaii:v(40,'ind'), cai:null,
  tb40:v(25,'ind'), tb21:v(86,'ind'), swe:null,
  gdpval:v(57,'ind'), gpqa:v(92,'ind'), scicode:v(51,'ind'), lcr:v(80,'ind'), nonhall:v(55,'ind'),
  arena:null,
  cpt:v(0.37,'ind'), speed:v(55,'ind'),
  priceIn:v(0.15,'vendor'), priceOut:v(0.47,'vendor'), priceCache:v(0.02,'vendor'),
  priceMode:'标准价',
  ctx:v(256*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'开源权重', openWeights:true, access:'API · 权重开源',
  scenes:['daily','coding'],
  strength:'与 GLM-5.3-Flash 同档的低价开源选择，GDPval 57% 相当能打。',
  limits:'上下文 256K 明显小于 1M 那批；吞吐 55 t/s 偏慢。',
  tech:'与 GLM-5.3-Flash 架构路线高度相似，两家在同一时间窗独立收敛到类似方案。',
  srcs:['aa','press']
},
{
  id:'ds-v41flash', name:'DeepSeek V4.1 Flash', org:'deepseek', brand:'deepseek',
  variant:'max 档', released:'2026-09-10', status:'current', tag:'开源低价', fresh:true,
  aaii:v(40,'ind'), cai:null,
  tb40:v(27,'ind'), tb21:null, swe:null,
  gdpval:v(57,'ind'), gpqa:null, scicode:v(52,'ind'), lcr:v(84,'ind'), nonhall:v(4,'ind','本期最低'),
  arena:null,
  cpt:v(0.27,'ind'), speed:v(208,'ind'),
  priceIn:v(0.30,'vendor','高峰价；低谷 $0.15'), priceOut:v(1.20,'vendor','高峰价；低谷 $0.60'),
  priceCache:v(0.006,'vendor','高峰价；低谷 $0.003'),
  priceMode:'峰谷分时计价 · 高峰 = 工作日 UTC 01–04 与 06–10 时（不含中国法定节假日），其余时段一律低谷半价',
  priceAlt:'低谷价 $0.15 / $0.60，缓存命中低谷 $0.003',
  ctx:v(1*M_,'vendor'), maxOut:v(384*K,'vendor'), paramsTotal:null, paramsAct:null,
  license:'开源权重', openWeights:true, access:'免费 App · API（deepseek-flash）· 权重开源',
  scenes:['daily','longdoc','agent'],
  strength:'单任务成本 $0.27、吞吐 208 t/s、1M 上下文、384K 最大输出，同时开源权重 —— 高频批量场景的默认候选。',
  limits:'非幻觉率 4% 是本期最低，事实性任务务必自己加校验；没有 GPQA 与 SWE-bench 数据。',
  tech:'9/10 发布，新架构家族里最小的一款，原生视觉理解。上一代 V4 Flash 与 V4 Flash Vision Exp 已退役，旧模型名暂时路由到本模型。',
  srcs:['aa','vendor','press']
},
{
  id:'claude-sonnet5', name:'Claude Sonnet 5', org:'anthropic', brand:'claude',
  variant:'max 档', released:'2026-06-30', status:'current', tag:'中端',
  aaii:v(38,'ind'), cai:null,
  tb40:v(14,'ind'), tb21:v(81,'ind'), swe:v(79.6,'ind','±1.80'),
  gdpval:v(50,'ind'), gpqa:v(91,'ind'), scicode:v(54,'ind'), lcr:v(82,'ind'), nonhall:v(61,'ind'),
  arena:null,
  cpt:v(5.09,'ind'), speed:v(74,'ind'),
  priceIn:v(2,'vendor'), priceOut:v(10,'vendor'), priceCache:v(0.20,'vendor'),
  priceMode:'标准价', priceAlt:'缓存写入 $2.50 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Claude Pro 订阅默认 · API',
  scenes:['daily','longdoc'],
  strength:'Claude Pro 订阅的默认模型，非幻觉率 61% 比自家旗舰还高。',
  limits:'单任务成本 $5.09 高得离谱（标价只有 $2/$10，但 token 消耗大），按 API 计费时性价比很差；TB 4.0 仅 14%。',
  tech:'', srcs:['aa','vals']
},
{
  id:'gpt56-luna', name:'GPT-5.6 Luna', org:'openai', brand:'openai',
  variant:'max 档', released:'2026-07-09', status:'current', tag:'低价',
  aaii:v(38,'ind'), cai:null,
  tb40:v(12,'ind'), tb21:v(81,'ind'), swe:v(93.0,'ind','±1.14'),
  gdpval:v(48,'ind'), gpqa:v(91,'ind'), scicode:v(54,'ind'), lcr:v(84,'ind'), nonhall:v(7,'ind'),
  arena:null,
  cpt:v(0.18,'ind','本期最低之一'), speed:v(133,'ind'),
  priceIn:v(0.20,'vendor'), priceOut:v(1.20,'vendor'), priceCache:v(0.02,'vendor'),
  priceMode:'标准价', priceAlt:'缓存写入 $0.25 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'ChatGPT 全系（含免费层）· API',
  scenes:['daily','coding'],
  strength:'单任务成本 $0.18，是本期最便宜的可用档；SWE-bench 归档时仍有 93.0%。',
  limits:'非幻觉率 7%；TB 4.0 仅 12%，复杂长链任务不要指望。',
  tech:'', srcs:['aa','vals']
},
{
  id:'ds-v4pro', name:'DeepSeek V4 Pro 0813', org:'deepseek', brand:'deepseek',
  variant:'max 档', released:'2026-08-13', status:'current', tag:'开源',
  aaii:v(36,'ind'), cai:v(43,'ind','Codex + DeepSeek V4 Pro (max)，单任务成本仅 $0.24'),
  tb40:v(14,'ind'), tb21:v(79,'ind'), swe:v(96.4,'ind','±0.83，归档时开源第一'),
  gdpval:v(50,'ind'), gpqa:v(93,'ind'), scicode:v(51,'ind'), lcr:v(80,'ind'), nonhall:v(5,'ind'),
  arena:null,
  cpt:v(0.67,'ind'), speed:v(88,'ind'),
  priceIn:v(1.32,'vendor','高峰价；低谷 $0.66'), priceOut:v(3.96,'vendor','高峰价；低谷 $1.98'),
  priceCache:v(0.044,'vendor','高峰价；低谷 $0.022'),
  priceMode:'峰谷分时计价 · 高峰 = 工作日 UTC 01–04 与 06–10 时，其余时段一律低谷半价',
  priceAlt:'低谷价 $0.66 / $1.98',
  ctx:v(1*M_,'vendor'), maxOut:v(384*K,'vendor'), paramsTotal:v(1.65e12,'vendor'), paramsAct:v(49e9,'vendor'),
  license:'MIT', openWeights:true, access:'免费 App · API · 权重开源 · 阿里云千问平台',
  scenes:['coding','agent'],
  strength:'配 Codex 跑编码 Agent 时单任务成本只要 $0.24，是 Claude Code + Fable 5.1（$12.4）的 1/50，指数 43 对 62；SWE-bench 归档时以 96.4% 位列开源第一。',
  limits:'非幻觉率 5%；TB 4.0 仅 14%；成本随时段浮动，需要按负载排期。',
  tech:'1.65T MoE / 49B 激活、1M 上下文、384K 输出、MIT 许可。',
  srcs:['aa','aacai','vals','vendor']
},
{
  id:'qwen38-27b', name:'Qwen3.8 27B', org:'alibaba', brand:'qwen',
  variant:'xhigh 档', released:'2026-08-14', status:'current', tag:'开源小模型',
  aaii:v(34,'ind'), cai:null,
  tb40:v(6,'ind'), tb21:v(80,'ind'), swe:v(86.0,'ind','±1.55'),
  gdpval:v(48,'ind'), gpqa:v(91,'ind'), scicode:v(47,'ind'), lcr:v(82,'ind'), nonhall:v(70,'ind'),
  arena:null,
  cpt:v(0.82,'ind'), speed:v(43,'ind'),
  priceIn:v(0.50,'vendor'), priceOut:v(3.00,'vendor'), priceCache:v(0.05,'vendor'), priceMode:'标准价',
  ctx:v(256*K,'vendor'), maxOut:null, paramsTotal:v(27e9,'vendor'), paramsAct:null,
  license:'开源权重', openWeights:true, access:'API · 权重开源 · 本地部署',
  scenes:['daily'],
  strength:'27B 的体量能跑到 SWE-bench 86%、非幻觉率 70%，本地部署门槛低。',
  limits:'TB 4.0 仅 6%，不要用于长链 Agent。', tech:'', srcs:['aa','vals']
},
{
  id:'motif3', name:'Motif 3', org:'motif', brand:'motif',
  variant:'', released:'2026-08-12', status:'current', tag:'区域旗舰',
  aaii:v(34,'est','AA 标注为部分评测（*）'), cai:null,
  tb40:null, tb21:v(75,'ind'), swe:null,
  gdpval:v(35,'ind'), gpqa:v(83,'ind'), scicode:v(42,'ind'), lcr:v(76,'ind'), nonhall:v(72,'ind'),
  arena:null, cpt:null, speed:null,
  priceIn:null, priceOut:null, priceCache:null, priceMode:'',
  ctx:v(262*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'开源权重', openWeights:true, access:'权重开源',
  scenes:[], strength:'韩国主权 AI 基础模型项目入选者，非幻觉率 72% 在本期算高的。',
  limits:'AA 的智能指数只跑了部分评测（带 * 号）；没有公开 API 定价与速度数据。',
  tech:'', srcs:['aa']
},
{
  id:'gpt53-codex', name:'GPT-5.3 Codex', org:'openai', brand:'openai',
  variant:'xhigh 档', released:null, status:'current', tag:'编码特化',
  aaii:v(33,'est','AA 标注为部分评测（*）'), cai:null,
  tb40:null, tb21:null, swe:null,
  gdpval:null, gpqa:v(92,'ind'), scicode:null, lcr:v(83,'ind'), nonhall:v(11,'ind'),
  arena:null, cpt:null, speed:v(130,'ind'),
  priceIn:v(1.75,'vendor'), priceOut:v(14.00,'vendor'), priceCache:v(0.17,'vendor'), priceMode:'标准价',
  ctx:v(400*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Codex · API',
  scenes:[], strength:'Terminal-Bench Hard 53%，编码特化线仍在维护。',
  limits:'智能指数只跑了部分评测；没有 TB 4.0 与 SWE-bench 数据。', tech:'', srcs:['aa']
},
{
  id:'gemini31pro', name:'Gemini 3.1 Pro Preview', org:'google', brand:'gemini',
  variant:'preview', released:null, status:'preview', tag:'预览',
  aaii:v(30,'ind'), cai:null,
  tb40:v(4,'ind'), tb21:v(74,'ind'), swe:v(78.8,'ind','±1.83'),
  gdpval:v(20,'ind'), gpqa:v(94,'ind'), scicode:v(59,'ind'), lcr:v(82,'ind'), nonhall:v(49,'ind'),
  arena:v(1487,'ind','gemini-3.1-pro-preview，±3，#15'),
  cpt:v(0.67,'ind'), speed:v(119,'ind'),
  priceIn:v(2,'vendor'), priceOut:v(12,'vendor'), priceCache:v(0.20,'vendor'), priceMode:'标准价（preview）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'API preview',
  scenes:['daily'],
  strength:'Arena 1487（#15）远高于其智能指数所处的位置 —— 真人偏好与基准分歧最大的一款。',
  limits:'GDPval 只有 20%、TB 4.0 只有 4%，真实工作任务几乎跑不动；Pro 线迭代长期滞后。',
  tech:'', srcs:['aa','arena','vals']
},
{
  id:'minimax-m3', name:'MiniMax-M3', org:'minimax', brand:'minimax',
  variant:'', released:null, status:'current', tag:'开源多模态',
  aaii:v(30,'ind'), cai:null,
  tb40:v(2,'ind'), tb21:v(65,'ind'), swe:v(75.0,'ind','±1.94'),
  gdpval:v(40,'ind'), gpqa:v(93,'ind'), scicode:v(47,'ind'), lcr:v(83,'ind'), nonhall:v(82,'ind','本期最高'),
  arena:null,
  cpt:v(0.51,'ind'), speed:v(186,'ind'),
  priceIn:v(0.30,'vendor'), priceOut:v(1.20,'vendor'), priceCache:v(0.06,'vendor'),
  priceMode:'标准价', priceAlt:'缓存写入 $0.38 / M',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:v(428e9,'vendor'), paramsAct:v(23e9,'vendor'),
  license:'开源权重', openWeights:true, access:'权重开源 · 本地部署 · API',
  scenes:['daily'],
  strength:'非幻觉率 82% 本期第一 —— 最愿意承认自己不知道的模型；吞吐 186 t/s，价格也低。',
  limits:'TB 4.0 仅 2%；本地部署需 256GB 级工作站。',
  tech:'428B 总参 / 23B 激活 MoE。上一版页面里「上下文 = 428B、输入价 = 开源」的错误已修正。',
  srcs:['aa','vals']
},
{
  id:'mimo25pro', name:'MiMo-V2.5-Pro', org:'xiaomi', brand:'xiaomi',
  variant:'', released:null, status:'current', tag:'端侧',
  aaii:v(26,'ind'), cai:null,
  tb40:v(0,'ind'), tb21:v(65,'ind'), swe:v(74.0,'ind','±1.96'),
  gdpval:v(34,'ind'), gpqa:v(87,'ind'), scicode:v(51,'ind'), lcr:v(80,'ind'), nonhall:v(75,'ind'),
  arena:null,
  cpt:v(0.05,'ind','本期最低'), speed:v(52,'ind'),
  priceIn:v(0.43,'vendor'), priceOut:v(0.87,'vendor'), priceCache:v(0.004,'vendor'), priceMode:'标准价',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'开源权重', openWeights:true, access:'小米澎湃 OS 内置 · API · 端侧部署',
  scenes:['daily'],
  strength:'单任务成本 $0.05 全场最低，非幻觉率 75%，还能端侧离线跑。',
  limits:'TB 4.0 为 0%，完全不适合 Agent 场景。', tech:'', srcs:['aa','vals']
},
{
  id:'kimi-k27code', name:'Kimi K2.7 Code', org:'moonshot', brand:'kimi',
  variant:'', released:null, status:'current', tag:'编码特化',
  aaii:v(26,'ind'), cai:null,
  tb40:v(1,'ind'), tb21:v(67,'ind'), swe:v(78.2,'ind','±1.85'),
  gdpval:v(31,'ind'), gpqa:v(90,'ind'), scicode:v(48,'ind'), lcr:v(79,'ind'), nonhall:v(18,'ind'),
  arena:null,
  cpt:v(0.54,'ind'), speed:v(60,'ind'),
  priceIn:v(0.95,'vendor'), priceOut:v(4.00,'vendor'), priceCache:v(0.19,'vendor'), priceMode:'标准价',
  ctx:v(256*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'开源权重', openWeights:true, access:'API · 权重开源',
  scenes:[], strength:'编码特化的小模型，SWE-bench 78.2%。',
  limits:'TB 4.0 仅 1%；非幻觉率 18% 偏低。', tech:'', srcs:['aa','vals']
},
{
  id:'hy3', name:'腾讯混元 Hy3', org:'tencent', brand:'hunyuan',
  variant:'', released:'2026-07-06', status:'current', tag:'生态绑定',
  aaii:v(26,'ind'), cai:null,
  tb40:v(1,'ind'), tb21:v(64,'ind'), swe:null,
  gdpval:v(32,'ind'), gpqa:v(90,'ind'), scicode:v(49,'ind'), lcr:v(79,'ind'), nonhall:v(26,'ind'),
  arena:null,
  cpt:v(0.07,'ind'), speed:v(77,'ind'),
  priceIn:v(0.14,'vendor'), priceOut:v(0.58,'vendor'), priceCache:v(0.04,'vendor'), priceMode:'标准价',
  ctx:v(256*K,'vendor'), maxOut:null, paramsTotal:v(295e9,'vendor'), paramsAct:v(21e9,'vendor'),
  license:'开源权重', openWeights:true, access:'腾讯云 API · 微信 / 企微生态 · 权重开源',
  scenes:['daily'],
  strength:'单任务成本 $0.07，与微信 / 企微工具链深度绑定。',
  limits:'TB 4.0 仅 1%；非幻觉率 26% 偏低。', tech:'', srcs:['aa']
},
{
  id:'nemotron3ultra', name:'Nemotron 3 Ultra', org:'nvidia', brand:'nvidia',
  variant:'', released:null, status:'current', tag:'开源',
  aaii:v(23,'ind'), cai:null,
  tb40:v(1,'ind'), tb21:v(54,'ind'), swe:v(69.0,'ind','±2.07'),
  gdpval:v(30,'ind'), gpqa:v(87,'ind'), scicode:v(40,'ind'), lcr:v(79,'ind'), nonhall:v(70,'ind'),
  arena:null,
  cpt:v(0.58,'ind'), speed:v(164,'ind'),
  priceIn:v(0.60,'vendor'), priceOut:v(2.40,'vendor'), priceCache:v(0.20,'vendor'), priceMode:'标准价',
  ctx:v(262*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'开源权重', openWeights:true, access:'权重开源 · NVIDIA 推理栈',
  scenes:[], strength:'吞吐 164 t/s，非幻觉率 70%。',
  limits:'各项能力指标都落在中下游。', tech:'', srcs:['aa','vals']
},
{
  id:'gemini35lite', name:'Gemini 3.5 Flash-Lite', org:'google', brand:'gemini',
  variant:'', released:'2026-07-21', status:'current', tag:'低价高吞吐',
  aaii:v(23,'ind'), cai:null,
  tb40:v(1,'ind'), tb21:v(54,'ind'), swe:null,
  gdpval:v(28,'ind'), gpqa:v(84,'ind'), scicode:v(41,'ind'), lcr:v(76,'ind'), nonhall:v(66,'ind'),
  arena:null,
  cpt:v(0.12,'ind'), speed:v(358,'ind','本页最快'),
  priceIn:v(0.30,'vendor'), priceOut:v(2.50,'vendor'), priceCache:v(0.03,'vendor'), priceMode:'标准价',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Google AI · API',
  scenes:['daily'],
  strength:'358 t/s 是本页最快的模型，单任务成本 $0.12。',
  limits:'能力指标整体偏低，只适合简单高并发任务。', tech:'', srcs:['aa']
},
{
  id:'muse-glimmer', name:'Muse Glimmer', org:'meta', brand:'meta',
  variant:'high 档', released:'2026-08-10', status:'current', tag:'开源小模型',
  aaii:v(18,'ind'), cai:null,
  tb40:v(1,'ind'), tb21:v(52,'ind'), swe:null,
  gdpval:v(20,'ind'), gpqa:v(84,'ind'), scicode:v(45,'ind'), lcr:v(83,'ind'), nonhall:v(18,'ind'),
  arena:null, cpt:v(0.06,'ind'), speed:v(93,'ind'),
  priceIn:v(0.35,'vendor'), priceOut:v(1.50,'vendor'), priceCache:v(0.04,'vendor'), priceMode:'标准价',
  ctx:v(131*K,'vendor'), maxOut:null, paramsTotal:v(30e9,'vendor'), paramsAct:null,
  license:'Apache 2.0', openWeights:true, access:'权重开源（24GB 显卡可跑）· API',
  scenes:[], strength:'30B、Apache 2.0，单张 24GB 显卡可跑，AA-LCR 83% 在小模型里很突出。',
  limits:'非幻觉率 18%；整体能力有限。', tech:'', srcs:['aa']
},
{
  id:'claude-haiku45', name:'Claude 4.5 Haiku', org:'anthropic', brand:'claude',
  variant:'', released:null, status:'current', tag:'低价',
  aaii:v(18,'ind'), cai:null,
  tb40:v(0,'ind'), tb21:v(44,'ind'), swe:null,
  gdpval:v(18,'ind'), gpqa:v(67,'ind'), scicode:v(42,'ind'), lcr:v(74,'ind'), nonhall:v(73,'ind'),
  arena:null, cpt:v(0.21,'ind'), speed:v(94,'ind'),
  priceIn:v(1.00,'vendor'), priceOut:v(5.00,'vendor'), priceCache:v(0.10,'vendor'),
  priceMode:'标准价', priceAlt:'缓存写入 $1.25 / M',
  ctx:v(200*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Claude API · 订阅',
  scenes:[], strength:'非幻觉率 73%，Anthropic 家族里最便宜的一档。',
  limits:'GPQA 只有 67%，与同价位的开源模型相比没有优势。', tech:'', srcs:['aa']
},
{
  id:'nemotron35', name:'Nemotron 3.5 Lightning', org:'nvidia', brand:'nvidia',
  variant:'', released:'2026-08-11', status:'current', tag:'高吞吐开源',
  aaii:v(14,'ind'), cai:null,
  tb40:v(1,'ind'), tb21:v(24,'ind'), swe:v(52.8,'ind','±2.23'),
  gdpval:v(13,'ind'), gpqa:v(74,'ind'), scicode:v(32,'ind'), lcr:v(60,'ind'), nonhall:v(62,'ind'),
  arena:null, cpt:v(0.09,'ind'), speed:v(293,'ind'),
  priceIn:v(0.06,'vendor'), priceOut:v(0.20,'vendor'), priceCache:v(0.05,'vendor'), priceMode:'标准价',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:v(30e9,'vendor'), paramsAct:v(3e9,'vendor'),
  license:'开源权重', openWeights:true, access:'权重开源 · NVIDIA 推理栈',
  scenes:[], strength:'$0.06/$0.20 是本页最低标价，293 t/s，1M 上下文。',
  limits:'能力指标全线垫底，只适合极简的高吞吐任务。', tech:'30B 总参 / 3B 激活。', srcs:['aa','vals']
},
{
  id:'mistral-l3', name:'Mistral Large 3', org:'mistral', brand:'mistral',
  variant:'', released:null, status:'current', tag:'欧洲开源',
  aaii:v(10,'ind'), cai:null,
  tb40:v(0,'ind'), tb21:v(12,'ind'), swe:v(41.4,'ind','±2.21'),
  gdpval:v(4,'ind'), gpqa:v(68,'ind'), scicode:v(37,'ind'), lcr:v(36,'ind'), nonhall:v(14,'ind'),
  arena:null, cpt:v(0.10,'ind'), speed:v(76,'ind'),
  priceIn:v(0.50,'vendor'), priceOut:v(1.50,'vendor'), priceCache:null, priceMode:'标准价',
  ctx:v(256*K,'vendor'), maxOut:null, paramsTotal:v(675e9,'vendor'), paramsAct:v(41e9,'vendor'),
  license:'Apache 2.0', openWeights:true, access:'API · Le Chat · 权重开源 · 欧盟区域端点',
  scenes:[],
  strength:'Apache 2.0 全开源，欧盟数据驻留与主权合规部署是它真正的卖点。',
  limits:'本期能力数据全面落后（AA-LCR 36%、TB 2.1 12%、GDPval 4%），单纯按能力选型排不上号。',
  tech:'细粒度稀疏 MoE，675B 总参 / 41B 激活。', srcs:['aa','vals']
},
{
  id:'claude-mythos51', name:'Claude Mythos 5.1', org:'anthropic', brand:'claude',
  variant:'受限访问', released:'2026-09-01', status:'current', tag:'受限', fresh:true,
  aaii:null, cai:null, tb40:null, tb21:null, swe:null,
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null, arena:null, cpt:null, speed:null,
  priceIn:null, priceOut:null, priceCache:null, priceMode:'',
  ctx:null, maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'仅限通过审核的网络安全与生命科学机构',
  scenes:[], strength:'',
  limits:'不对外开放，没有任何公开评测数据，无法进入常规选型；与 Fable 5.1 同日发布。',
  tech:'', srcs:['vendor','press']
},

/* ---------- 以下为已被取代的上一代，保留用于回看与横向对照 ---------- */
{
  id:'claude-fable5', name:'Claude Fable 5', org:'anthropic', brand:'claude',
  variant:'high 档', released:'2026-06-09', status:'prev', tag:'上代',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(95.0,'ind','±0.98'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:v(1506,'ind','claude-fable-5-high，±5，Arena 第 1 —— 比它的继任者 5.1（1498）还高'),
  cpt:null, speed:null,
  priceIn:v(10,'vendor'), priceOut:v(50,'vendor'), priceCache:v(1.00,'vendor','5.1 已降到 $0.25'),
  priceMode:'标准价（已被 5.1 取代）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Claude 订阅 · API',
  scenes:[], strength:'仍是 Arena 真人盲测的第 1 名。',
  limits:'已被 Fable 5.1 取代，且 5.1 的缓存读取价只有它的 1/4，没有继续用它的理由。',
  tech:'', srcs:['arena','vals']
},
{
  id:'claude-opus48', name:'Claude Opus 4.8', org:'anthropic', brand:'claude',
  variant:'high 档', released:null, status:'prev', tag:'上代',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(88.6,'ind','±1.42'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:v(1481,'ind','claude-opus-4-8-high，±4'), cpt:null, speed:null,
  priceIn:v(5,'vendor'), priceOut:v(25,'vendor'), priceCache:null, priceMode:'标准价（已被 Opus 5 取代）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'API（上代）',
  scenes:[], strength:'', limits:'已被 Opus 5 取代。', tech:'', srcs:['arena','vals']
},
{
  id:'muse12', name:'Muse Spark 1.2', org:'meta', brand:'meta',
  variant:'xHigh 档', released:'2026-08-05', status:'prev', tag:'上代',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(86.6,'ind','±1.52'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:v(1500,'ind','muse-spark-1.2 (xHigh)，±11，#4 —— 高于继任者 1.3（1493）'),
  cpt:null, speed:null,
  priceIn:v(1.25,'vendor'), priceOut:v(4.25,'vendor'), priceCache:v(0.15,'vendor'), priceMode:'标准价（已被 1.3 取代）',
  ctx:v(1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Meta AI · Muse Code API',
  scenes:[], strength:'Arena 1500（#4），真人盲测口碑仍高于 1.3。',
  limits:'已被 Muse Spark 1.3 取代（同价）。', tech:'', srcs:['arena','vals']
},
{
  id:'gemini37', name:'Gemini 3.7 Flash', org:'google', brand:'gemini',
  variant:'high 档', released:'2026-08-13', status:'prev', tag:'上代',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(80.8,'ind','±1.76'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:v(1490,'ind','gemini-3.7-flash-high，±8，#12，标注为初步结果'), cpt:null, speed:null,
  priceIn:v(0.75,'vendor'), priceOut:v(3.75,'vendor'), priceCache:null, priceMode:'标准价（已被 3.8 Flash 同价取代）',
  ctx:v(1*M_,'vendor'), maxOut:v(65*K,'vendor'), paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'Google AI · API',
  scenes:[], strength:'', limits:'已被 Gemini 3.8 Flash 以完全相同的价格取代。', tech:'', srcs:['arena','vals']
},
{
  id:'grok45', name:'Grok 4.5', org:'xai', brand:'grok',
  variant:'high 档', released:'2026-07-08', status:'prev', tag:'上代',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(86.6,'ind','±1.52'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:null, cpt:null, speed:null,
  priceIn:v(2,'vendor'), priceOut:v(6,'vendor'), priceCache:v(0.50,'vendor'), priceMode:'标准价（已被 4.6 取代）',
  ctx:v(500*K,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'X Premium · Cursor',
  scenes:[], strength:'', limits:'已被 Grok 4.6 以同价取代。', tech:'', srcs:['vals']
},
{
  id:'glm52', name:'GLM-5.2', org:'zai', brand:'zai',
  variant:'max 档', released:'2026-06-16', status:'prev', tag:'上代开源',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(82.8,'ind','±1.69'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:null, cpt:null, speed:null,
  priceIn:v(1.40,'vendor'), priceOut:v(4.40,'vendor'), priceCache:null, priceMode:'标准价（已被 5.3 同价取代）',
  ctx:null, ctxNote:'本期资料未给出，上一版页面此处误填「开源」', maxOut:null,
  paramsTotal:v(744e9,'vendor'), paramsAct:v(40e9,'vendor'),
  license:'MIT', openWeights:true, access:'API · 权重开源',
  scenes:[], strength:'第一家进入前沿俱乐部的非中美巨头开源模型。', limits:'已被 GLM-5.3 以同价取代。',
  tech:'', srcs:['vals']
},
{
  id:'gpt55', name:'GPT-5.5', org:'openai', brand:'openai',
  variant:'high 档', released:null, status:'prev', tag:'上代',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(82.6,'ind','±1.70'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:v(1482,'ind','gpt-5.5-high，±4'), cpt:null, speed:null,
  priceIn:v(5,'vendor'), priceOut:v(30,'vendor'), priceCache:null, priceMode:'标准价（已被 5.6 家族取代）',
  ctx:v(1.1*M_,'vendor'), maxOut:null, paramsTotal:null, paramsAct:null,
  license:'闭源', openWeights:false, access:'API（上代）',
  scenes:[], strength:'', limits:'已被 GPT-5.6 家族取代，价格却更高。', tech:'', srcs:['arena','vals']
},
{
  id:'ds-v4flash0731', name:'DeepSeek V4 Flash 0731', org:'deepseek', brand:'deepseek',
  variant:'', released:'2026-07-31', status:'prev', tag:'已退役',
  aaii:null, cai:null, tb40:null, tb21:null, swe:v(88.8,'ind','±1.41'),
  gdpval:null, gpqa:null, scicode:null, lcr:null, nonhall:null,
  arena:null, cpt:null, speed:null,
  priceIn:null, priceOut:null, priceCache:null,
  priceMode:'已退役 —— 模型名 deepseek-v4-flash 现暂时路由到 V4.1 Flash',
  ctx:v(1*M_,'vendor'), maxOut:v(384*K,'vendor'), paramsTotal:null, paramsAct:null,
  license:'MIT', openWeights:true, access:'已退役',
  scenes:[], strength:'', limits:'2026-09-10 起被 V4.1 Flash 取代并退役。', tech:'', srcs:['vals','vendor']
}
];

/* ==========================================================
   用途 → 参考指标
   只给「值得进一步比较的候选 + 依据」，不产出「最强」结论。
   候选由 app.js 依据 metrics 里实际存在的数据动态算出。
   ========================================================== */
const SCENES = [
  {k:'coding', name:'编程与重构', metrics:['cai','tb40','scicode'],
   why:'看真实 IDE / Agent 环境里的端到端表现（CAI）、长链终端任务（TB 4.0），以及科学编码（SciCode）。',
   caveat:'CAI 是「框架 × 模型」组合分，换 harness 会变；SWE-bench 已在 9/1 归档停更，不能再当作区分头部的依据。'},
  {k:'agent', name:'Agent / 长链任务', metrics:['tb40','cai','gdpval'],
   why:'看能不能在终端里连续跑完部署、调试、重构这类多步任务，以及真实职业工作任务的完成度。',
   caveat:'TB 4.0 头部也只有 59%，这类任务整体远未解决；TB 2.1 上看着接近的几个模型，到 TB 4.0 能差出 40 个百分点。'},
  {k:'daily', name:'日常问答与写作', metrics:['arena','aaii','nonhall'],
   why:'看真人盲测偏好（Arena）、综合智能（AAII），以及它是否愿意承认自己不知道（非幻觉率）。',
   caveat:'Arena 头部十余名的置信区间互相重叠，名次差不构成能力差；非幻觉率低不代表知识差，代表它更倾向硬答。'},
  {k:'longdoc', name:'长文档与大上下文', metrics:['lcr','ctx','priceIn'],
   why:'先看长上下文推理实测（AA-LCR），再看窗口大小与输入单价 —— 窗口开得大不等于窗口里的内容真的用得上。',
   caveat:'AA-LCR 与窗口大小经常不一致：有 1M 窗口但 AA-LCR 只有 36% 的模型，也有 131K 窗口却拿 83% 的。'}
];

/* ==========================================================
   本期变化（自 2026-08-23 上一版快照以来）
   rank 的排序依据是「对选型的影响程度」，属于编辑判断。
   ========================================================== */
const CHANGES = [
  {rank:1, kind:'评测', date:'2026-09-19', models:[],
   title:'三把主要的尺同时换了：AAII v4.3、Terminal-Bench 4.0、CAI v1.5',
   detail:'智能指数从 v4.1.1 升到 v4.3（评测 9 项变 10 项并重新标定，头部从 63 分档变成 53 分档）；Terminal-Bench 主版本走到 4.0（66 题，重新标定算力与时限）；编码 Agent 指数升到 v1.5，改由 DeepSWE v1.1 + Terminal-Bench 4.0 + SWE-Atlas-QnA 等权合成。',
   impact:'上一版页面里的所有分数与本版都不在同一把尺上，不能相减、不能画涨跌。本页因此不做任何跨版本趋势。', src:'aa', view:'models'},
  {rank:2, kind:'厂商', date:'2026-09-03', models:['gpt6-astra'],
   title:'OpenAI 发布 GPT-6 Astra，与 Claude Fable 5.1 并列智能指数榜首',
   detail:'$10/$50、1M 上下文、缓存命中 $1。TB 4.0 拿到 59%，比第二名（Fable 5.1 的 52%）高 7 个百分点；GPQA 96% 也是本期最高。发布初期走 Daybreak Access 分批开放。',
   impact:'长链终端任务这一项上出现了明确的单一领先者，这是近几期里少见的。注意超过 272K 输入 token 会按更高档重算整个请求的价格。', src:'aa', view:'models'},
  {rank:3, kind:'价格', date:'2026-09-01', models:['claude-fable51'],
   title:'Anthropic 发布 Claude Fable 5.1，标价不变但缓存读取价砍到四分之一',
   detail:'$10/$50 与 Fable 5 完全一致，缓存读取从 $1 降到 $0.25（-75%）。官方估计典型负载省约 25%，复杂编码与高强度 Agent 场景可省约 45%。同日发布受限访问的 Mythos 5.1 与 Enterprise Frontier Safeguards。',
   impact:'高频 Agent 场景里缓存命中往往占账单大头，这条比任何一次标价调整都更影响实际成本。', src:'vendor', view:'pricing'},
  {rank:4, kind:'评测', date:'2026-09-01', models:['claude-opus5','ds-v4pro'],
   title:'vals.ai 归档 SWE-bench Verified，该基准停止更新',
   detail:'理由是成绩饱和（86 个模型里 7 个 ≥95%，榜首 Claude Opus 5 97.00% 距满分仅 3 分）。9 月后发布的模型不会再跑这个基准。',
   impact:'GPT-6 Astra、Claude Fable 5.1、Muse Spark 1.3、DeepSeek V4.1 Flash 永远不会有 SWE-bench 分数 —— 表里的空白是基准停更，不是数据没找到。选编码模型请改看 TB 4.0 与 CAI。', src:'vals', view:'models'},
  {rank:5, kind:'评测', date:'2026-09-19', models:['grok46','kimi-k3','claude-sonnet5'],
   title:'旧基准饱和掩盖了巨大差距：TB 2.1 与 TB 4.0 的排序几乎是两回事',
   detail:'Grok 4.6 在 TB 2.1 上 88%（与头部并列），到 TB 4.0 只剩 21%；Kimi K3 从 85% 掉到 13%；Claude Sonnet 5 从 81% 掉到 14%。而 GPT-6 Astra 是 88% → 59%。',
   impact:'如果你还在用 TB 2.1 或 SWE-bench 这类饱和榜挑长链 Agent 模型，很可能选错。', src:'aa', view:'models'},

  {rank:6, kind:'厂商', date:'2026-09-02', models:['muse13','gemini38','qwen38max'],
   title:'9 月 1–3 日三天内四家同时发新旗舰',
   detail:'9/1 Claude Fable 5.1 + Mythos 5.1；9/2 Meta Muse Spark 1.3、Google Gemini 3.8 Flash（+ Flash Cyber）、阿里 Qwen3.8-Max 0902；9/3 GPT-6 Astra。Gemini 3.8 与 Muse Spark 1.3 都维持了上一代的价格。',
   impact:'同价换代成了默认打法：同样的钱能买到的能力在一周内整体上了一个台阶。', src:'press', view:'intel'},
  {rank:7, kind:'价格', date:'2026-09-10', models:['ds-v41flash'],
   title:'DeepSeek V4.1 Flash 发布，V4 Flash 与 Vision 版退役',
   detail:'开源权重、原生视觉、1M 上下文、384K 最大输出，单任务成本 $0.27、吞吐 208 t/s。峰谷计价调整为：高峰仅工作日 UTC 01–04 与 06–10 时，其余时段一律低谷半价。旧模型名暂时路由到新模型。',
   impact:'现在一天里大部分时间都是低谷价（$0.15/$0.60），排期避峰的收益比上一期更大。', src:'vendor', view:'pricing'},
  {rank:8, kind:'生态', date:'2026-09-19', models:['ds-v4pro','claude-fable51'],
   title:'同一份编码任务，最贵与最便宜的组合差 50 倍',
   detail:'AA 实测：Claude Code + Fable 5.1 指数 62、单任务 $12.4；Codex + DeepSeek V4 Pro 指数 43、单任务 $0.24。中间还有 Muse Code + Muse Spark 1.3（54 分 / $3.98）和 Opencode + GLM-5.3（54 分 / $4.24）。',
   impact:'「用哪个模型」和「用哪个框架」现在是两个独立的成本杠杆，后者的杠杆率经常更大。', src:'aacai', view:'pricing'},
  {rank:9, kind:'厂商', date:'2026-09-12', models:[],
   title:'Altman 明确今年不 IPO；Anthropic 则瞄准 10 月上市',
   detail:'9/12 Altman 称当下上市「不明智」。Anthropic 已于 6 月秘密递交 S-1，目标 10 月纳斯达克上市、估值 2 万亿美元，由高盛 / 摩根大通 / 摩根士丹利承销，拟募资超 600 亿美元。',
   impact:'与模型选型无直接关系，但两家的资本节奏会影响后续定价与开放策略。', src:'press', view:'intel'},
  {rank:10, kind:'生态', date:'2026-09-19', models:['gpt6-astra','claude-fable51'],
   title:'OpenAI 两年半来首次在企业支出上反超 Anthropic',
   detail:'据 Ramp 的企业报销数据，GPT-6 Astra 约占其追踪到的企业 AI 支出的 13%，Claude Fable 约 8%；OpenAI 称上周用户在其模型上的花费也首次超过 Anthropic。',
   impact:'属于市场份额信号，不是能力信号 —— 两家的智能指数仍是并列 53。', src:'press', view:'intel'},
  {rank:11, kind:'厂商', date:'2026-08-26', models:['glm53flash','qwen38flashnext'],
   title:'国产「低价高能」档位成型：GLM-5.3-Flash 与 Qwen3.8-Flash-Next',
   detail:'GLM-5.3-Flash（8/26，320B 总参 / 18B 激活，GLM-5 系列首个原生多模态）AAII 42、单任务 $0.25；Qwen3.8-Flash-Next AAII 40、单任务 $0.37。两家在同一时间窗独立收敛到相似架构。',
   impact:'GLM-5.3-Flash 的智能指数与 GPT-5.6 Terra 齐平，单任务成本却只有它的 1/5.6 —— 这是本期性价比最突出的一档。', src:'aa', view:'models'},
  {rank:12, kind:'评测', date:'2026-09-19', models:['minimax-m3','ds-v41flash','gpt56-sol'],
   title:'非幻觉率拉开了比智能指数更大的差距',
   detail:'MiniMax-M3 82%、MiMo-V2.5-Pro 75%、Qwen3.8-Max 71%、GLM-5.3 70%；另一端 DeepSeek V4.1 Flash 只有 4%、GPT-5.6 Sol 8%、Claude Fable 5.1 27%。',
   impact:'做事实性问答或检索增强时，这一列比智能指数更该先看 —— 但它衡量的是「肯不肯说不知道」，不是知识多少。', src:'aa', view:'models'},
  {rank:13, kind:'生态', date:'2026-09-19', models:[],
   title:'新面孔进入前 10：StepFun Step 5 Preview',
   detail:'AAII 44 与 Grok 4.6 / Kimi K3 同档，单任务成本只要 $0.71，AA-LCR 88% 接近 Kimi K3 的 89%。',
   impact:'值得放进候选名单观察，但 preview 阶段没有 Arena、GPQA 与 SWE-bench 数据，生态成熟度未知。', src:'aa', view:'models'},
  {rank:14, kind:'价格', date:'2026-09-19', models:[],
   title:'订阅档位微调：Gemini Ultra 涨到 $249.99，Grok 新增 $100 档',
   detail:'Google AI Pro $19.99 / AI Ultra $249.99；Grok 在 SuperGrok（$30）与 Heavy（$300）之间新增 SuperGrok Plus $100，X Premium+ $40。ChatGPT 与 Claude 的档位未变。',
   impact:'订阅价与 API 用量价是两套账，本页分开列，不要相加。此条来自媒体汇总，未逐家核对官网。', src:'press', view:'pricing'},
  {rank:15, kind:'榜单', date:'2026-09-19', models:['claude-fable5','muse12'],
   title:'Arena 上多个「上一代」仍高于它们的继任者',
   detail:'claude-fable-5-high 1506 排第 1，高于 fable-5.1-max 的 1498（#5）；muse-spark-1.2 xHigh 1500（#4）高于 muse-spark-1.3-max 的 1493（#8）。',
   impact:'真人盲测偏好与基准能力经常背离，而且这些差值都落在置信区间内。把 Arena 名次当能力排名用是常见的误读。', src:'arena', view:'models'}
];

/* ==========================================================
   模型 × Agent 框架（AA Coding Agent Index v1.5 实测组合）
   cell: {s: 指数分, t: 'native'|'compat'|'na', cost: 单任务成本, note}
   ========================================================== */
const AGENT_FRAMEWORKS = ['Claude Code','Codex','Devin Fusion','Muse Code','Opencode','Grok Build','Kimi Code CLI','Antigravity SDK'];
const AGENT_MATRIX = [
  {id:'claude-fable51', cells:[{s:62,t:'native',note:'$12.4 / 任务'},{t:'na'},{s:62,t:'native',note:'+ SWE-2'},{t:'na'},{t:'compat'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'gpt6-astra',     cells:[{t:'compat'},{s:62,t:'native',note:'$7.47 / 任务'},{s:59,t:'native',note:'+ SWE-2'},{t:'na'},{t:'compat'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'claude-opus5',   cells:[{s:60,t:'native',note:'$10.8 / 任务'},{t:'na'},{t:'compat'},{t:'na'},{t:'compat'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'gpt56-sol',      cells:[{t:'compat'},{s:55,t:'native'},{t:'compat'},{t:'na'},{t:'compat'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'muse13',         cells:[{t:'compat'},{t:'na'},{t:'na'},{s:54,t:'native',note:'$3.98 / 任务'},{t:'compat'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'glm53',          cells:[{t:'compat'},{t:'na'},{t:'na'},{t:'na'},{s:54,t:'native',note:'$4.24 / 任务'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'kimi-k3',        cells:[{t:'compat'},{t:'compat'},{t:'na'},{t:'na'},{t:'native'},{t:'na'},{s:52,t:'native',note:'$5.05 / 任务'},{t:'na'}]},
  {id:'grok46',         cells:[{t:'na'},{t:'na'},{t:'na'},{t:'na'},{t:'na'},{s:47,t:'native',note:'$3.57 / 任务'},{t:'na'},{t:'na'}]},
  {id:'qwen38max',      cells:[{s:43,t:'compat',note:'$3.48 / 任务'},{t:'na'},{t:'na'},{t:'na'},{t:'native'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'ds-v4pro',       cells:[{t:'compat'},{s:43,t:'native',note:'$0.24 / 任务，全场最低'},{t:'na'},{t:'na'},{t:'native'},{t:'na'},{t:'na'},{t:'na'}]},
  {id:'gemini38',       cells:[{t:'na'},{t:'na'},{t:'na'},{t:'na'},{t:'compat'},{t:'na'},{t:'na'},{s:42,t:'native',note:'$2.47 / 任务'}]},
  {id:'ds-v4flash0731', cells:[{t:'na'},{s:39,t:'native'},{t:'na'},{t:'na'},{t:'native'},{t:'na'},{t:'na'},{t:'na'}]}
];

/* ---------- 订阅（与 API 用量价格分开，单位为每月个人套餐价） ---------- */
const SUBSCRIPTIONS = [
  {brand:'openai', product:'ChatGPT', tiers:[['免费','$0'],['Go','$8 / 月'],['Plus','$20 / 月'],['Pro','$100 / $200 / 月']],
   note:'GPT-6 Astra 对 Plus / Pro / Business / Enterprise 分批开放。档位与上一期相同。'},
  {brand:'anthropic', product:'Claude', tiers:[['免费','$0'],['Pro','$20 / 月'],['Max 5×','$100 / 月'],['Max 20×','$200 / 月']],
   note:'Pro 默认 Sonnet 5、Max 默认 Opus 5。公司已递交 S-1，目标 10 月上市、估值 2 万亿美元。'},
  {brand:'google', product:'Gemini', tiers:[['免费','$0'],['AI Pro','$19.99 / 月'],['AI Ultra','$249.99 / 月']],
   note:'Ultra 档较上一期记录的 $99.99 / $199.99 有调整，本条来自媒体汇总，未逐项核对官网。'},
  {brand:'xai', product:'Grok', tiers:[['免费','$0 · 有限额度'],['X Premium+','$40 / 月'],['SuperGrok','$30 / 月'],['SuperGrok Plus','$100 / 月（新增）'],['SuperGrok Heavy','$300 / 月']],
   note:'本期在 $30 与 $300 之间新增了 $100 档。'},
  {brand:'moonshot', product:'Kimi', tiers:[['Adagio','$0'],['Moderato','$19 / 月'],['Allegretto','$39 / 月'],['Allegro / Vivace','$99 / $199 / 月']],
   note:'按 Agent 任务额度分档；K3 需 Moderato 及以上。档位沿用上一期记录，本期未见变更公告。'},
  {brand:'minimax', product:'MiniMax', tiers:[['Agent Basic','$39 / 月'],['Agent Pro','$119 / 月'],['Coding Starter / Plus','$10 / $20 / 月'],['Coding Max / Ultra HS','$50 / $150 / 月']],
   note:'Coding Plan 共六档，按 5 小时窗口的 prompt 配额计费。沿用上一期记录。'},
  {brand:'mistral', product:'Le Chat', tiers:[['Pro','$14.99 / 月'],['Team','$24.99 / 月'],['学生价','$7.04 / 月'],['Enterprise','定制']],
   note:'欧盟数据驻留与主权合规部署是其主要卖点；模型能力本期全面落后。'},
  {brand:null, multi:true, product:'中国厂商免费层', sub:'DeepSeek / Kimi / 豆包 / 千问 / 智谱',
   tiers:[['DeepSeek 官方','免费 App'],['Kimi / 豆包 / 千问','免费 App'],['智谱清言 GLM','免费 + Pro'],['开源权重','本地自部署']],
   note:'国产主力仍走「App 免费 + API 计价 + 权重开源」三条腿，订阅制不是主要收入形式。'}
];

/* ==========================================================
   厂商档案（长文放抽屉，列表只出一行摘要）
   ========================================================== */
const VENDORS = [
{key:'anthropic', models:['claude-fable51','claude-opus5','claude-sonnet5','claude-mythos51','claude-haiku45','claude-fable5','claude-opus48'],
 family:'Fable 5.1 / Opus 5 / Sonnet 5 / Mythos 5.1 / Haiku 4.5', fresh:true,
 lede:'智能指数与编码 Agent 指数并列第一；同时进入 IPO 最后阶段，目标 10 月纳斯达克上市。',
 facts:[['AAII','53 并列第一'],['CAI','62 第一'],['目标估值','2 万亿美元']],
 tech:'9/1 同日发布 Claude Fable 5.1、受限访问的 Mythos 5.1 与 Enterprise Frontier Safeguards。Fable 5.1 标价不变（$10/$50）但缓存读取价从 $1 降到 $0.25，官方估算典型负载省约 25%、复杂 Agent 场景省约 45%。Opus 5 在 GDPval 真实工作任务上仍是 62% 的本期最高分，也是 SWE-bench 归档时的终局冠军（97.00%）。',
 scene:'编码与 Agent 终端任务、知识工作、长文档。',
 keypoints:'IPO：6 月已秘密递交 S-1，目标 10 月纳斯达克上市、估值 2 万亿美元，高盛 / 摩根大通 / 摩根士丹利承销，拟募资超 600 亿美元。竞争面：据 Ramp 数据，OpenAI 在企业 AI 支出份额上两年半来首次反超（Astra 约 13% vs Claude Fable 约 8%）。短板：Fable 5.1 非幻觉率仅 27%，在头部里偏低。',
 foot:'Fable 5.1 $10/$50（缓存 $0.25）· Opus 5 $5/$25 · 1M 上下文'},

{key:'openai', models:['gpt6-astra','gpt56-sol','gpt56-terra','gpt56-luna','gpt53-codex','gpt55'],
 family:'GPT-6 Astra / GPT-5.6 Sol · Terra · Luna / GPT-5.3 Codex', fresh:true,
 lede:'GPT-6 Astra 把长链终端任务拉开了差距，企业支出份额两年半来首次反超 Anthropic；但今年不 IPO。',
 facts:[['AAII','53 并列第一'],['TB 4.0','59% 第一'],['GPQA','96% 第一']],
 tech:'9/3 发布 GPT-6 Astra：$10/$50、1M 上下文、缓存命中 $1、缓存写入 $12.50，Batch / Flex 半价、Fast 模式双倍，超过 272K 输入 token 会按更高档重算整个请求。TB 4.0 59% 领先第二名 7 个百分点。上一代 GPT-5.6 Sol 仍在促销价 $4/$20，成了家族里的性价比档。',
 scene:'长链终端 Agent、后台 PR、沙箱并行、全模态任务。',
 keypoints:'9/12 Altman 明确表示今年不会 IPO，称当下上市「不明智」。Ramp 数据显示 GPT-6 Astra 约占其追踪的企业 AI 支出 13%。短板：GPT-5.6 家族的非幻觉率极低（Sol 8%、Terra 12%、Luna 7%），事实性任务需自建校验；METR 曾点名 Sol 在部署前评估中的测试作弊率最高。',
 foot:'Astra $10/$50 · Sol $4/$20（促销）· Terra $2/$12 · Luna $0.20/$1.20'},

{key:'google', models:['gemini38','gemini31pro','gemini35lite','gemini37'],
 family:'Gemini 3.8 Flash（+ Cyber）/ 3.1 Pro Preview / 3.5 Flash-Lite', fresh:true,
 lede:'Flash 线六周三代，吞吐与价格继续压低；长链 Agent 仍是明确短板。',
 facts:[['输出速度','298 t/s'],['Arena','#9（初步）'],['TB 4.0','20%']],
 tech:'9/2 发布 Gemini 3.8 Flash，价格与 3.7 Flash 完全相同（$0.75/$3.75），官方公布的每一项基准都优于前代；同期另发 Gemini 3.8 Flash Cyber 安全特化版。Antigravity SDK 是其配套的编码 Agent 框架，CAI 42、单任务成本 $2.47、平均耗时 11.7 分钟（本期最快）。',
 scene:'Workspace 深度集成、高吞吐轻量任务、超长文档。',
 keypoints:'Gemini 3.5 Flash-Lite 以 358 t/s 保持本页最快。订阅档位调整为 AI Pro $19.99 / AI Ultra $249.99。短板：3.8 Flash 的 TB 4.0 只有 20%，CAI 42 在 Agent 组合里处于末段；Pro 线迭代仍然滞后，3.1 Pro 的 GDPval 只有 20%。',
 foot:'3.8 Flash $0.75/$3.75 · 1M 上下文 · 9/2 发布'},

{key:'meta', models:['muse13','muse12','muse-glimmer'],
 family:'Muse Spark 1.3 / Muse Glimmer / Muse Code', fresh:true,
 lede:'性价比最突出的一档：AAII 第四，单任务成本只有旗舰的四分之一，吞吐 214 t/s。',
 facts:[['AAII','48 第四'],['单任务成本','$1.60'],['非幻觉率','67%']],
 tech:'9/2 发布 Muse Spark 1.3，距 1.2 只有四周，价格不变（$1.25/$4.25，缓存 $0.15）。原生多模态，支持文本 / 图像 / 视频输入，1M 上下文。配套 Muse Code 框架 CAI 54、单任务 $3.98、平均耗时 18.4 分钟。',
 scene:'高吞吐工具调用、长会话 Agent、低成本批量任务。',
 keypoints:'Muse Glimmer 30B 以 Apache 2.0 开源，24GB 显卡可跑，AA-LCR 83% 在小模型里很突出。有意思的是 Arena 上前代 1.2（1500，#4）仍高于 1.3（1493，#8）。短板：TB 4.0 仅 33%。',
 foot:'$1.25 / $4.25 · 1M 上下文 · 9/2 发布'},

{key:'zai', models:['glm53','glm53flash','glm52'],
 family:'GLM-5.3 / GLM-5.3-Flash',
 lede:'开源阵营的能力天花板，同时把低价档做到了与中端闭源同等水平。',
 facts:[['GLM-5.3 CAI','54 开源第一'],['TB 4.0','42% 开源第一'],['Flash 单任务','$0.25']],
 tech:'GLM-5.3 的 CAI 54 与闭源的 Muse Spark 1.3 持平，TB 4.0 42% 是开源第一，价格只有旗舰的七分之一。GLM-5.3-Flash（8/26 发布，320B 总参 / 18B 激活）是 GLM-5 系列首个原生多模态模型，AAII 42 与 GPT-5.6 Terra 齐平，单任务成本却只要 $0.25。',
 scene:'终端编码、开源可控部署、预算敏感的高频调用。',
 keypoints:'两款模型均开源权重。GLM-5.3-Flash 的 GDPval 58% 甚至高于自家旗舰的 57%；非幻觉率 70–72% 也明显高于美国头部。上一版页面里「GLM-5.3 上下文 = 753B」的错误已修正：753B 是参数量，上下文是 1M。',
 foot:'GLM-5.3 $1.4/$4.4 · Flash $0.15/$0.50 · 均开源权重'},

{key:'alibaba', models:['qwen38max','qwen38flashnext','qwen38-27b'],
 family:'Qwen3.8-Max（0902）/ Flash-Next / 27B / Omni-Flash', fresh:true,
 lede:'型号矩阵最完整的一家：从 2.4T 旗舰到 27B 端侧，全线非幻觉率都在 70% 上下。',
 facts:[['AAII','45'],['TB 2.1','89%'],['非幻觉率','71%']],
 tech:'9/2 发布 Qwen3.8-Max 0902 版，登顶 Arena 前端开发子榜；同期另发 Qwen3.8-Omni-Flash（文本 / 图像 / 音频 / 视频同时输入，1M 上下文）。Qwen3.8-Flash-Next 与 GLM-5.3-Flash 在同一时间窗独立收敛到相似的架构路线。',
 scene:'中文场景、电脑操作、开源本地部署、多模态。',
 keypoints:'非幻觉率全线领先（Max 71%、Flash-Next 55%、27B 70%）。短板：Max 的单任务成本 $5.41 偏高 —— 标价 $2/$6 不贵，但 token 消耗大且吞吐只有 37 t/s；CAI 43 说明它在主流 Agent 框架上的适配还没调优。',
 foot:'Max $2/$6 · Flash-Next $0.15/$0.47 · 27B 开源权重'},

{key:'deepseek', models:['ds-v41flash','ds-v4pro','ds-v4flash0731'],
 family:'V4.1 Flash / V4 Pro 0813', fresh:true,
 lede:'成本杀手依旧：配 Codex 跑编码 Agent 的单任务成本是头部方案的 1/50。',
 facts:[['V4.1 单任务','$0.27'],['V4 Pro + Codex','$0.24 / 任务'],['非幻觉率','4–5%']],
 tech:'9/10 发布 V4.1 Flash：开源权重、原生视觉理解、1M 上下文、384K 最大输出、208 t/s。V4 Flash 与 V4 Flash Vision Exp 同时退役，旧模型名暂时路由到新模型。峰谷计价调整为高峰仅工作日 UTC 01–04 与 06–10 时，其余时段一律低谷半价。',
 scene:'高频 Agent 调用、批量生产流量、本地私有化、预算极限压缩。',
 keypoints:'AA 实测 Codex + DeepSeek V4 Pro 的单任务成本仅 $0.24，而 Claude Code + Fable 5.1 是 $12.4（指数 43 对 62）—— 这是本期最大的成本杠杆。短板：非幻觉率 4–5% 是本期最低，事实性任务必须自己加校验层；TB 4.0 只有 14–27%。',
 foot:'V4.1 Flash 高峰 $0.30/$1.20、低谷 $0.15/$0.60 · 均开源权重'},

{key:'xai', models:['grok46','grok45'],
 family:'Grok 4.6 / Grok Build',
 lede:'旧榜上与头部并列，新榜上掉队 —— 本期基准换代中落差最大的一家。',
 facts:[['TB 2.1','88%'],['TB 4.0','21%'],['GPQA','95%']],
 tech:'Grok 4.6 在 TB 2.1 上 88%（与 GPT-6 Astra 持平），到 TB 4.0 只剩 21%；GPQA 95% 与 SWE-bench 95.6% 仍在头部。配套 Grok Build 框架 CAI 47、单任务 $3.57。',
 scene:'编辑器内交互式开发、高性价比日常编码。',
 keypoints:'上下文 500K 是头部里最小的，超过 200K 还要按 $4/$12 计价。此前 Adversa AI 披露的加密提示注入漏洞需自行评估。订阅端本期在 $30 与 $300 之间新增 SuperGrok Plus $100 档。',
 foot:'$2 / $6 · 500K 上下文 · 超 200K 按 $4/$12'},

{key:'moonshot', models:['kimi-k3','kimi-k27code'],
 family:'Kimi K3 / K2.7 Code',
 lede:'长上下文推理本期第一，但长链终端任务几乎不能指望。',
 facts:[['AA-LCR','89% 第一'],['上下文','1.05M 最大'],['TB 4.0','13%']],
 tech:'Kimi K3 的 AA-LCR 89% 是本期最高，上下文 1.05M 也是最大的一档，配套 Kimi Code CLI 框架 CAI 52。约 2.8T MoE，仍是开源规模纪录保持者之一。',
 scene:'长文档分析、深度研究、知识工作。',
 keypoints:'许可不是传统自由开源：Kimi K3 License 规定商业服务收入达标需协商分成。短板：TB 4.0 仅 13%（TB 2.1 还有 85%，落差极大）；吞吐 38 t/s 偏慢，Agent 平均耗时 1 小时是本期最长。',
 foot:'$3 / $15 · 1.05M 上下文 · 开源权重（分成许可）'},

{key:'stepfun', models:['step5'],
 family:'Step 5 Preview', fresh:true,
 lede:'本期最值得观察的新面孔：头部同档智能，成本只有三分之一。',
 facts:[['AAII','44'],['单任务成本','$0.71'],['AA-LCR','88%']],
 tech:'AAII 44 与 Grok 4.6、Kimi K3 同档，单任务成本 $0.71（Kimi K3 是 $2.00），AA-LCR 88% 接近 Kimi K3 的 89%，吞吐 100 t/s。',
 scene:'长文档、通用问答、成本敏感的中高端场景。',
 keypoints:'仍是 preview 阶段：没有 Arena 数据、没有 GPQA、没有 SWE-bench，生态与工具链成熟度未知。建议先小规模验证再纳入生产。',
 foot:'$1.00 / $2.70 · 1M 上下文 · preview'},

{key:'minimax', models:['minimax-m3'],
 family:'MiniMax-M3',
 lede:'非幻觉率 82% 本期第一 —— 最愿意承认自己不知道的模型。',
 facts:[['非幻觉率','82% 第一'],['吞吐','186 t/s'],['TB 4.0','2%']],
 tech:'428B 总参 / 23B 激活 MoE，开源权重，1M 上下文，$0.30/$1.20。视频与图像生成（海螺）仍在第一梯队。',
 scene:'事实性问答、检索增强、多模态创作、开源本地部署。',
 keypoints:'上一版页面里「上下文 = 428B、输入价 = 开源」两处错误已修正（428B 是参数量，价格是 $0.30/$1.20）。短板：TB 4.0 仅 2%，完全不适合 Agent 场景；本地部署需 256GB 级工作站。',
 foot:'$0.30 / $1.20 · 1M 上下文 · 开源权重'},

{key:'xiaomi', models:['mimo25pro'],
 family:'MiMo-V2.5-Pro',
 lede:'单任务成本 $0.05 全场最低，还能端侧离线跑。',
 facts:[['单任务成本','$0.05 最低'],['非幻觉率','75%'],['上下文','1M']],
 tech:'1M 上下文、开源权重、$0.43/$0.87，缓存命中价接近于零。面向端侧推理深度优化。',
 scene:'手机内置助手、离线推理、隐私敏感任务、极限压成本。',
 keypoints:'TB 4.0 为 0%，完全不适合 Agent 场景，但在「便宜 + 肯说不知道」这个组合上没有对手。',
 foot:'$0.43 / $0.87 · 1M 上下文 · 开源权重 · 可端侧'},

{key:'tencent', models:['hy3'],
 family:'混元 Hy3',
 lede:'单任务成本 $0.07，与微信 / 企微工具链深度绑定。',
 facts:[['AAII','26'],['单任务成本','$0.07'],['上下文','256K']],
 tech:'295B 总参 / 21B 激活 MoE、256K 上下文、开源权重、$0.14/$0.58。',
 scene:'微信小程序与公众号自动化、企微办公、社交场景对话。',
 keypoints:'TB 4.0 仅 1%；非幻觉率 26% 偏低。真正的价值在生态绑定而不是模型能力本身。',
 foot:'$0.14 / $0.58 · 256K 上下文 · 开源权重'},

{key:'nvidia', models:['nemotron3ultra','nemotron35'],
 family:'Nemotron 3 Ultra / 3.5 Lightning',
 lede:'把价格和吞吐做到极致，能力指标全线中下游。',
 facts:[['Lightning 标价','$0.06 / $0.20'],['Lightning 吞吐','293 t/s'],['Ultra 非幻觉','70%']],
 tech:'Nemotron 3.5 Lightning：30B 总参 / 3B 激活、1M 上下文、$0.06/$0.20，是本页最低标价。Nemotron 3 Ultra 的非幻觉率 70%、吞吐 164 t/s。均开源权重。',
 scene:'极简高吞吐任务、企业 RAG 底座、Agent 多模型路由的低端档。',
 keypoints:'Lightning 的 AA-LCR 只有 60%、TB 2.1 只有 24%，不要用于任何需要连续推理的场景。',
 foot:'Lightning $0.06 / $0.20 · 1M 上下文 · 开源权重'},

{key:'mistral', models:['mistral-l3'],
 family:'Mistral Large 3 · Le Chat',
 lede:'卖点是管辖权而不是能力：Apache 2.0 全开源 + 欧盟数据驻留。',
 facts:[['许可','Apache 2.0'],['规模','675B / 41B 激活'],['AA-LCR','36%']],
 tech:'细粒度稀疏 MoE，256K 上下文，$0.50/$1.50。',
 scene:'欧盟数据驻留、主权合规部署、需要完全开源许可的场景。',
 keypoints:'本期能力数据全面落后：AA-LCR 36%、TB 2.1 12%、GDPval 4%、SWE-bench 41.4%。如果不是硬性的合规或许可要求，按能力选型排不上号。',
 foot:'$0.50 / $1.50 · 256K 上下文 · Apache 2.0'},

{key:'motif', models:['motif3'],
 family:'Motif 3',
 lede:'韩国主权 AI 基础模型项目入选者，开源权重，数据仍不完整。',
 facts:[['AAII','34（部分评测）'],['非幻觉率','72%'],['上下文','262K']],
 tech:'', scene:'',
 keypoints:'AA 的智能指数只跑了部分评测（带 * 号），没有公开 API 定价与速度数据，不足以支撑选型判断。',
 foot:'262K 上下文 · 开源权重 · 定价未公布'}
];

/* ==========================================================
   时间线（2026 年 6 月至今，重点覆盖上一版快照 8/23 之后）
   ========================================================== */
const TIMELINE = [
 {d:'06-09', t:'Claude Fable 5 发布', x:'此后长期霸榜；至今仍是 Arena 真人盲测第 1 名（1506）。'},
 {d:'06-16', t:'智谱 GLM-5.2 开源进入前沿俱乐部', x:'第一家非中美巨头的开源前沿模型。'},
 {d:'07-06', t:'腾讯混元 Hy3 正式版', x:'295B / 21B 激活 MoE，256K 上下文，开源权重。'},
 {d:'07-08', t:'Grok 4.5 发布', x:'约 80 t/s；嵌入 Cursor 全系。'},
 {d:'07-09', t:'GPT-5.6 家族 GA：Sol / Terra / Luna', x:'能力分层策略成型，一个家族覆盖从深推理到高吞吐。'},
 {d:'07-16', t:'Kimi K3 发布', x:'约 2.8T MoE；至今仍保持 AA-LCR 长上下文推理第一（89%）。'},
 {d:'07-21', t:'Gemini 3.6 Flash / 3.5 Flash-Lite 发布', x:'Flash-Lite 的 358 t/s 至今仍是本页最快。'},
 {d:'07-24', t:'Claude Opus 5 发布', x:'$5/$25；GDPval 真实工作任务 62% 至今仍是最高分。'},
 {d:'07-31', t:'DeepSeek V4 Flash 0731 发布', x:'SWE-bench 88.8%；已于 9/10 退役。'},
 {d:'08-05', t:'Muse Spark 1.2 发布', x:'Arena 1500（#4），至今仍高于继任者 1.3。'},
 {d:'08-11', t:'NVIDIA Nemotron 3.5 Lightning 发布', x:'30B / 3B 激活，$0.06/$0.20，本页最低标价。'},
 {d:'08-12', t:'Grok 4.6 发布', x:'TB 2.1 88% 与头部并列 —— 但一个月后的 TB 4.0 只剩 21%。'},
 {d:'08-13', t:'DeepSeek V4 Pro 0813 GA', x:'SWE-bench 96.4%，归档时的开源第一。'},
 {d:'08-14', t:'智谱 GLM-5.3 发布 + Qwen3.8 27B 开源', x:'GLM-5.3 至今仍是开源阵营的能力天花板。'},
 {d:'08-16', t:'Terminal-Bench 3.0 发布', x:'把 TB 2.0 的 80%+ 打回 40% 以下；一个月后又被 4.0 取代。', hot:true},
 {d:'08-17', t:'DeepSeek 峰谷计价生效', x:'低价策略转向精细化运营的分水岭。'},
 {d:'08-21', t:'OpenAI 开源 Codex Harness；GPT-5.6 Sol 降价至 $4/$20', x:'该促销价至今仍在生效。'},
 {d:'08-26', t:'智谱 GLM-5.3-Flash 发布', x:'320B / 18B 激活，GLM-5 系列首个原生多模态；单任务成本 $0.25。', hot:true},
 {d:'08-28', t:'阿里 Qwen3.8-Flash-Next 发布', x:'与 GLM-5.3-Flash 在同一时间窗独立收敛到相似架构。'},
 {d:'09-01', t:'Anthropic：Claude Fable 5.1 + Mythos 5.1 + Enterprise Frontier Safeguards', x:'标价不变，缓存读取价砍到 1/4（$1 → $0.25）。', hot:true},
 {d:'09-01', t:'vals.ai 归档 SWE-bench Verified', x:'成绩饱和，不再跑新模型。此后发布的模型永远不会有该分数。', hot:true},
 {d:'09-02', t:'Meta Muse Spark 1.3 · Google Gemini 3.8 Flash · 阿里 Qwen3.8-Max 0902', x:'一天之内三家同价换代；Gemini 同期另发 3.8 Flash Cyber。', hot:true},
 {d:'09-03', t:'OpenAI 发布 GPT-6 Astra', x:'$10/$50、1M 上下文；TB 4.0 59% 领先第二名 7 个百分点。', hot:true},
 {d:'09-10', t:'DeepSeek V4.1 Flash 发布，V4 Flash 与 Vision 版退役', x:'开源权重 + 原生视觉；峰谷时段调整，大部分时间按低谷价计费。', hot:true},
 {d:'09-12', t:'Altman：OpenAI 今年不 IPO', x:'称当下上市「不明智」；同期 Anthropic 目标 10 月上市、估值 2 万亿美元。', hot:true},
 {d:'09-19', t:'本期数据抓取', x:'AA 智能指数已是 v4.3、Terminal-Bench 已是 4.0、编码 Agent 指数已是 v1.5 —— 三把尺同时换代。', hot:true, last:true}
];

/* ==========================================================
   本期研究要点（可展开列表）
   ========================================================== */
const NOTES = [
 {n:'v4.3', t:'智能指数换尺：头部从 63 分档变成 53 分档', s:'Artificial Analysis · 2026-09-19', models:['claude-fable51','gpt6-astra'],
  d:'AAII v4.3 由 10 项评测等权合成：AA-Briefcase、GDPval-AA v2、AutomationBench-AA、Terminal-Bench 4.0、SciCode、Humanity’s Last Exam、GDP.pdf、CritPt、AA-Omniscience、AA-LCR v1.1。上一版页面用的是 v4.1.1（9 项）。两套分数不是同一把尺，不能相减也不能画趋势。'},
 {n:'59%', t:'Terminal-Bench 4.0：GPT-6 Astra 领先 7 个百分点', s:'Terminal-Bench / AA 独立复跑 · 2026-09-19', models:['gpt6-astra','claude-fable51','claude-opus5'],
  d:'TB 4.0 共 66 题，覆盖软件、机器学习、科学、运维、安全、硬件、媒体七个域，重新标定了算力与时限，并移除了 8 道已饱和或有质量问题的题。pass@1 取三次平均。Astra 59%、Fable 5.1 52%、Opus 5 49%。'},
 {n:'归档', t:'SWE-bench Verified 停止更新', s:'vals.ai · 2026-09-01', models:['claude-opus5','ds-v4pro'],
  d:'86 个被评测的模型里有 7 个达到 95% 以上，榜首 Claude Opus 5 的 97.00% 距满分只剩 3 分 —— vals.ai 判定该基准已无法区分前沿模型，正式归档。开源权重模型已经站上顶端：DeepSeek V4 Pro 0813 以 96.40% 位列第二，距闭源第一仅 0.6 分。'},
 {n:'88 → 21', t:'Grok 4.6 在新旧终端基准上的落差', s:'Artificial Analysis · 2026-09-19', models:['grok46'],
  d:'TB 2.1 上 Grok 4.6 拿 88%，与 GPT-6 Astra 持平；换到 TB 4.0 只剩 21%，而 Astra 是 59%。同类落差还有 Kimi K3（85% → 13%）、Claude Sonnet 5（81% → 14%）。饱和的旧基准会把这种差距完全掩盖掉。'},
 {n:'50×', t:'同一份编码任务，最贵与最便宜的组合差 50 倍', s:'AA Coding Agent Index v1.5 · 2026-09-19', models:['claude-fable51','ds-v4pro'],
  d:'Claude Code + Fable 5.1：指数 62，单任务 $12.4，平均耗时 34.8 分钟。Codex + DeepSeek V4 Pro：指数 43，单任务 $0.24，平均耗时 40.3 分钟。中间档：Muse Code + Muse Spark 1.3（54 / $3.98 / 18.4 分钟）、Opencode + GLM-5.3（54 / $4.24 / 48.1 分钟）、Antigravity SDK + Gemini 3.8 Flash（42 / $2.47 / 11.7 分钟，最快）。'},
 {n:'-75%', t:'Claude Fable 5.1 缓存读取价砍到四分之一', s:'Anthropic · 2026-09-01', models:['claude-fable51'],
  d:'标价仍是 $10/$50，但缓存读取从 $1 降到 $0.25。官方估计典型负载可省约 25%，复杂编码与高强度 Agent 场景可省约 45% —— 因为这类场景里缓存读取往往占账单大头。同日还发布了受限访问的 Mythos 5.1 与 Enterprise Frontier Safeguards。'},
 {n:'272K', t:'GPT-6 Astra 的长输入会整单重新计价', s:'OpenAI · 2026-09-03', models:['gpt6-astra'],
  d:'任何超过 272K 输入 token 的请求会按更高档重新计价整个请求，而不只是超出部分。另外 Batch 与 Flex 模式半价、Fast 模式双倍。做长文档处理时这条比标价本身更影响账单。'},
 {n:'82% vs 4%', t:'非幻觉率的差距比智能指数大得多', s:'Artificial Analysis · 2026-09-19', models:['minimax-m3','ds-v41flash'],
  d:'AA-Omniscience 非幻觉率（1 − 幻觉率）：MiniMax-M3 82%、MiMo-V2.5-Pro 75%、Claude 4.5 Haiku 73%、Motif 3 72%、GLM-5.3-Flash 72%、Qwen3.8-Max 71%；另一端 DeepSeek V4.1 Flash 4%、DeepSeek V4 Pro 5%、GPT-5.6 Luna 7%、GPT-5.6 Sol 8%。这衡量的是「不知道时肯不肯说不知道」，不是知识多少。'},
 {n:'89%', t:'长上下文推理：Kimi K3 第一，窗口大小不等于能力', s:'Artificial Analysis AA-LCR v1.1 · 2026-09-19', models:['kimi-k3','step5','mistral-l3'],
  d:'Kimi K3 89%、Step 5 Preview 88%、Claude Fable 5.1 85%、GPT-5.6 Sol 84%。反例：Mistral Large 3 有 256K 窗口但 AA-LCR 只有 36%；Muse Glimmer 只有 131K 窗口却拿到 83%。选长文档模型只看窗口大小会选错。'},
 {n:'$0.25', t:'GLM-5.3-Flash：与 GPT-5.6 Terra 同智能，成本只有 1/5.6', s:'Artificial Analysis · 2026-09-19', models:['glm53flash','gpt56-terra'],
  d:'两者 AAII 都是 42。GLM-5.3-Flash 单任务成本 $0.25、标价 $0.15/$0.50；GPT-5.6 Terra 单任务 $1.40、标价 $2/$12。GLM-5.3-Flash 的 GDPval（58%）甚至高于自家旗舰 GLM-5.3（57%）。'},
 {n:'9/1–9/3', t:'三天内四家发新旗舰，且大多维持原价', s:'各厂商官方 · 2026-09', models:['claude-fable51','muse13','gemini38','gpt6-astra'],
  d:'9/1 Claude Fable 5.1（同价，缓存降价）；9/2 Muse Spark 1.3（同价）、Gemini 3.8 Flash（同价）、Qwen3.8-Max 0902；9/3 GPT-6 Astra（$10/$50，对齐 Fable 5.1）。同价换代成了默认打法。'},
 {n:'13% vs 8%', t:'OpenAI 两年半来首次在企业支出上反超 Anthropic', s:'Ramp 企业报销数据 / 媒体报道 · 2026-09', models:['gpt6-astra','claude-fable51'],
  d:'GPT-6 Astra 约占 Ramp 追踪到的企业 AI 支出 13%，Claude Fable 约 8%。OpenAI 另称上周用户在其模型上的花费也首次超过 Anthropic。这是市场份额信号，不是能力信号 —— 两家的智能指数仍是并列 53。'},
 {n:'2 万亿', t:'Anthropic 瞄准 10 月上市，OpenAI 今年不 IPO', s:'路透 / 彭博 / 媒体报道 · 2026-09', models:[],
  d:'Anthropic 6 月已秘密递交 S-1，目标 10 月纳斯达克上市、估值 2 万亿美元，高盛 / 摩根大通 / 摩根士丹利承销，拟募资超 600 亿美元。9/12 Altman 明确表示 OpenAI 今年不会上市，称当下「不明智」。'},
 {n:'V4.1', t:'DeepSeek 换代并调整峰谷时段', s:'DeepSeek 官方 API 文档 · 2026-09-10', models:['ds-v41flash'],
  d:'V4.1 Flash 开源权重、原生视觉、1M 上下文、384K 最大输出。峰谷规则现为：高峰仅工作日 UTC 01:00–04:00 与 06:00–10:00（不含中国法定节假日），其余时段一律低谷价（半价）。V4 Flash 与 V4 Flash Vision Exp 已退役，旧模型名暂时路由到 V4.1 Flash。'},
 {n:'Arena 背离', t:'多个上一代在真人盲测上仍高于继任者', s:'arena.ai · 2026-09-19', models:['claude-fable5','muse12'],
  d:'claude-fable-5-high 1506±5 排第 1，高于 claude-fable-5.1-max 的 1498±8（#5）；muse-spark-1.2 xHigh 1500±11（#4）高于 muse-spark-1.3-max 的 1493±9（#8）。注意这些差值都落在置信区间内，头部十余名互相统计并列 —— 把 Arena 名次当能力排名用是常见误读。'},
 {n:'320B', t:'国产 Flash 档位：两家独立收敛到相似架构', s:'MarkTechPost / IT 之家 · 2026-08', models:['glm53flash','qwen38flashnext'],
  d:'GLM-5.3-Flash（320B 总参 / 18B 激活，8/26）与 Qwen3.8-Flash-Next（8/28）在同一时间窗发布，架构路线高度相似。GLM-5.3-Flash 首次进入 Arena 代码榜前十，Qwen3.8-Max 0902 登顶前端开发子榜。'},
 {n:'358 t/s', t:'吞吐天花板与「快不等于省时间」', s:'Artificial Analysis · 2026-09-19', models:['gemini35lite','gemini38','ds-v41flash'],
  d:'Gemini 3.5 Flash-Lite 358 t/s、Gemini 3.8 Flash 298 t/s、Nemotron 3.5 Lightning 293 t/s、Muse Spark 1.3 214 t/s、DeepSeek V4.1 Flash 208 t/s。但在编码 Agent 场景里决定总耗时的是轮数：Antigravity SDK + Gemini 3.8 Flash 平均 11.7 分钟，Kimi Code CLI + Kimi K3 要 1 小时。'},
 {n:'Cyber', t:'安全特化线继续分叉', s:'Google / Anthropic · 2026-09', models:['claude-mythos51'],
  d:'Google 随 3.8 Flash 同期发布 Gemini 3.8 Flash Cyber；Anthropic 的 Mythos 5.1 只向通过审核的网络安全与生命科学机构开放。这类模型都不进入常规选型，但会影响「同一家厂商的最强能力到底是什么」的判断。'}
];

/* ==========================================================
   权威声音（默认折叠，展开查看全部）
   —— 均为对本期数据的直接引用或权威机构的公开表述
   ========================================================== */
const VOICES = [
 {q:'该基准的成绩已经饱和，我们不再对新发布的模型运行它。既往结果保留存档。', a:'vals.ai', r:'SWE-bench Verified 归档公告', d:'2026-09-01', key:true},
 {q:'86 个被评测的模型里有 7 个达到 95% 以上，榜首 Claude Opus 5 的 97.00% 距满分只剩 3 个百分点 —— 仅凭这一个基准，已经很难再区分前沿模型了。', a:'vals.ai', r:'SWE-bench Verified 关键结论', d:'2026-09-01', key:true},
 {q:'开源权重模型已经站上最顶端：DeepSeek V4 Pro 0813 以 96.40% 位列总榜第二，距闭源第一只差 0.60 分。', a:'vals.ai', r:'SWE-bench Verified 关键结论', d:'2026-09-01'},
 {q:'v4.0 重新标定了算力与时限配额，改进了指令、环境与验证器的公平性，并移除了 8 道已饱和、易触发拒答、已被公开解出或存在未解决质量问题的题目。', a:'Terminal-Bench', r:'4.0 版本说明', d:'2026-09', key:true},
 {q:'编码 Agent 指数评的是「框架 × 模型」的组合，而不是模型本身 —— 同一个模型换一个 harness，分数会变。', a:'Artificial Analysis', r:'Coding Agent Index v1.5 方法论', d:'2026-09', key:true},
 {q:'提示缓存的命中率会随服务商的路由策略大幅波动，这会实质性地改变有效成本。', a:'Artificial Analysis', r:'Coding Agent Index 成本口径说明', d:'2026-09'},
 {q:'很多用户是通过订阅计划而不是按 token 付费来使用这些编码 Agent 的。', a:'Artificial Analysis', r:'Coding Agent Index 成本口径说明', d:'2026-09'},
 {q:'现在上市是不明智的。', a:'Sam Altman', r:'OpenAI CEO · 回应 IPO 传闻', d:'2026-09-12', key:true},
 {q:'缓存读取价下调 75% 之后，典型负载大约能省 25%；在缓存读取占账单大头的复杂编码与高强度 Agent 场景里，可以省到约 45%。', a:'Anthropic', r:'Claude Fable 5.1 发布说明', d:'2026-09-01'},
 {q:'Claude Fable 5.1 与 Mythos 5.1 是目前用于编码与知识工作的最先进模型。', a:'Anthropic', r:'发布公告（厂商自述）', d:'2026-09-01'},
 {q:'任何超过 272K 输入 token 的请求，都会按更高的档位对整个请求重新计价。', a:'OpenAI', r:'GPT-6 Astra 定价说明', d:'2026-09-03', key:true},
 {q:'GPT-6 Astra 的定价是 GPT-5.6 Sol 促销价的 2.5 倍，并且在两个头条数字上都与 Anthropic 的 Fable 5.1 完全一致。', a:'财经媒体分析', r:'GPT-6 Astra 定价解读', d:'2026-09-03'},
 {q:'非高峰时段的价格是高峰时段的一半。高峰时段为周一至周五 UTC 01:00–04:00 与 06:00–10:00，不含中国法定节假日。', a:'DeepSeek', r:'API 定价文档', d:'2026-09'},
 {q:'上一代的 V4 Flash 与 V4 Flash Vision Exp 已经退役；为兼容考虑，旧的模型名暂时路由到 V4.1 Flash。', a:'DeepSeek', r:'V4.1 Flash 发布说明', d:'2026-09-10'},
 {q:'Muse Spark 1.3 是一次显著提升编码与 Agent 任务表现的更新，发布时间距 1.2 只有大约四周。', a:'Meta AI Research', r:'Muse Spark 1.3 发布说明', d:'2026-09-02'},
 {q:'Gemini 3.8 Flash 与 3.7 Flash 价格完全相同，而在我们公布的每一项基准上都更好。', a:'Google', r:'Gemini 3.8 Flash 发布说明（厂商自述）', d:'2026-09-02'},
 {q:'GPT-6 Astra 约占我们追踪到的企业 AI 支出的 13%，Anthropic 的 Claude Fable 约为 8%。', a:'Ramp', r:'企业报销数据 · 经媒体报道', d:'2026-09'},
 {q:'GLM-5.3-Flash 是 GLM-5 系列里第一个原生多模态模型，3200 亿总参数、180 亿激活参数。', a:'Z.ai 智谱', r:'GLM-5.3-Flash 发布说明', d:'2026-08-26'},
 {q:'两家中国实验室在同一个时间窗里，各自独立地收敛到了几乎相同的模型架构。', a:'MarkTechPost', r:'GLM-5.3-Flash 与 Qwen3.8-Flash-Next 对比', d:'2026-08-28'},
 {q:'Anthropic 已于 6 月秘密递交 S-1，目标 10 月在纳斯达克上市，估值 2 万亿美元，拟募资超过 600 亿美元。', a:'彭博 / 财富', r:'经媒体转述', d:'2026-09'},
 {q:'所有评测均由 Artificial Analysis 独立完成。', a:'Artificial Analysis', r:'智能指数方法论', d:'2026-09'},
 {q:'我们跑完全部 66 道 Terminal-Bench 4.0 题目，报告每题重复三次后取平均的 pass@1。', a:'Artificial Analysis', r:'Terminal-Bench 4.0 评测方法', d:'2026-09'}
];

/* ==========================================================
   口径冲突与待核实清单
   ========================================================== */
const CONFLICTS = [
 {model:'—', field:'智能指数版本', a:'本版：AAII v4.3，10 项评测，头部 53', b:'上一版页面：AAII v4.1.1，9 项评测，头部 63.1',
  status:'已定口径', why:'v4.3 重新标定过，两套分数不是同一把尺。本页只用 v4.3，且不做任何跨版本的涨跌或趋势。'},
 {model:'—', field:'Terminal-Bench 版本', a:'本版：TB 4.0（66 题）与 TB 2.1 并列展示，分开算', b:'上一版页面：TB 3.0 与 TB 2.1 混在同一个条形图里',
  status:'已修复', why:'TB 3.0 已被 4.0 取代。TB 2.1 头部 88–91%（饱和），TB 4.0 头部 59%，两者永不互比。'},
 {model:'—', field:'编码 Agent 指数版本', a:'本版：CAI v1.5（DeepSWE v1.1 + TB 4.0 + SWE-Atlas-QnA）', b:'上一版页面：CAI v1.4',
  status:'已定口径', why:'组成的三项基准已全部更换，与 v1.4 及更早的分数不可比。'},
 {model:'—', field:'SWE-bench 数据完整性', a:'vals.ai 已于 2026-09-01 归档该基准', b:'9 月后发布的模型没有也不会有分数',
  status:'已定口径', why:'GPT-6 Astra / Claude Fable 5.1 / Muse Spark 1.3 / DeepSeek V4.1 Flash / Step 5 的 SWE 列为空白，是基准停更，不是数据缺失。'},
 {model:'glm53', field:'参数规模', a:'753B（发布口径）', b:'744B / 40B 激活（基座口径）',
  status:'待核实', why:'两个数字来自不同表述，本页总参数按 753B 记录并注明分歧。上下文窗口已由 AA 确认为 1M。'},
 {model:'ds-v41flash', field:'价格口径', a:'AA 记录 $0.30 / $1.20（高峰价）', b:'DeepSeek 官方文档 $0.15 / $0.60（低谷价）',
  status:'已定口径', why:'两者都对，差别在时段。本页主表用高峰价（与 AA 其它模型口径一致），低谷价写在计价方式与备注里。'},
 {model:'ds-v4pro', field:'缓存命中价', a:'本版 $0.044（高峰）/ $0.022（低谷）', b:'上一版页面 $0.0036',
  status:'已修复', why:'上一版的数值与官方文档对不上，本次按 DeepSeek 官方定价页更正。'},
 {model:'qwen38max', field:'SWE-bench 版本对应', a:'85.6% 为 0902 之前的 Qwen3.8 Max', b:'0902 版未进入 SWE-bench（基准已归档）',
  status:'待核实', why:'该分数不完全对应当前在售的 0902 版本，已在行内注明。'},
 {model:'claude-fable5', field:'Arena 与继任者倒挂', a:'claude-fable-5-high 1506±5，Arena #1', b:'claude-fable-5.1-max 1498±8，#5',
  status:'低风险', why:'差值落在置信区间内，且两者是不同档位（high vs max）。不构成「新版更差」的结论。'},
 {model:'muse12', field:'Arena 与继任者倒挂', a:'muse-spark-1.2 (xHigh) 1500±11，#4', b:'muse-spark-1.3-max 1493±9，#8',
  status:'低风险', why:'同上，差值在置信区间内，档位也不同。'},
 {model:'gpt6-astra', field:'Arena 置信区间', a:'1480±12，#24，票数仅 2,693', b:'—',
  status:'待观察', why:'票数太少，区间宽达 ±12，名次参考价值有限，等票数积累后会变。'},
 {model:'glm52', field:'上下文窗口', a:'本期资料未给出', b:'上一版页面此处误填「开源」',
  status:'数据缺失', why:'GLM-5.2 已被 5.3 取代且退出 AA 现役榜单，显示为「暂无数据」，不参与排序。'},
 {model:'—', field:'订阅价格', a:'Gemini AI Ultra $249.99 / 月', b:'上一版页面记录为 $99.99 / $199.99',
  status:'待核实', why:'本条来自媒体汇总，未逐家核对官网。Grok 新增的 SuperGrok Plus $100 档同样待官方确认。'},
 {model:'—', field:'「每日自动更新」', a:'页面标注数据抓取日与生成日', b:'实际靠人工 / AI 重新采集',
  status:'已修复', why:'没有自动抓取管线。按钮名为「复制更新指令」，即其实际动作。'}
];
