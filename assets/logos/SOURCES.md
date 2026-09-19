# 品牌标识素材来源记录

获取日期：**2026-09-19**（含同日补充的 StepFun / Devin / Antigravity）　·　全部为本地文件，页面不热链任何远程图片。

## 一、命名约定

| 类别 | 文件 | 用在哪 |
| --- | --- | --- |
| **公司标识** | `anthropic / openai / google / xai / meta / moonshot / alibaba / deepseek / zai / minimax / xiaomi / tencent / mistral / nvidia / motif / stepfun` | 厂商档案、厂商筛选器、来源归属 |
| **模型/产品品牌标识** | `claude / gemini / qwen / kimi / grok / hunyuan` | 模型库行、对比表头、模型详情 |
| **Agent 框架标识** | `devin / antigravity` | 模型 × Agent 框架矩阵 |
| **生态/来源品牌** | `huggingface / openrouter` | 来源与引用列表 |

模型没有独立品牌标识时（如 DeepSeek、MiniMax、Mistral、Nemotron、MiMo、Muse Spark、GLM），
一律回落到所属**公司标识**，全站共用 `BRANDS` 单一映射表（`src/js/data.js`）。

## 二、逐个来源

| 文件 | 品牌 | 来源 | 原始链接 | 处理 |
| --- | --- | --- | --- | --- |
| anthropic.svg | Anthropic（公司） | Lobe Icons `anthropic.svg` | https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.95.0/icons/anthropic.svg | 官方单色标识 → 深色背景反白 `#EDEAE3` |
| claude.svg | Claude（模型家族） | Lobe Icons `claude-color.svg` | …/icons/claude-color.svg | 原样，官方橙 `#D97757` |
| openai.svg | OpenAI（公司/GPT 家族） | Lobe Icons `openai.svg` | …/icons/openai.svg | 单色 → 反白 |
| google.svg | Google（公司） | Lobe Icons `google-color.svg` | …/icons/google-color.svg | 原样四色 G |
| gemini.svg | Gemini（模型家族） | Lobe Icons `gemini-color.svg` | …/icons/gemini-color.svg | 原样渐变星芒 |
| xai.svg | xAI（公司） | Lobe Icons `xai.svg` | …/icons/xai.svg | 单色 → 反白（注：Lobe 包内 `<title>` 误写为 Grok，图形为 xAI 的 X 标识） |
| grok.svg | Grok（模型家族） | Lobe Icons `grok.svg` | …/icons/grok.svg | 单色 → 反白 |
| meta.svg | Meta（公司） | Lobe Icons `meta-color.svg` | …/icons/meta-color.svg | 原样蓝色无限符 |
| moonshot.svg | Moonshot AI 月之暗面（公司） | Lobe Icons `moonshot.svg` | …/icons/moonshot.svg | 单色 → 反白 |
| kimi.svg | Kimi（产品品牌） | Lobe Icons `kimi-color.svg` | …/icons/kimi-color.svg | 原样 |
| alibaba.svg | 阿里巴巴（公司） | Lobe Icons `alibaba-color.svg` | …/icons/alibaba-color.svg | 原样橙 `#FF6003` |
| qwen.svg | 通义千问 Qwen（模型家族） | Lobe Icons `qwen-color.svg` | …/icons/qwen-color.svg | 原样紫 |
| deepseek.svg | DeepSeek（公司 + 模型同名） | Lobe Icons `deepseek-color.svg` | …/icons/deepseek-color.svg | 原样蓝鲸 `#4D6BFE` |
| zai.svg | Z.ai / 智谱（公司，GLM 亦用此标识） | Lobe Icons `zai.svg` | …/icons/zai.svg | 单色 → 反白（Z.ai 为现行品牌；旧 `zhipu` 标识未采用） |
| minimax.svg | MiniMax（公司 + 模型同名） | Lobe Icons `minimax-color.svg` | …/icons/minimax-color.svg | 原样 |
| xiaomi.svg | 小米（公司，MiMo 亦用此标识） | Simple Icons `xiaomi` | https://cdn.jsdelivr.net/npm/simple-icons/icons/xiaomi.svg | 源文件无 fill，补官方品牌橙 `#FF6900`（Simple Icons 登记色） |
| tencent.svg | 腾讯（公司） | Lobe Icons `tencent-color.svg` | …/icons/tencent-color.svg | 原样蓝 `#0052D9` |
| hunyuan.svg | 腾讯混元（模型家族） | Lobe Icons `hunyuan-color.svg` | …/icons/hunyuan-color.svg | 原样 |
| mistral.svg | Mistral AI（公司 + 模型同名） | Lobe Icons `mistral-color.svg` | …/icons/mistral-color.svg | 原样 |
| nvidia.svg | NVIDIA（公司，Nemotron 亦用此标识） | Lobe Icons `nvidia-color.svg` | …/icons/nvidia-color.svg | 原样绿 `#74B71B` |
| motif.svg | Motif Technologies（公司） | 官网内嵌 SVG（页眉 logo） | https://motiftech.io/en/ | 取其中**图形符号**部分（去掉 MOTIF 文字），单色 → 反白；比例未改（59.31×36） |
| huggingface.svg | Hugging Face | Lobe Icons `huggingface-color.svg` | …/icons/huggingface-color.svg | 原样 |
| openrouter.svg | OpenRouter | Lobe Icons `openrouter-color.svg` | …/icons/openrouter-color.svg | 原样 |
| stepfun.svg | 阶跃星辰 StepFun（公司） | Lobe Icons `stepfun-color.svg` | …/icons/stepfun-color.svg | 原样（渐变） |
| devin.svg | Devin · Cognition（Agent 框架） | Lobe Icons `devin-color.svg` | …/icons/devin-color.svg | 原样 |
| antigravity.svg | Antigravity（Google 的 Agent 框架） | Lobe Icons `antigravity-color.svg` | …/icons/antigravity-color.svg | 原样 |

统一处理：删除 Lobe 自带的 `height="1em" width="1em"` 与 `style="flex:none"`，
改为 `100%`，尺寸完全交给页面容器控制；**viewBox 与全部路径坐标均未改动**，图形比例保持原状。

## 三、使用说明与限制

- Lobe Icons 图标集以 **MIT** 许可分发（`@lobehub/icons-static-svg`），Simple Icons 以 **CC0-1.0** 分发。
  许可覆盖的是**图标文件的分发**，**商标本身仍归各公司所有**。
- 本看板为个人研究用途的品牌识别展示，未用于商业宣传、背书或暗示合作关系。
- 单色标识改为象牙白（`#EDEAE3`）是这些品牌官方规定的**深色背景用法**（反白单色版），
  不属于改动品牌色；彩色标识一律原样保留，未拉伸、裁切或改色。
- Simple Icons 明确要求：使用其图标时应遵循各品牌自身的使用规范。
- 若某品牌日后发布官方深色背景资源包，应优先替换为官方文件并更新本表。

## 四、缺口记录

目前**无缺口**：`data.js` 中 `BRANDS` 表内每一个 key 都有对应文件（2026-09-19 实测 224 个 `<img>` 全部加载成功，0 个降级为文字）。
新增厂商时：把 SVG 放进本目录 → 在 `src/js/data.js` 的 `BRANDS` 注册 → 在本表补一行来源。
找不到可核实的真实标识时，`BRANDS` 里把 `logo` 留空即可，界面会自动退化为**品牌全名文字**，
不要用首字母头像或近似图形顶替。
