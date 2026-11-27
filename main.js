/*
 * 菠萝英语精听 — Obsidian plugin
 * 英语播客 / Newsletter 精听台：变速精听 · 逐句字幕 · 点词查义 · 生词本 · 跟读对比 · 笔记沉淀
 * 单文件实现（CommonJS），无需构建。
 */
'use strict';

const {
  Plugin,
  ItemView,
  Modal,
  Notice,
  requestUrl,
  PluginSettingTab,
  Setting,
  MarkdownRenderer,
  setIcon,
  Menu,
  Platform,
  apiVersion,
} = require('obsidian');

/* 反馈入口：Issue 模板预填版本/系统信息，讨论区用于提问交流 */
const REPO_URL = 'https://github.com/louiseleeAI/pineapple-english';
const FEEDBACK_ISSUE = REPO_URL + '/issues/new?template=bug_report.md';
const FEEDBACK_DISCUSS = REPO_URL + '/discussions';
function feedbackIssueUrl(version) {
  const ov = (typeof app !== 'undefined' && app && app.version) ? app.version : '未知';
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '未知';
  const body = [
    '**遇到了什么问题 / 想提什么建议**', '', '',
    '**复现步骤（如有）**', '1. ', '2. ', '',
    '**期望结果**', '', '',
    '---',
    '插件版本：' + (version || '未知'),
    'Obsidian 版本：' + ov,
    '系统：' + ua,
  ].join('\n');
  return FEEDBACK_ISSUE + '&title=' + encodeURIComponent('[反馈] ') + '&body=' + encodeURIComponent(body);
}

const VIEW_TYPE = 'pineapple-english-view';
const CACHE_DIR = '.obsidian/plugins/pineapple-english/cache';

/* ------------------------------------------------------------------ */
/* 精选订阅源（已在 2026-10 实测可访问）                                  */
/* ------------------------------------------------------------------ */
const PRESETS = [
  // ---- 英语学习 · 大陆可直连（2026-11 复测：feed 200 + 首条音频能下到 200KB 真声音）----
  { group: '英语学习 · 大陆可直连', title: 'Espresso English', url: 'https://rss.libsyn.com/shows/56803/destinations/212704.xml', kind: 'podcast', note: '每集 5-10 分钟短课，日更，最适合碎片精听' },
  { group: '英语学习 · 大陆可直连', title: 'All Ears English', url: 'https://feeds.megaphone.fm/allearsenglish', kind: 'podcast', note: '美式口语对话，语速自然，讨论地道表达' },
  { group: '英语学习 · 大陆可直连', title: 'Thinking in English', url: 'https://rss.pdrl.fm/699122/feeds.megaphone.fm/ARML8307714981', kind: 'podcast', note: '面向学习者，语速友好、用词可控' },
  { group: '英语学习 · 大陆可直连', title: "Rachel's English", url: 'https://rss.libsyn.com/shows/102397/destinations/543551.xml', kind: 'podcast', note: '发音与连读专项，配合跟读最有效' },

  // 2026-11 新增（都已实测能直连下载音频）
  { group: '英语学习 · 大陆可直连', title: 'Special English (CGTN)', url: 'https://aezfm.meldingcloud.com/rss/program/3', kind: 'podcast', note: '国内 CDN，慢速英语新闻，加载最快；适合每天一篇打底' },
  { group: '英语学习 · 大陆可直连', title: 'The British English Podcast', url: 'https://feeds.megaphone.fm/BEP8760235789', kind: 'podcast', note: '英式发音与表达，语速接近真实对话，适合从美音换口味' },
  { group: '英语学习 · 大陆可直连', title: 'Daily Easy English Expression', url: 'https://rss.libsyn.com/shows/54133/destinations/197908.xml', kind: 'podcast', note: '每集 2-3 分钟只讲一个地道说法，跟读负担最小' },
  { group: '英语学习 · 大陆可直连', title: 'Effortless English (AJ Hoge)', url: 'https://rss.libsyn.com/shows/19583/destinations/17067.xml', kind: 'podcast', note: '慢速重复、同一句反复问，基础弱时最省力' },
  { group: '英语学习 · 大陆可直连', title: 'The InFluency Podcast', url: 'https://rss.libsyn.com/shows/529522/destinations/4554797.xml', kind: 'podcast', note: 'Hadar 讲发音与流利度，跟读素材质量高' },
  { group: '英语学习 · 大陆可直连', title: 'RealLife English', url: 'https://rss.libsyn.com/shows/41632/destinations/126390.xml', kind: 'podcast', note: '真实日常对话，俚语密度高，适合练听力适应' },
  { group: '英语学习 · 大陆可直连', title: 'EnglishClass101', url: 'https://www.englishclass101.com/wp-feed-audio-video.php', kind: 'podcast', note: '分级课程（入门到进阶），每集结构固定，好跟' },
  { group: '英语学习 · 大陆可直连', title: 'Storynory 儿童故事', url: 'https://www.storynory.com/feeds/stories', kind: 'podcast', note: '语速慢、句子短、故事完整，精听起步最舒服' },
  { group: '英语学习 · 大陆可直连', title: "Let's Master English", url: 'https://letsmasterenglish.libsyn.com/rss', kind: 'podcast', note: '面向学习者，中英夹杂讲解，难点会用简单词复述' },
  { group: '英语学习 · 大陆可直连', title: 'English Learning for Curious Minds', url: 'https://feeds.transistor.fm/leonardo-english-english-language-learning-for-curious-minds', kind: 'podcast', note: '用简单英语讲历史与知识，20 分钟一集' },
  { group: '英语学习 · 音频视网络而定', title: 'Easy Stories in English', url: 'https://feeds.megaphone.fm/GLSS2276105381', kind: 'podcast', note: '按难度分级的改编故事，从初级到高级都有；音频经 podtrac 跳转，大陆多数网络连不上，订阅前先试听' },
  { group: '英语学习 · 大陆可直连', title: 'IELTS Energy English 7+', url: 'https://feeds.megaphone.fm/ALLE4310393056', kind: 'podcast', note: '雅思口语思路，语速偏快，适合冲高分' },

  // ---- 短新闻 / 科技 · 大陆可直连 ----
  { group: '短新闻 / 科技 · 大陆可直连', title: 'The Daily (NYT)', url: 'https://feeds.simplecast.com/Sl5CSM3S', kind: 'podcast', note: '20 分钟一集，播音极标准，精听首选' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'Hard Fork (NYT)', url: 'https://feeds.simplecast.com/6HKOhNgS', kind: 'podcast', note: '科技记者对谈，口语化，语速略快' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'Up First (NPR)', url: 'https://feeds.npr.org/510318/podcast.xml', kind: 'podcast', note: '每天 13 分钟三条新闻' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'Planet Money (NPR)', url: 'https://feeds.npr.org/510289/podcast.xml', kind: 'podcast', note: '用故事讲经济学，叙事清晰' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'Latent Space', url: 'https://www.latent.space/feed', kind: 'podcast', note: 'AI 工程深度访谈，音频可直连' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'The a16z Show', url: 'https://feeds.simplecast.com/JGE3yC0V', kind: 'podcast', note: '创投与科技趋势' },

  // 2026-11 新增（都可直连）
  { group: '短新闻 / 科技 · 大陆可直连', title: 'NPR Short Wave', url: 'https://feeds.npr.org/510351/podcast.xml', kind: 'podcast', note: '10 分钟一集讲一个科学问题，短平快' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'NPR Life Kit', url: 'https://feeds.npr.org/510338/podcast.xml', kind: 'podcast', note: '生活实用主题，用词日常，适合练口语素材' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'NPR Fresh Air', url: 'https://feeds.npr.org/381444908/podcast.xml', kind: 'podcast', note: '长访谈，说话人交替，练抓关键信息' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'TED Radio Hour', url: 'https://feeds.npr.org/510298/podcast.xml', kind: 'podcast', note: 'TED 演讲按主题串起来，观点清晰、金句多' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'The Indicator', url: 'https://feeds.npr.org/510325/podcast.xml', kind: 'podcast', note: '10 分钟讲一个经济指标，短、密度高' },
  { group: '短新闻 / 科技 · 大陆可直连', title: 'Changelog', url: 'https://changelog.com/podcast/feed', kind: 'podcast', note: '开发者访谈；RSS 自带 VTT 字幕，可直接逐句精听' },

  // ---- 有逐字稿（音频可能需要代理）----
  { group: '有逐字稿 · 音频视网络而定', title: 'Lex Fridman Podcast', url: 'https://lexfridman.com/feed/podcast/', kind: 'podcast', note: '逐字稿最完整（带时间戳+说话人）；音频托管在 blubrry，大陆多数网络连不上' },
  { group: '有逐字稿 · 音频视网络而定', title: 'Acquired', url: 'https://feeds.transistor.fm/acquired', kind: 'podcast', note: '音频可直连；最近几集 RSS 自带 VTT 字幕' },
  { group: '有逐字稿 · 音频视网络而定', title: 'All-In Podcast', url: 'https://allinchamathjason.libsyn.com/rss', kind: 'podcast', note: '音频可直连；无字幕' },

  // ---- Newsletter · 纯阅读 ----
  { group: 'Newsletter · 纯阅读', title: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', kind: 'article', note: '短篇技术随笔，适合每天一篇' },
  { group: 'Newsletter · 纯阅读', title: 'One Useful Thing', url: 'https://www.oneusefulthing.org/feed', kind: 'article', note: 'Ethan Mollick，AI 与实践' },
  { group: 'Newsletter · 纯阅读', title: 'Stratechery', url: 'https://stratechery.com/feed/', kind: 'article', note: '科技商业分析，英文表达清晰' },
  { group: "Newsletter · 纯阅读", title: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com/feed', kind: 'article', note: '产品与增长' },
];

// 核心源：首次安装只自动订这四个，其余在「发现订阅」里按需一键订阅
const CORE_TITLES = ['Espresso English', 'All Ears English', 'Daily Easy English Expression', 'Special English (CGTN)'];

const PROTOCOL = 'pineapple-english-seek';
const QUOTE_FILE = '英语精听引用.md';
const QUOTE_TAG = 'english/quote';
const QUOTE_TITLE = '英语精听引用';
const QUOTE_NOTICE = '已引用到「英语精听引用.md」（点时间戳可跳回原句）';

const DEFAULT_SETTINGS = {
  noteFolder: 'English',
  vocabFile: 'English/生词本.md',
  dailySection: '## 英语精听',
  defaultRate: 1,
  autoScroll: true,
  exportTranscript: false,
  lookupOnClick: true,
  maxItemsPerFeed: 40,
  installedPresets: false,
  onboarded: false,
  whisperDir: '',
  whisperPython: '',
  whisperModelDir: '',
  whisperThreads: 8,
  recLooseness: 2,
  recFolder: 'English/录音',
  statsFolder: 'English/学习记录',
  recRawMic: true,
  loopSentence: false,
  autoAdvance: false,
  shadowGate: false,
  segSearch: true,
  focusCurrent: true,
};

/* ------------------------------------------------------------------ */
/* 工具函数                                                             */
/* ------------------------------------------------------------------ */
/** 引用句 -> Markdown 行，时间戳是可点回跳的 obsidian:// 链接 */
function quoteLineFor(seg, it, feed, protocol) {
  const t = Math.max(0, Math.round(Number((seg && seg.start) || 0)));
  const stamp = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  const id = (it && it.id) || '';
  const link = 'obsidian://' + protocol + '?id=' + encodeURIComponent(id) + '&t=' + t;
  const text = String((seg && seg.text) || '').replace(/\s+/g, ' ').trim();
  const src = (feed && feed.title) || (it && it.title) || '';
  return '- [' + stamp + '](' + link + ') ' + text + (src ? ' — ' + src : '') + '\n';
}

/** 跟读门控：开关关着，或分数达到 ok 档（70）才前进 */
function shadowAdvance(score, gate) {
  return !gate || Number(score) >= 70;
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function parseTimeStr(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(':').map((x) => parseFloat(x));
  if (parts.some((x) => isNaN(x))) return 0;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return sec;
}

/** 把一段文本切成句子（尽量不切错缩写） */
function splitSentences(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const out = [];
  const re = /[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g;
  let m;
  while ((m = re.exec(clean))) {
    const s = m[0].trim();
    if (s) out.push(s);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  // 只在缩写词被误切时合并（Dr. / Mr. / e.g. 等）
  const merged = [];
  const ABBR = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|No|Fig|Inc|Ltd|Co)\.$/i;
  for (const s of out) {
    const prev = merged[merged.length - 1];
    if (prev && ABBR.test(prev)) merged[merged.length - 1] = prev + ' ' + s;
    else merged.push(s);
  }
  return merged;
}

/** 找出首尾静音边界（返回到采样点），pad 为两侧留白秒数 */
/* ------------------------------------------------------------------ */
/* 复习调度与学习统计                                                   */
/* ------------------------------------------------------------------ */
/** 复习间隔（天），索引 = 熟度等级。熟度越高，下次复习越晚 */
const SRS_INTERVALS = [1, 2, 4, 7, 15, 30];
const SRS_MAX_LEVEL = SRS_INTERVALS.length - 1;
const DAY_MS = 86400000;

/** 本地时区的 YYYY-MM-DD（不能用 toISOString，那是 UTC，跨时区会差一天） */
function dayKey(ts) {
  const d = new Date(ts == null ? Date.now() : ts);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* ------------------------------------------------------------------ */
/* 跟读评分：识别结果与原文做词级对齐                                     */
/* ------------------------------------------------------------------ */
/**
 * 归一化成可比较的 token。
 * 英文按词（去标点、去撇号）；中文按字（粤语用）。
 */
function shadowTokens(text, lang) {
  const s = String(text == null ? '' : text);
  if (lang === 'zh') {
    return s.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '').split('').filter(Boolean);
  }
  return s.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** 最长公共子序列，返回匹配到的下标对（顺序对齐，不会交叉） */
function lcsPairs(a, b, eq) {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return [];
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = eq(a[i - 1], b[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const pairs = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (eq(a[i - 1], b[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      pairs.push([i - 1, j - 1]);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i -= 1;
    else j -= 1;
  }
  pairs.reverse();
  return pairs;
}

/**
 * 跟读打分。
 * 覆盖率 = 命中词 / 原文词；多念的词每个扣半分；结果夹在 0–100。
 * eq 可传入自定义相等（粤语用「同音即算对」）。
 */
function scoreShadow(refText, hypText, opts) {
  const o = opts || {};
  const lang = o.lang || 'en';
  const eq = o.eq || ((x, y) => x === y);
  const ref = shadowTokens(refText, lang);
  const hyp = shadowTokens(hypText, lang);
  const out = {
    lang,
    score: 0,
    matched: 0,
    total: ref.length,
    missing: [],
    extra: [],
    refTokens: ref,
    heard: String(hypText || '').trim(),
  };
  if (!ref.length) return out;
  if (!hyp.length) return Object.assign(out, { score: 0, missing: ref.slice() });

  const pairs = lcsPairs(ref, hyp, eq);
  const hitRef = new Set(pairs.map((p) => p[0]));
  const hitHyp = new Set(pairs.map((p) => p[1]));
  out.matched = pairs.length;
  out.missing = ref.filter((_, i) => !hitRef.has(i));
  out.extra = hyp.filter((_, i) => !hitHyp.has(i));
  const raw = 100 * (pairs.length - 0.5 * out.extra.length) / ref.length;
  out.score = Math.max(0, Math.min(100, Math.round(raw)));
  out.level = out.score >= 90 ? 'great' : out.score >= 70 ? 'ok' : 'again';
  return out;
}

/** 错题本：一句一条，key 用 itemId#idx 保证跨集唯一 */
function mistakeKey(itemId, idx) {
  return String(itemId || '') + '#' + String(idx == null ? -1 : idx);
}

/** 近 N 天的每日序列，缺的天补 0（打卡柱状图 / 热力图都用它） */
function statSeries(data, now = Date.now(), days = 30) {
  const stats = (data && data.stats) || {};
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * DAY_MS;
    const k = dayKey(ts);
    const r = stats[k] || {};
    out.push({ key: k, ts, sec: r.sec || 0, items: r.items || 0 });
  }
  return out;
}

/** 本月汇总：总分钟、总篇数、学过的天数 */
function monthStat(data, now = Date.now()) {
  const month = dayKey(now).slice(0, 7);
  const stats = (data && data.stats) || {};
  let sec = 0;
  let items = 0;
  let days = 0;
  for (const k of Object.keys(stats)) {
    if (k.slice(0, 7) !== month) continue;
    const r = stats[k] || {};
    if ((r.sec || 0) > 0) days += 1;
    sec += r.sec || 0;
    items += r.items || 0;
  }
  return { month, sec, items, days, minutes: Math.round(sec / 60) };
}

/**
 * 打卡热力图：按周对齐的 7×N 网格（周一在上），最后一列是本周。
 * 今天之后的日子标 future，方便前端画成浅灰空格。
 */
function heatmapWeeks(data, now = Date.now(), weeks = 12) {
  const wd = (new Date(now).getDay() + 6) % 7;          // 周一=0
  const startOfWeek = now - wd * DAY_MS;
  const start = startOfWeek - (weeks - 1) * 7 * DAY_MS;
  const stats = (data && data.stats) || {};
  const cols = [];
  for (let c = 0; c < weeks; c++) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const ts = start + (c * 7 + r) * DAY_MS;
      const k = dayKey(ts);
      const sec = ((stats[k] || {}).sec) || 0;
      col.push({
        key: k,
        ts,
        sec,
        future: ts > now + DAY_MS / 2,
        level: sec <= 0 ? 0 : sec < 300 ? 1 : sec < 900 ? 2 : sec < 1800 ? 3 : 4,
      });
    }
    cols.push(col);
  }
  return cols;
}

/* ------------------------------------------------------------------ */
/* 收听统计：生物钟 / 常听节目 / 小发现                                   */
/* ------------------------------------------------------------------ */

/** 近 N 个小时桶相加（生物钟用），缺的补 0 */
function mergeHours(stats, now = Date.now(), days = 90) {
  const out = new Array(24).fill(0);
  const start = dayKey(now - (days - 1) * DAY_MS);
  for (const k of Object.keys(stats || {})) {
    if (k < start) continue;
    const r = (stats || {})[k] || {};
    if (!Array.isArray(r.hours)) continue;
    for (let h = 0; h < 24; h++) out[h] += r.hours[h] || 0;
  }
  return out;
}

/** 按节目汇总收听秒数，返回前 N 名（节目名从 feeds 里找） */
function topShows(stats, feeds, limit = 5) {
  const map = new Map();
  for (const k of Object.keys(stats || {})) {
    const sh = ((stats || {})[k] || {}).shows;
    if (!sh || typeof sh !== 'object') continue;
    for (const fid of Object.keys(sh)) map.set(fid, (map.get(fid) || 0) + (sh[fid] || 0));
  }
  const list = [];
  for (const [feedId, sec] of map) {
    const f = (feeds || []).find((x) => x.id === feedId);
    list.push({ feedId, title: f ? (f.title || f.url || '未命名节目') : '已取消订阅的源', sec });
  }
  list.sort((a, b) => b.sec - a.sec);
  return list.slice(0, limit);
}

/** 24 小时里最常在哪个时段听，翻译成一句人话 */
function clockLabel(hours) {
  const arr = hours || [];
  const total = arr.reduce((a, b) => a + (b || 0), 0);
  if (!total) return '还没有收听记录，播一集就开始了';
  let best = 0;
  for (let i = 1; i < 24; i++) if ((arr[i] || 0) > (arr[best] || 0)) best = i;
  const seg = best < 5 ? '夜航者' : best < 9 ? '晨读者' : best < 12 ? '上午型' : best < 14 ? '午间型'
    : best < 18 ? '下午型' : best < 22 ? '晚读型' : '夜航者';
  return '最常在 ' + best + ':00–' + ((best + 1) % 24) + ':00 听，你是' + seg;
}

/** 把分钟换算成几集节目 / 几趟京沪高铁 */
function rideText(min) {
  const m = Math.max(0, Math.round(min || 0));
  if (m < 45) return '本月 ' + m + ' 分钟，积少成多';
  if (m < 270) return '本月 ' + m + ' 分钟 ≈ ' + Math.round(m / 45) + ' 集 45 分钟的节目';
  const trips = (m / 270).toFixed(1).replace(/\.0$/, '');
  return '本月 ' + m + ' 分钟 ≈ 坐 ' + trips + ' 趟京沪高铁的时间';
}

/** 环形图单格路径（角度用弧度） */
function ringSlice(cx, cy, r0, r1, a0, a1) {
  const n = (v) => Math.round(v * 100) / 100;
  const px = (r, a) => n(cx + r * Math.cos(a));
  const py = (r, a) => n(cy + r * Math.sin(a));
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return 'M' + px(r1, a0) + ' ' + py(r1, a0) +
    'A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + px(r1, a1) + ' ' + py(r1, a1) +
    'L' + px(r0, a1) + ' ' + py(r0, a1) +
    'A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + px(r0, a0) + ' ' + py(r0, a0) + 'Z';
}

/** 小发现：把数字变成几句有人味的话 */
function listenDiscoveries(stats, now = Date.now(), opts = {}) {
  const o = opts || {};
  const out = [];
  let bestK = '';
  let bestSec = 0;
  for (const k of Object.keys(stats || {})) {
    const sec = ((stats || {})[k] || {}).sec || 0;
    if (sec > bestSec) { bestSec = sec; bestK = k; }
  }
  if (bestK && bestSec >= 60) {
    const d = new Date(bestK + 'T00:00:00');
    out.push({ k: '听得最久的一天', v: (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日，' + Math.round(bestSec / 60) + ' 分钟' });
  }
  let nightTitle = '';
  let nightSec = 0;
  for (const k of Object.keys(stats || {})) {
    const n = ((stats || {})[k] || {}).night;
    if (!n || typeof n !== 'object') continue;
    for (const t of Object.keys(n)) if ((n[t] || 0) > nightSec) { nightSec = n[t]; nightTitle = t; }
  }
  if (nightTitle && nightSec >= 120) out.push({ k: '凌晨还在听', v: '《' + nightTitle + '》' });
  for (const r of (o.repeats || []).filter((x) => x && x.n >= 2 && x.title).slice(0, 2)) {
    out.push({ k: '听了不止一遍', v: '《' + r.title + '》听了 ' + r.n + ' 次' });
  }
  if ((o.shows || []).length >= 2) {
    const a = o.shows[0];
    const b = o.shows[o.shows.length - 1];
    if (a.sec > b.sec * 1.5 && b.sec >= 60) {
      out.push({ k: '老朋友和新欢', v: a.title + ' 花的时间最多，' + b.title + ' 是新开始听的' });
    }
  }
  if (!out.length) out.push({ k: '还差一点', v: '多听几天，这里会自己长出你的收听习惯。' });
  return out;
}

/* ------------------------------------------------------------------ */
/* 盲听测试：抽句、时长、按周理解度                                       */
/* ------------------------------------------------------------------ */
const BLIND_MIN_SEC = 1.2;
const BLIND_MAX_SEC = 12;
const BLIND_MIN_SENTENCES = 8;

/** 一句的时长：有 end 用 end-start，否则按词数估（英文约 0.42 秒/词） */
function segSpan(seg) {
  const s = Number(seg && seg.start) || 0;
  const e = Number(seg && seg.end) || 0;
  if (e > s) return e - s;
  const words = String((seg && seg.text) || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, words * 0.42);
}

/** 抽 count 句：时长合适、互不相邻；池子不够就返回空数组 */
function pickBlindSegs(segs, count, rand) {
  const want = count || 3;
  const rnd = rand || Math.random;
  const pool = [];
  for (let i = 0; i < (segs || []).length; i++) {
    const span = segSpan(segs[i]);
    if (span < BLIND_MIN_SEC || span > BLIND_MAX_SEC) continue;
    pool.push(i);
  }
  if (pool.length < want) return [];
  const picked = [];
  for (let guard = 0; guard < 800 && picked.length < want; guard++) {
    const i = pool[Math.floor(rnd() * pool.length)];
    if (picked.indexOf(i) >= 0) continue;
    if (picked.some((j) => Math.abs(j - i) < 2)) continue;
    picked.push(i);
  }
  if (picked.length < want) return [];
  picked.sort((a, b) => a - b);
  return picked;
}

/** 理解度：听懂 = 1，半懂 = 0.5 */
function blindRatio(row) {
  const n = Number(row && row.n) || 0;
  if (!n) return 0;
  return ((Number(row.g) || 0) + 0.5 * (Number(row.h) || 0)) / n;
}

/** 近 N 周盲听理解度，周一为界 */
function blindWeeks(stats, now, weeks) {
  const nWeeks = weeks || 12;
  const cur = new Date(now == null ? Date.now() : now);
  const wd = (cur.getDay() + 6) % 7;
  const startOfWeek = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - wd).getTime();
  const out = [];
  for (let w = nWeeks - 1; w >= 0; w--) {
    const wStart = startOfWeek - w * 7 * DAY_MS;
    const wEnd = wStart + 7 * DAY_MS;
    let n = 0;
    let g = 0;
    let h = 0;
    let x = 0;
    for (const k of Object.keys(stats || {})) {
      const t = new Date(k + 'T00:00:00').getTime();
      if (!(t >= wStart && t < wEnd)) continue;
      const b = (stats[k] || {}).blind;
      if (!b) continue;
      n += b.n || 0;
      g += b.g || 0;
      h += b.h || 0;
      x += b.x || 0;
    }
    out.push({ key: dayKey(wStart), n, g, h, x, ratio: n ? (g + 0.5 * h) / n : 0 });
  }
  return out;
}

/** 24 小时环形图（SVG），中心写近 90 天总时长 */
function renderClockRing(box, hours) {
  box.createDiv({ cls: 'er-st-sec-title', text: '收听生物钟 · 近 90 天' });
  const total = hours.reduce((a, b) => a + (b || 0), 0);
  if (!total) {
    box.createDiv({ cls: 'er-st-empty', text: '还没有收听记录，播一集这里就会长出你的作息。' });
    return;
  }
  const wrap = box.createDiv('er-st-ring-wrap');
  const ring = wrap.createDiv('er-st-ring');
  const NS = 'http://www.w3.org/2000/svg';
  const doc = ring.ownerDocument || document;
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('role', 'img');
  const max = Math.max.apply(null, hours);
  for (let h = 0; h < 24; h++) {
    const a0 = (h / 24) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((h + 1) / 24) * Math.PI * 2 - Math.PI / 2 - 0.012;
    const path = doc.createElementNS(NS, 'path');
    path.setAttribute('d', ringSlice(100, 100, 62, 88, a0, a1));
    const t = max ? (hours[h] || 0) / max : 0;
    path.setAttribute('fill', 'var(--interactive-accent)');
    path.setAttribute('opacity', String(hours[h] ? (0.18 + 0.82 * t).toFixed(2) : '0.08'));
    const tip = doc.createElementNS(NS, 'title');
    tip.textContent = h + ':00–' + ((h + 1) % 24) + ':00 · ' + Math.round((hours[h] || 0) / 60) + ' 分钟';
    path.appendChild(tip);
    svg.appendChild(path);
  }
  const lbl = doc.createElementNS(NS, 'text');
  lbl.setAttribute('x', '100');
  lbl.setAttribute('y', '100');
  lbl.setAttribute('text-anchor', 'middle');
  lbl.setAttribute('font-size', '15');
  lbl.setAttribute('fill', 'var(--text-normal)');
  lbl.textContent = Math.round(total / 60) + ' 分';
  svg.appendChild(lbl);
  const sub = doc.createElementNS(NS, 'text');
  sub.setAttribute('x', '100');
  sub.setAttribute('y', '118');
  sub.setAttribute('text-anchor', 'middle');
  sub.setAttribute('font-size', '10');
  sub.setAttribute('fill', 'var(--text-muted)');
  sub.textContent = '近 90 天';
  svg.appendChild(sub);
  ring.appendChild(svg);

  const note = wrap.createDiv('er-st-ring-note');
  note.createDiv({ cls: 'er-st-ring-peak', text: clockLabel(hours) });
  const part = (a, b) => hours.slice(a, b).reduce((x, y) => x + (y || 0), 0);
  const morning = part(5, 12);
  const noon = part(12, 18);
  const night = part(18, 24) + part(0, 5);
  const pct = (v) => Math.round(v / total * 100) + '%';
  note.createDiv({ text: '早 5–12 点 ' + pct(morning) + ' · 午 12–18 点 ' + pct(noon) + ' · 晚 18–5 点 ' + pct(night) });
  note.createDiv({ text: '只算真正在播放的时间，拖进度条不算。' });
}

function findSpeechBounds(data, sr, pad = 0.12) {
  if (!data || !data.length) return { start: 0, end: 0 };
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    if (v > peak) peak = v;
  }
  if (peak < 1e-4) return { start: 0, end: data.length };
  const thr = Math.max(peak * 0.02, 0.006);
  let a = 0;
  let b = data.length - 1;
  for (let i = 0; i < data.length; i++) { if (Math.abs(data[i]) > thr) { a = i; break; } }
  for (let i = data.length - 1; i >= 0; i--) { if (Math.abs(data[i]) > thr) { b = i; break; } }
  const padN = Math.round(pad * sr);
  return { start: Math.max(0, a - padN), end: Math.min(data.length, b + padN) };
}

/** Float32 → 16bit PCM WAV 的 ArrayBuffer */
function encodeWav16(samples, sr) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (off, t) => { for (let i = 0; i < t.length; i++) v.setUint8(off + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return buf;
}

function sanitizeFileName(name) {
  return String(name || 'untitled')
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'untitled';
}

/** 清洗外部 HTML：去脚本/表单，绝对化链接，懒加载图片 */
function sanitizeHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta,noscript,svg').forEach((e) => e.remove());
  doc.querySelectorAll('*').forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const n = attr.name.toLowerCase();
      const v = attr.value || '';
      if (n.startsWith('on') || n === 'srcdoc') {
        node.removeAttribute(attr.name);
        continue;
      }
      if ((n === 'href' || n === 'src') && /^\s*(javascript|vbscript):/i.test(v)) {
        node.removeAttribute(attr.name);
        continue;
      }
      if ((n === 'href' || n === 'src') && v && !/^(https?:|data:|mailto:|#|\/\/)/i.test(v)) {
        try {
          node.setAttribute(attr.name, new URL(v, baseUrl || 'https://example.com').href);
        } catch (e) { /* ignore */ }
      }
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.removeAttribute('srcset');
      node.removeAttribute('sizes');
    }
  });
  return doc.body ? doc.body.innerHTML : '';
}

/* ------------------------------------------------------------------ */
/* RSS / Atom 解析                                                      */
/* ------------------------------------------------------------------ */
function localName(el) {
  return (el.localName || el.nodeName || '').toLowerCase();
}

function childByLocal(el, names) {
  if (!el) return null;
  const set = new Set(names.map((n) => n.toLowerCase()));
  for (const c of Array.from(el.children || [])) {
    if (set.has(localName(c))) return c;
  }
  return null;
}

function allByLocal(root, names) {
  const set = new Set(names.map((n) => n.toLowerCase()));
  const out = [];
  const walk = (el) => {
    for (const c of Array.from(el.children || [])) {
      if (set.has(localName(c))) out.push(c);
      walk(c);
    }
  };
  walk(root);
  return out;
}

function textOf(el) {
  return el ? String(el.textContent || '').trim() : '';
}

function attrOf(el, name) {
  return el ? String(el.getAttribute(name) || '') : '';
}

/** 播客列表里去掉「只有视频没有音频」的条目（课程类 feed 常混广告视频） */
function dropVideoOnly(items) {
  const out = (items || []).filter((i) => !i.videoOnly);
  for (const i of out) { if ('videoOnly' in i) delete i.videoOnly; }
  return out;
}
/** RSS 抓取/解析失败的友好提示：把底层异常翻译成用户能懂、且知道下一步怎么做的话 */
function friendlyFeedError(e, url) {
  const raw = String((e && e.message) || e || '');
  if (/解析失败|不是合法 XML|parsererror|not well-formed/i.test(raw)) {
    return '这个地址返回的不是有效订阅内容（可能链接失效、需要登录或需要代理）。建议到「发现订阅」换一个标注「大陆可直连」的源，或稍后重试。';
  }
  if (/timeout|超时|ETIMEDOUT|ECONN|ENOTFOUND|network|fetch failed|Failed to fetch|getaddrinfo/i.test(raw)) {
    return '网络连不上这个源（大陆访问可能受限）。换一个标注「大陆可直连」的源，或稍后重试即可。';
  }
  if (/40[134]|50[023]|status|unauthorized|forbidden/i.test(raw)) {
    return '源站拒绝了访问（链接失效或限制访问）。建议换一个源。';
  }
  return '暂时读不到这个源，可能是网络或源站问题。可稍后重试，或到「发现订阅」换一个。';
}

function parseFeedXml(xml, feedUrl) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('RSS 解析失败（不是合法 XML）');

  const root = doc.documentElement;
  const isAtom = localName(root) === 'feed';
  const channel = childByLocal(root, ['channel']) || root;

  const feedTitle =
    textOf(childByLocal(channel, ['title'])) ||
    textOf(childByLocal(root, ['title'])) ||
    feedUrl;
  const feedLink =
    attrOf(allByLocal(channel, ['link']).find((l) => !attrOf(l, 'rel') || attrOf(l, 'rel') === 'alternate'), 'href') ||
    textOf(childByLocal(channel, ['link'])) ||
    feedUrl;
  const feedImage =
    attrOf(allByLocal(channel, ['image']).find((i) => attrOf(i, 'href')), 'href') ||
    textOf(allByLocal(channel, ['url']).find((u) => /^https?:/.test(textOf(u)))) ||
    '';

  const entries = isAtom ? Array.from(root.children).filter((c) => localName(c) === 'entry') : allByLocal(root, ['item']);
  const base = feedLink || feedUrl;

  const items = entries.map((it) => {
    const linkEl = allByLocal(it, ['link']).find((l) => {
      const rel = attrOf(l, 'rel');
      return !rel || rel === 'alternate';
    });
    let link = attrOf(linkEl, 'href') || textOf(childByLocal(it, ['link'])) || '';
    if (!link) {
      const guidEl = childByLocal(it, ['guid', 'id']);
      const g = textOf(guidEl);
      if (/^https?:/.test(g)) link = g;
    }

    const rawContent =
      textOf(childByLocal(it, ['encoded'])) ||
      textOf(childByLocal(it, ['content'])) ||
      textOf(childByLocal(it, ['description'])) ||
      textOf(childByLocal(it, ['summary'])) ||
      '';

    const enclosures = allByLocal(it, ['enclosure', 'content']).filter((e) => {
      const u = attrOf(e, 'url');
      const t = attrOf(e, 'type');
      return u && (/^audio\//i.test(t) || /\.(mp3|m4a|aac|ogg|opus|wav)(\?|$)/i.test(u) || localName(e) === 'content');
    });
    let audio = '';
    let audioType = '';
    for (const e of enclosures) {
      const u = attrOf(e, 'url');
      const t = attrOf(e, 'type') || '';
      if (u && (/^audio\//i.test(t) || /\.(mp3|m4a|aac|ogg|opus|wav)(\?|$)/i.test(u))) {
        audio = u;
        audioType = t;
        break;
      }
    }

    const durationRaw = textOf(childByLocal(it, ['duration']));
    const transcripts = allByLocal(it, ['transcript'])
      .filter((t) => attrOf(t, 'url'))
      .map((t) => ({ url: attrOf(t, 'url'), type: attrOf(t, 'type') || '', language: attrOf(t, 'language') || '' }));

    const imgEl = allByLocal(it, ['image']).find((i) => attrOf(i, 'href'));
    let image = imgEl ? attrOf(imgEl, 'href') : '';
    if (!image) {
      const m = /<img[^>]+src=["']([^"']+)["']/i.exec(rawContent);
      if (m) image = m[1];
    }

    const dateRaw =
      textOf(childByLocal(it, ['pubdate', 'published', 'updated', 'date'])) ||
      textOf(childByLocal(it, ['created']));
    const ts = dateRaw ? Date.parse(dateRaw) : NaN;

    // 播客源里常混视频广告：只有视频没有音频的条目，标记出来后面丢掉
    const allEncl = allByLocal(it, ['enclosure', 'content']);
    const videoOnly = !audio && allEncl.some((e) => /^video\//i.test(attrOf(e, 'type')));
    const guid = textOf(childByLocal(it, ['guid', 'id'])) || link;
    const title = textOf(childByLocal(it, ['title'])) || '(无标题)';

    return {
      id: hash(feedUrl + '|' + (guid || title)),
      title: stripTags(title) || '(无标题)',
      link,
      date: isNaN(ts) ? 0 : ts,
      content: rawContent,
      summary: stripTags(rawContent).slice(0, 200),
      audio,
      audioType,
      duration: parseTimeStr(durationRaw),
      transcripts,
      image: image || '',
      baseUrl: link || base,
      videoOnly,
    };
  });

  return { title: stripTags(feedTitle), link: feedLink, image: feedImage, items };
}

/* ------------------------------------------------------------------ */
/* 字幕解析                                                             */
/* ------------------------------------------------------------------ */
function parseVttOrSrt(text) {
  const src = String(text || '').replace(/\r/g, '');
  const blocks = src.split(/\n{2,}/);
  const segs = [];
  const timeRe = /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})/;
  const toSec = (s) => {
    const parts = s.replace(',', '.').split(':').map(Number);
    let sec = 0;
    for (const p of parts) sec = sec * 60 + p;
    return sec;
  };
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    const idx = lines.findIndex((l) => timeRe.test(l));
    if (idx < 0) continue;
    const m = timeRe.exec(lines[idx]);
    const body = lines.slice(idx + 1).join(' ')
      .replace(/<v\s+([^>]+)>/gi, ' $1: ')   // VTT 说话人 <v Ben>
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!body) continue;
    segs.push({ start: toSec(m[1]), end: toSec(m[2]), text: body });
  }
  return segs;
}

function parseJsonTranscript(raw) {
  let data;
  try { data = JSON.parse(raw); } catch (e) { return []; }
  const arr = Array.isArray(data) ? data : (data.segments || data.results || data.items || []);
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => {
    const text = String(s.text || s.body || s.content || '').trim();
    if (!text) return null;
    const start = Number(s.start ?? s.startTime ?? s.time ?? s.offset ?? 0) || 0;
    const end = Number(s.end ?? s.endTime ?? 0) || 0;
    return { start, end, text };
  }).filter(Boolean);
}

/** 从 HTML 页面里抽取逐字稿：① 独立时间戳节点 ② 段落首时间戳 ③ 大块容器按句切分 */
function extractTranscriptFromHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,nav,header,footer,aside,form,iframe,noscript').forEach((e) => e.remove());

  const timeRe = /^\s*[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*[-–—:]?\s*/;
  const soloTimeRe = /^[\[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?$/;
  // 目录（toc）/ 导航里的时间戳不是正文
  const inToc = (el) => {
    try {
      return !!el.closest('[id*="toc" i], [class*="toc" i], nav, aside, .toc_list, [role="navigation"]');
    } catch (e) { return false; }
  };

  // ① 独立时间戳节点（如 <div class="ts-segment"><a>0:00</a><span class="ts-text">…</span></div>）
  const segsA = [];
  const seenStart = new Set();
  const nodes = Array.from(doc.querySelectorAll('time, a, span, div, p, li, td'));
  for (const el of nodes) {
    if (el.children.length) continue;
    if (inToc(el)) continue;
    const t = (el.textContent || '').trim();
    const m = soloTimeRe.exec(t);
    if (!m) continue;
    const start = parseTimeStr(m[1]);
    // 时间戳常常包在 <a>/<span> 里，向上找到真正装正文的容器
    let box = el.parentElement;
    for (let i = 0; i < 4 && box && (box.textContent || '').trim().length < 40; i++) box = box.parentElement;
    if (!box) continue;
    const rawText = (box.textContent || '').replace(/\s+/g, ' ').trim();
    if (rawText.length < 12 || rawText.length > 5000) continue;
    // 去掉时间戳本身
    let text = rawText.split(t).join(' ').replace(/\s+/g, ' ').trim();
    text = text.replace(/^[\s\-–—:·|]+/, '').trim();
    if (text.length < 8) continue;
    // 补上说话人
    const nameEl = box.querySelector('.ts-name, [class*="speaker" i], [class*="author-name" i]');
    if (nameEl) {
      const name = (nameEl.textContent || '').trim();
      if (name && text.startsWith(name)) text = name + ': ' + text.slice(name.length).trim();
    }
    const key = start + '|' + text.slice(0, 30);
    if (seenStart.has(key)) continue;
    seenStart.add(key);
    segsA.push({ start, text });
  }
  if (segsA.length >= 8 && segsA.reduce((n, s) => n + s.text.length, 0) > 1200) {
    segsA.sort((a, b) => a.start - b.start);
    const uniq = [];
    for (const s of segsA) {
      const last = uniq[uniq.length - 1];
      if (last && Math.abs(last.start - s.start) < 1) {
        if (s.text.length > last.text.length) uniq[uniq.length - 1] = s;
        continue;
      }
      uniq.push(s);
    }
    const segs = uniq.map((s, i) => ({ start: s.start, end: i + 1 < uniq.length ? uniq[i + 1].start : 0, text: s.text }));
    return { segments: segs, timed: true, kind: 'page-timed' };
  }

  // ② 段落开头带时间戳
  const blockSel = 'p, li, blockquote, div';
  const leafBlocks = Array.from(doc.querySelectorAll(blockSel)).filter((el) => !el.querySelector('p, li, blockquote'));
  const timed = [];
  for (const el of leafBlocks) {
    if (inToc(el)) continue;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t.length < 14 || t.length > 4000) continue;
    const m = timeRe.exec(t);
    if (!m) continue;
    const rest = t.slice(m[0].length).trim();
    if (rest.length > 20) timed.push({ start: parseTimeStr(m[1]), text: rest });
  }
  if (timed.length >= 8) {
    const avg = timed.reduce((n, x) => n + x.text.length, 0) / timed.length;
    // 平均每段太短，多半是章节列表 / 目录，不是真字幕
    if (avg < 40) return null;
    timed.sort((a, b) => a.start - b.start);
    const segs = timed.map((cur, i) => ({ start: cur.start, end: i + 1 < timed.length ? timed[i + 1].start : 0, text: cur.text }));
    return { segments: segs, timed: true, kind: 'page-timed' };
  }

  // 2) 找 class/id 含 transcript 的容器
  const containers = Array.from(doc.querySelectorAll('[class*="transcript" i], [id*="transcript" i], [class*="script" i]'));
  let best = null;
  let bestLen = 0;
  for (const c of containers) {
    const len = (c.textContent || '').length;
    if (len > bestLen && len > 1500) { best = c; bestLen = len; }
  }

  // 只认「明确标了 transcript 的容器」。以前这里还会兜底抓"页面最大文本块"，
  // 结果把 newsletter 正文、节目简介当成播客字幕，时间轴一估算就全错 —— 宁缺勿错。
  if (!best || bestLen < 1200) return null;

  const paras = Array.from(best.querySelectorAll('p'))
    .map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 2);
  const joined = paras.length ? paras.join('\n\n') : (best.textContent || '');
  const sentences = splitSentences(joined.replace(/\n+/g, ' '));
  if (sentences.length < 5) return null;
  return { segments: sentences.map((t) => ({ start: 0, end: 0, text: t })), timed: false, kind: 'page-plain' };
}

/**
 * 从网页里抽正文（RSS 常常只给摘要）。
 * 只认语义化的正文容器，抽不到就返回空，绝不拿整页凑数。
 */
function extractArticleHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,nav,header,footer,aside,form,iframe,noscript,svg,button,figure figcaption').forEach((e) => e.remove());
  const sels = ['article', 'main', '.entry-content', '.post-content', '.article-content', '#content', '.prose', '.markdown-body'];
  let best = null;
  let bestLen = 0;
  for (const sel of sels) {
    for (const c of Array.from(doc.querySelectorAll(sel))) {
      const len = (c.textContent || '').length;
      if (len > bestLen) { best = c; bestLen = len; }
    }
  }
  if (!best || bestLen < 400) return '';
  best.querySelectorAll('nav, aside, [class*="share" i], [class*="subscribe" i], [class*="newsletter-signup" i]').forEach((e) => e.remove());
  return sanitizeHtml(best.innerHTML, baseUrl);
}

/* ------------------------------------------------------------------ */
/* 词典 / 翻译                                                          */
/* ------------------------------------------------------------------ */
async function lookupEnglish(word) {
  const out = { word, phonetic: '', defs: [], example: '', audio: '', gloss: '' };
  try {
    const res = await requestUrl({ url: `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}` });
    const data = res.json;
    if (Array.isArray(data) && data[0]) {
      const entry = data[0];
      out.phonetic = entry.phonetic || (entry.phonetics || []).map((p) => p.text).filter(Boolean)[0] || '';
      out.audio = (entry.phonetics || []).map((p) => p.audio).filter(Boolean)[0] || '';
      for (const m of entry.meanings || []) {
        for (const d of (m.definitions || []).slice(0, 3)) {
          out.defs.push({ pos: m.partOfSpeech || '', def: d.definition || '', example: d.example || '' });
          if (!out.example && d.example) out.example = d.example;
        }
      }
    }
  } catch (e) { /* 未收录 */ }

  try {
    const res2 = await requestUrl({ url: `https://dict.youdao.com/suggest?num=1&doctype=json&q=${encodeURIComponent(word)}` });
    const j = res2.json;
    const e0 = j && j.data && j.data.entries && j.data.entries[0];
    if (e0 && e0.explain) out.gloss = e0.explain;
  } catch (e) { /* ignore */ }

  return out;
}

async function translateSentence(text) {
  try {
    const q = String(text).slice(0, 480);
    const res = await requestUrl({
      url: `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|zh-CN`,
    });
    const t = res.json && res.json.responseData && res.json.responseData.translatedText;
    return t || '';
  } catch (e) {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* 阅读视图                                                             */
/* ------------------------------------------------------------------ */
class EnglishReaderView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.filter = 'all';
    this.query = '';
    this.feedId = 'all';
    this.itemId = null;
    this.tab = 'auto';
    this.segs = [];
    this.curSeg = -1;
    this.loopIdx = -1;
    this.transcriptInfo = null;
    this._loading = new Set();
    this.estimateOn = false;
    this._tried = new Set();
    this.whisperJob = null;
    this.recState = 'idle';      // idle | recording | ready
    this._recStartAt = 0;
    this._recMaxMs = 8000;
    this._recLenMs = 0;
    this._recTick = null;
    this._escHandler = null;
    this._recUI = null;
    this.shadowResult = null;      // 最近一次跟读评分结果
    this.shadowGrading = false;
    this.shadowError = '';
    this.shadowFor = -1;           // 评分对应的句号，防止切句后结果串台
    this.audioEl = null;
    this.recorder = null;
    this.recBlobUrl = null;
    this.recChunks = [];
    this.lastUserScroll = 0;
    this.saveTimer = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return '菠萝英语精听'; }
  getIcon() { return 'headphones'; }

  getState() {
    return { filter: this.filter, feedId: this.feedId, itemId: this.itemId, tab: this.tab, query: this.query };
  }

  async setState(state, result) {
    if (state) {
      this.filter = state.filter || 'all';
      this.feedId = state.feedId || 'all';
      this.itemId = state.itemId || null;
      this.tab = state.tab || 'auto';
      this.query = state.query || '';
    }
    await super.setState(state, result);
    this.render();
  }

  async onOpen() {
    this.render();
    try {
      this._ro = new ResizeObserver((entries) => {
        const w = entries[0].contentRect.width;
        this.applyWidth(w);
      });
      this._ro.observe(this.containerEl.children[1]);
    } catch (e) { /* 不支持就算了 */ }
  }

  /** 窗口/分栏变窄时自动收窄三栏，避免阅读区被挤成 0 宽 */
  applyWidth(w) {
    const root = this.containerEl.children[1];
    if (!root || !w) return;
    if (typeof root.toggleClass !== 'function') return;
    root.toggleClass('is-narrow', w < 880);
    root.toggleClass('is-tiny', w < 600);
    if (!this._lastW || Math.abs(w - this._lastW) > 20) {
      this._lastW = w;
      this.log(`宽度: ${Math.round(w)}px → narrow=${w < 880} tiny=${w < 600}`);
    }
  }

  async onClose() {
    if (this._ro) { try { this._ro.disconnect(); } catch (e) { /* ignore */ } this._ro = null; }
    this._stopRecTick();
    if (this.recorder && this.recorder.state === 'recording') { try { this.recorder.stop(); } catch (e) { /* ignore */ } }
    this.stopAudio();
  }

  /* ---------------- 数据入口 ---------------- */
  get data() { return this.plugin.data; }

  visibleItems() {
    const { items } = this.data;
    const q = this.query.trim().toLowerCase();
    let list = [];
    if (this.feedId === 'all') {
      for (const f of this.data.feeds) {
        for (const it of items[f.id] || []) list.push({ it, feed: f });
      }
    } else {
      const f = this.data.feeds.find((x) => x.id === this.feedId);
      if (f) list = (items[f.id] || []).map((it) => ({ it, feed: f }));
    }

    if (this.filter === 'unread') list = list.filter(({ it }) => !it.read);
    if (this.filter === 'star') list = list.filter(({ it }) => it.star);
    if (q) {
      list = list.filter(({ it }) =>
        (it.title || '').toLowerCase().includes(q) ||
        (it.summary || '').toLowerCase().includes(q) ||
        (it.content || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => (b.it.date || 0) - (a.it.date || 0));
    return list;
  }

  currentItem() {
    for (const f of this.data.feeds) {
      const it = (this.data.items[f.id] || []).find((x) => x.id === this.itemId);
      if (it) return { it, feed: f };
    }
    return null;
  }

  /* ---------------- 整体渲染 ---------------- */
  render() {
    const root = this.containerEl.children[1];
    if (!root) {
      this.log('致命：containerEl.children[1] 不存在，children=' + this.containerEl.children.length);
      return;
    }
    root.empty();
    root.addClass('er-root');
    this._rootEl = root;
    root.toggleClass('focus-current', this.data.settings.focusCurrent !== false);
    try {
      const side = root.createDiv('er-side');
      this.renderSide(side);

      const list = root.createDiv('er-list');
      this.renderList(list);

      const reader = root.createDiv('er-reader');
      this.readerEl = reader;
      this.renderReader(reader);
    } catch (e) {
      this.log('RENDER ERROR: ' + ((e && e.stack) || e));
      const box = root.createDiv({ cls: 'er-fatal' });
      box.createEl('b', { text: '渲染出错（已写入 diag.log）' });
      box.createEl('pre', { text: String((e && e.message) || e) });
    }
    this.scheduleDiag();
  }

  scheduleDiag() {
    if (this._diagTimer) clearTimeout(this._diagTimer);
    this._diagTimer = setTimeout(() => { this._diagTimer = null; this.dumpDiag(); }, 2500);
  }

  /** 环境自检：样式是否生效、三栏尺寸、音频能否播放，全部写进 cache/diag.log */
  async dumpDiag() {
    try {
      const root = this.containerEl.children[1];
      const q = (s) => root.querySelector(s);
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const cs = (el) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return { display: s.display, flex: s.flexDirection, overflow: s.overflowY, height: s.height };
      };
      const found = this.currentItem();
      const info = {
        appVersion: (typeof apiVersion !== 'undefined' ? apiVersion : '?'),
        leafWidth: box(this.containerEl),
        containerChildren: Array.from(this.containerEl.children).map((c) => c.className || c.tagName),
        rootClass: root.className,
        root: cs(root),
        side: { box: box(q('.er-side')), cs: cs(q('.er-side')) },
        list: { box: box(q('.er-list')), cs: cs(q('.er-list')) },
        reader: { box: box(q('.er-reader')), cs: cs(q('.er-reader')) },
        pane: { box: box(q('.er-pane')), cs: cs(q('.er-pane')) },
        articleTextLen: (q('.er-article') && q('.er-article').textContent || '').length,
        paneChildCount: q('.er-pane') ? q('.er-pane').children.length : -1,
        paneTextHead: q('.er-pane') ? (q('.er-pane').textContent || '').slice(0, 60) : '',
        segCount: this.segs.length,
        segRows: q('.er-segs') ? q('.er-segs').children.length : -1,
        tab: this.tab,
        effectiveTab: this.effectiveTab(),
        loadingIds: Array.from(this._loading),
        hasAudioBar: !!q('.er-audio-bar'),
        itemSelected: this.itemId,
        selectedTitle: found ? found.it.title.slice(0, 40) : '',
        contentLen: found ? (found.it.content || '').length : 0,
        itemAudio: found ? (found.it.audio || '') : '',
        stylesLoaded: !!(q('.er-side') && getComputedStyle(q('.er-side')).display === 'flex'),
      };

      // 音频探测
      if (found && found.it.audio) {
        info.audioProbe = await new Promise((resolve) => {
          const a = new Audio();
          let done = false;
          const fin = (state) => {
            if (done) return;
            done = true;
            resolve({
              state,
              readyState: a.readyState,
              networkState: a.networkState,
              errorCode: a.error ? a.error.code : 0,
              errorMsg: a.error ? String(a.error.message || '') : '',
              duration: isFinite(a.duration) ? Math.round(a.duration) : -1,
            });
            try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* ignore */ }
          };
          a.onloadedmetadata = () => fin('ok');
          a.onerror = () => fin('error');
          a.src = found.it.audio;
          setTimeout(() => fin('timeout-10s'), 10000);
        });
      }

      this.log('DIAG ' + JSON.stringify(info, null, 1));
    } catch (e) {
      this.log('DIAG FAILED: ' + ((e && e.stack) || e));
    }
  }

  renderSide(side) {
    const head = side.createDiv('er-side-head');
    head.createSpan({ cls: 'er-brand', text: '菠萝英语精听' });

    const btn = (icon, title, act) => {
      const b = head.createEl('button', { cls: 'er-icon-btn', attr: { 'aria-label': title, title } });
      setIcon(b, icon);
      b.dataset.act = act;
      b.onclick = () => this.onAction(act);
    };
    btn('refresh-cw', '刷新全部订阅', 'refresh');
    btn('plus', '发现 / 添加订阅', 'discover');
    btn('settings', '设置', 'settings');

    const filters = side.createDiv('er-filters');
    [['all', '全部'], ['unread', '未读'], ['star', '收藏']].forEach(([k, label]) => {
      const b = filters.createEl('button', { cls: 'er-filter' + (this.filter === k ? ' is-active' : ''), text: label });
      b.onclick = () => { this.filter = k; this.render(); };
    });

    const search = side.createEl('input', { cls: 'er-search', attr: { placeholder: '搜索标题 / 正文…', type: 'search' } });
    search.value = this.query;
    search.oninput = () => {
      this.query = search.value;
      clearTimeout(this._qTimer);
      this._qTimer = setTimeout(() => this.renderListOnly(), 200);
    };

    const feedsBox = side.createDiv('er-feeds');
    const allBtn = feedsBox.createDiv('er-feed' + (this.feedId === 'all' ? ' is-active' : ''));
    allBtn.createSpan({ cls: 'er-feed-name', text: '全部订阅' });
    allBtn.createSpan({ cls: 'er-feed-count', text: String(this.data.feeds.reduce((n, f) => n + (this.data.items[f.id] || []).length, 0)) });
    allBtn.onclick = () => { this.feedId = 'all'; this.render(); };

    const buildRow = (f) => {
      const row = feedsBox.createDiv('er-feed' + (this.feedId === f.id ? ' is-active' : ''));
      const dot = row.createSpan({ cls: 'er-dot' });
      if (f.kind === 'podcast') dot.addClass('is-podcast');
      row.createSpan({ cls: 'er-feed-name', text: f.title || f.url });
      const unread = (this.data.items[f.id] || []).filter((i) => !i.read).length;
      row.createSpan({ cls: 'er-feed-count' + (unread ? ' is-unread' : ''), text: unread ? String(unread) : '' });
      row.oncontextmenu = (ev) => {
        ev.preventDefault();
        const menu = new Menu();
        menu.addItem((i) => i.setTitle('只显示该源').setIcon('filter').onClick(() => { this.feedId = f.id; this.render(); }));
        menu.addItem((i) => i.setTitle('重命名').setIcon('pencil').onClick(async () => {
          const name = window.prompt('新名称', f.title);
          if (name) { f.title = name; await this.plugin.save(); this.render(); }
        }));
        menu.addItem((i) => i.setTitle('刷新该源').setIcon('refresh-cw').onClick(() => this.plugin.refreshFeed(f).then(() => this.render())));
        menu.addItem((i) => i.setTitle('取消订阅').setIcon('trash').onClick(async () => {
          if (!window.confirm(`取消订阅「${f.title}」？已收藏的文章会保留。`)) return;
          await this.plugin.removeFeed(f.id);
          if (this.feedId === f.id) this.feedId = 'all';
          this.render();
        }));
        menu.showAtMouseEvent(ev);
      };
      row.onclick = () => { this.feedId = f.id; this.render(); };
    }

    // 按分组展示
    const groups = new Map();
    for (const f of this.data.feeds) {
      const g = f.group || '我的订阅';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(f);
    }
    for (const [g, arr] of groups) {
      feedsBox.createDiv({ cls: 'er-group', text: g });
      for (const f of arr) buildRow(f);
    }

    const foot = side.createDiv('er-side-foot');
    const due = this.plugin.dueVocab().length;
    const vBtn = foot.createEl('button', {
      cls: 'er-link-btn',
      text: `生词本 ${this.data.vocab.length}` + (due ? ` · 待复习 ${due}` : ''),
    });
    vBtn.onclick = () => this.onAction('vocab');
    const dBtn = foot.createEl('button', { cls: 'er-link-btn er-review-btn', text: '复习' });
    dBtn.onclick = () => this.onAction('review');

    const tools = foot.createDiv('er-foot-tools');
    const openCnt = this.plugin.listMistakes({ includeDone: false }).length;
    const mBtn = tools.createEl('button', {
      cls: 'er-link-btn er-mistake-btn',
      text: '错题本' + (openCnt ? ' ' + openCnt : ''),
      attr: { title: '没听懂 / 读错的句子都存在这里' },
    });
    mBtn.onclick = () => this.onAction('mistakes');
    const sBtn = tools.createEl('button', {
      cls: 'er-link-btn er-stat-btn',
      text: '打卡',
      attr: { title: '连续天数、每日时长、学习日历' },
    });
    sBtn.onclick = () => this.onAction('stats');

    const streak = this.plugin.studyStreak();
    const mins = this.plugin.todayMinutes();
    const st = foot.createDiv({ cls: 'er-study-line', attr: { title: '点开看学习统计' } });
    st.setText(streak || mins ? `连续 ${streak} 天 · 今日 ${mins} 分钟` : '今天还没开始');
    st.onclick = () => this.onAction('stats');
  }

  renderListOnly() {
    const listEl = this.containerEl.querySelector('.er-list');
    if (!listEl) return this.render();
    listEl.empty();
    this.renderList(listEl);
    const rEl = this.getReaderEl();
    if (rEl) { rEl.empty(); this.renderReader(rEl); }
  }

  renderList(list) {
    const items = this.visibleItems();
    const head = list.createDiv('er-list-head');
    head.createSpan({ text: `${items.length} 篇` });
    const feedBtn = head.createEl('button', { cls: 'er-icon-btn er-feedswitch', attr: { title: '切换订阅源' } });
    setIcon(feedBtn, 'library');
    feedBtn.onclick = (ev) => {
      const menu = new Menu();
      menu.addItem((i) => i.setTitle('全部订阅').setIcon('layers').onClick(() => { this.feedId = 'all'; this.render(); }));
      for (const f of this.data.feeds) {
        menu.addItem((i) => i.setTitle((f.error ? '⚠ ' : '') + (f.kind === 'podcast' ? '🎧 ' : '📄 ') + (f.title || f.url) + (f.error ? '（连不上）' : '')).onClick(() => { this.feedId = f.id; this.render(); }));
      }
      menu.showAtMouseEvent(ev);
    };
    const refresh = head.createEl('button', { cls: 'er-icon-btn', attr: { title: '刷新' } });
    setIcon(refresh, 'refresh-cw');
    refresh.onclick = () => this.onAction('refresh');

    const box = list.createDiv('er-items');
    if (!items.length) {
      box.createDiv({ cls: 'er-empty', text: '这里是空的。点左上角 ＋ 添加订阅，或点 ⟳ 刷新。' });
      return;
    }
    for (const { it, feed } of items) {
      const row = box.createDiv('er-item' + (it.id === this.itemId ? ' is-active' : '') + (it.read ? '' : ' is-unread'));
      const top = row.createDiv('er-item-top');
      top.createSpan({ cls: 'er-item-feed', text: feed.kind === 'podcast' ? '🎧 ' + (feed.title || '') : (feed.title || '') });
      if (it.star) top.createSpan({ cls: 'er-item-star', text: '★' });
      row.createDiv({ cls: 'er-item-title', text: it.title });
      const meta = row.createDiv('er-item-meta');
      meta.createSpan({ text: it.date ? window.moment(it.date).format('YYYY-MM-DD') : '' });
      if (it.duration) meta.createSpan({ text: '· ' + fmtTime(it.duration) });
      if (it.audio) meta.createSpan({ text: '· 音频' });
      if (it.transcripts && it.transcripts.length) meta.createSpan({ text: '· 字幕' });
      if (it.summary) row.createDiv({ cls: 'er-item-summary', text: it.summary.slice(0, 110) });
      row.onclick = () => { this.openItem(it.id); };
    }
  }

  async openItem(id) {
    if (this.itemId !== id) {
      this.tab = 'auto';
      this.segs = [];
      this.transcriptInfo = null;
      this.estimateOn = false;
      this.curSeg = -1;
      this.stopAudio();
      // 「已尝试」只用来防止同一次停留里反复重试；
      // 切走再切回来必须允许重新加载，否则会把已缓存的字幕挡掉。
      this._tried.delete(id);
      this._playBumped = false;
    }
    this.itemId = id;
    this.plugin.markStudyItem(id);
    const found = this.currentItem();
    if (found && !found.it.read) {
      found.it.read = true;
      this.plugin.data.state[found.it.id] = Object.assign({}, this.plugin.data.state[found.it.id], { read: true });
      this.plugin.scheduleSave();
    }
    this.render();
  }

  /* ---------------- 阅读区 ---------------- */
  snapshotAudio() {
    if (!this.audioEl || !this.audioEl.src) return null;
    return { src: this.audioEl.src, t: this.audioEl.currentTime || 0, paused: this.audioEl.paused };
  }

  renderReader(reader) {
    const prevAudio = this.snapshotAudio();
    this.stopAudio();
    if (this._shadowBar && this._shadowBar.parentElement) { this._shadowBar.remove(); }
    this._shadowBar = null;

    const found = this.currentItem();
    if (!found) {
      reader.createDiv({ cls: 'er-empty er-empty-center', text: '左侧选一篇文章开始。\n\n第一次用？点左上角 ＋ 添加订阅源。' });
      return;
    }
    const { it, feed } = found;

    const bar = reader.createDiv('er-toolbar');
    const mkBtn = (icon, title, act, cls) => {
      const b = bar.createEl('button', { cls: 'er-icon-btn ' + (cls || ''), attr: { title } });
      setIcon(b, icon);
      b.onclick = (ev) => { ev.stopPropagation(); this.onAction(act); };
      return b;
    };
    mkBtn(it.star ? 'star' : 'star-off', it.star ? '取消收藏' : '收藏', 'toggleStar', it.star ? 'is-on' : '');
    mkBtn(it.read ? 'check-circle-2' : 'circle', it.read ? '标记未读' : '标记已读', 'toggleRead');
    mkBtn('bookmark-plus', '存为精读笔记', 'saveNote');
    mkBtn('calendar-plus', '记到今日日记', 'toDaily');
    mkBtn('copy', '导出逐字稿 Markdown', 'exportTranscript');
    const fb = bar.createEl('a', {
      cls: 'er-icon-btn er-feedback-btn',
      attr: { href: FEEDBACK_ISSUE, title: '反馈问题 / 提建议（自动带上版本信息）', target: '_blank', rel: 'noopener' },
    });
    setIcon(fb, 'message-circle');
    fb.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(feedbackIssueUrl(this.plugin.manifest && this.plugin.manifest.version), '_blank');
    };
    const spacer = bar.createDiv('er-spacer');
    if (it.link) {
      const ext = bar.createEl('a', { cls: 'er-ext', attr: { href: it.link, title: '在浏览器打开原文' } });
      setIcon(ext, 'external-link');
      ext.onclick = (e) => { e.preventDefault(); window.open(it.link); };
    }

    const body = reader.createDiv('er-reader-body');
    body.onmouseup = (ev) => this.onReaderMouseUp(ev);
    body.onclick = (ev) => this.onReaderClickDeferred(ev);
    body.ondblclick = (ev) => {
      clearTimeout(this._clickTimer);
      this.lookupWordAt(ev);
    };
    body.onscroll = () => { this.lastUserScroll = Date.now(); };

    const header = body.createDiv('er-article-head');
    header.createEl('h1', { cls: 'er-article-title', text: it.title });
    const meta = header.createDiv('er-article-meta');
    meta.createSpan({ text: feed.title || '' });
    if (it.date) meta.createSpan({ text: ' · ' + window.moment(it.date).format('YYYY-MM-DD') });
    if (it.duration) meta.createSpan({ text: ' · ' + fmtTime(it.duration) });

    this.plugin._currentSource = `${it.title} · ${feed.title}`;
    this.plugin._playingItem = { id: it.id, feedId: feed.id, title: it.title, show: feed.title };
    if (it.audio) this.renderAudioBar(body, it, prevAudio);

    // 没有字幕就后台去取
    if (!this.segs.length && !this.isLoading(it.id) && !this._tried.has(it.id)) this.autoLoadTranscript(it);

    // 标签切换
    const tabs = body.createDiv('er-tabs');
    const showTabs = it.audio || this.segs.length > 0 || this.isLoading(it.id);
    if (showTabs) {
      const t1 = tabs.createEl('button', { cls: 'er-tab' + (this.effectiveTab() === 'transcript' ? ' is-active' : ''), text: '逐句精听' });
      const shortText = stripTags(it.fullHtml || it.content || '').length < 900;
      const t2 = tabs.createEl('button', { cls: 'er-tab' + (this.effectiveTab() === 'text' ? ' is-active' : ''), text: shortText ? '节目简介' : '原文阅读' });
      const go = (tab) => {
        this.tab = tab;
        const el = this.getReaderEl();
        if (el) { el.empty(); this.renderReader(el); }
      };
      t1.onclick = () => go('transcript');
      t2.onclick = () => go('text');
      if (this.isLoading(it.id)) tabs.createSpan({ cls: 'er-loading', text: '正在取字幕…' });
    }

    const pane = body.createDiv('er-pane');
    this.paneEl = pane;

    try {
      if (this.effectiveTab() === 'transcript') this.renderTranscriptPane(pane, it);
      else this.renderTextPane(pane, it);
    } catch (e) {
      this.log('PANE ERROR: ' + ((e && e.stack) || e));
      pane.empty();
      const box = pane.createDiv('er-fatal');
      box.createEl('b', { text: '正文渲染出错' });
      box.createEl('pre', { text: String((e && e.message) || e) });
    }

    // 底部跟读条
    if (it.audio) this.renderShadowBar(reader);
    this.scheduleDiag();
  }

  effectiveTab() {
    if (this.tab !== 'auto') return this.tab;
    if (this.segs.length) return 'transcript';
    if (this.itemId && this.isLoading(this.itemId) && this.currentItem()?.it.audio) return 'transcript';
    return 'text';
  }

  /** 稳妥地拿到阅读区容器（不依赖 containerEl 一定有 querySelector） */
  getReaderEl() {
    try {
      if (this.containerEl && typeof this.containerEl.querySelector === 'function') {
        const el = this.getReaderEl();
        if (el) return el;
      }
    } catch (e) { /* ignore */ }
    return this.readerEl || null;
  }

  log(msg) {
    try { if (this.plugin && typeof this.plugin.diagLog === 'function') this.plugin.diagLog(msg); } catch (e) { /* ignore */ }
  }

  isLoading(id) { return !!id && this._loading.has(id); }

  /** 后台取逐字稿：按文章 ID 追踪，失败/超时自动退回原文，绝不让 UI 卡在加载中 */
  async autoLoadTranscript(it) {
    const token = it.id;
    if (this._loading.has(token) || this._tried.has(token)) return;
    this._loading.add(token);
    this._tried.add(token);
    let result = null;
    let err = '';
    try {
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 25000));
      result = await Promise.race([this.plugin.fetchTranscript(it, false), timeout]);
    } catch (e) {
      err = (e && e.message) || String(e);
      this.log(`fetchTranscript 抛错: ${err}`);
    } finally {
      this._loading.delete(token);
    }
    if (this.itemId !== token) return; // 用户已切走，不影响当前这篇

    if (result && result.segments && result.segments.length) {
      this.segs = result.segments;
      this.transcriptInfo = result;
      if (this.tab === 'auto') this.tab = 'transcript';
    } else {
      // 只有用户没手动选过标签时才自动切回原文，别抢用户的选择
      if (this.tab === 'auto') this.tab = this.segs.length ? 'transcript' : 'text';
      this.log(`无字幕 item=${token} err=${err}`);
    }
    const el = this.getReaderEl();
    if (el) { el.empty(); this.renderReader(el); }
  }

  /** 只有时间估算时，元数据加载完后刷新时间码 */
  refreshSegTimes() {
    if (!this.segsEl || !this.segs.length) return;
    this.segsEl.querySelectorAll('.er-seg').forEach((row) => {
      const i = Number(row.dataset.seg);
      const t = row.querySelector('.er-seg-time');
      if (t && this.segs[i]) t.setText(fmtTime(this.segs[i].start || 0));
    });
  }

  renderAudioBar(body, it, prevAudio) {
    const bar = body.createDiv('er-audio-bar');
    const playBtn = bar.createEl('button', { cls: 'er-play', attr: { title: '播放 / 暂停 (Space)' } });
    setIcon(playBtn, 'play');

    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = it.audio;
    audio.className = 'er-audio-el';
    bar.appendChild(audio);
    this.audioEl = audio;

    const state = this.data.state[it.id] || {};
    const rate = state.rate || this.data.settings.defaultRate || 1;
    audio.playbackRate = rate;
    const resume = prevAudio && prevAudio.src === audio.src ? prevAudio : null;
    const pendingSeek = resume ? resume.t : (state.pos > 3 ? state.pos : 0);

    const time = bar.createSpan({ cls: 'er-time', text: '0:00 / ' + (it.duration ? fmtTime(it.duration) : '--:--') });

    // P0: 可拖动进度条，放在时间之后；拖动时暂停感知识别，避免时长误计
    const seek = bar.createEl('input', {
      cls: 'er-seek',
      attr: { type: 'range', min: '0', max: '1000', value: '0', step: '1', 'aria-label': '播放进度' },
    });
    this._seekEl = seek;
    this._seeking = false;
    const applySeek = () => {
      const d = audio.duration || it.duration;
      if (!isFinite(d) || d <= 0) return;
      const frac = Math.max(0, Math.min(1, Number(seek.value) / 1000));
      try { audio.currentTime = frac * d; } catch (e) { /* ignore */ }
      this._lastTickT = audio.currentTime;
    };
    seek.addEventListener('pointerdown', () => { this._seeking = true; });
    seek.addEventListener('keydown', () => { this._seeking = true; });
    seek.addEventListener('input', applySeek);
    seek.addEventListener('change', () => { applySeek(); this._seeking = false; });
    seek.addEventListener('pointerup', () => { this._seeking = false; });

    const ctrls = bar.createDiv('er-audio-ctrls');
    const mk = (icon, title, fn) => {
      const b = ctrls.createEl('button', { cls: 'er-icon-btn', attr: { title } });
      setIcon(b, icon);
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      return b;
    };
    mk('rotate-ccw', '后退 15 秒', () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
    mk('rotate-cw', '前进 15 秒', () => { audio.currentTime = Math.min(audio.duration || 1e9, audio.currentTime + 15); });
    mk('chevron-left', '上一句', () => this.stepSegment(-1));
    mk('chevron-right', '下一句', () => this.stepSegment(1));

    const rateSel = ctrls.createEl('select', { cls: 'er-rate' });
    [0.65, 0.75, 0.8, 0.9, 1, 1.15, 1.25, 1.5, 1.75].forEach((r) => {
      const o = rateSel.createEl('option', { text: r + 'x', attr: { value: String(r) } });
      if (Math.abs(r - rate) < 0.01) o.selected = true;
    });
    rateSel.onchange = () => {
      const r = parseFloat(rateSel.value);
      audio.playbackRate = r;
      this.data.state[it.id] = Object.assign({}, this.data.state[it.id], { rate: r });
      this.plugin.scheduleSave();
    };

    playBtn.onclick = (e) => { e.stopPropagation(); this.togglePlay(); };

    audio.onplay = () => {
      setIcon(playBtn, 'pause');
      if (this._rootEl) this._rootEl.addClass('is-playing');
      if (!this.data.settings.autoScroll && !this._followHintShown) {
        this._followHintShown = true;
        new Notice('视图跟随已关闭：点逐句精听上方「跟随已关 ○ · 点此开启」即可自动滚到当前句');
      }
      if (!this._playBumped) {
        this._playBumped = true;
        const cur = this.plugin._playingItem;
        if (cur && cur.id) this.plugin.bumpItemPlay(cur.id);
      }
    };
    audio.onpause = () => { setIcon(playBtn, 'play'); if (this._rootEl) this._rootEl.removeClass('is-playing'); };
    audio.ontimeupdate = () => {
      time.setText(fmtTime(audio.currentTime) + ' / ' + (it.duration || isFinite(audio.duration) ? fmtTime(it.duration || audio.duration) : '--:--'));

      // P0: 同步进度条（拖动中不回写，避免手柄抖动）
      const seekEl = this._seekEl;
      if (seekEl && !this._seeking) {
        const d = audio.duration || it.duration;
        if (isFinite(d) && d > 0) {
          const frac = Math.max(0, Math.min(1, audio.currentTime / d));
          seekEl.value = String(Math.round(frac * 1000));
          seekEl.style.setProperty('--er-seek-pct', (frac * 100).toFixed(1) + '%');
        }
      }

      if (this.maybeLoopSeg(audio)) return; // 这一拍刚跳回句首，不更新高亮避免闪烁
      if (this.maybeAutoAdvance(audio)) return;

      // 学习时长：只累计正常播放的增量，拖进度条（跳变）不计
      const dt = this._lastTickT == null ? 0 : audio.currentTime - this._lastTickT;
      this._lastTickT = audio.currentTime;
      if (!audio.paused && dt > 0 && dt < 3) this.plugin.addStudySeconds(dt, this.plugin._playingItem);

      this.syncToTime(audio.currentTime);
      this.persistPos(it.id, audio.currentTime);
    };
    audio.onerror = () => {
      const code = audio.error ? audio.error.code : 0;
      const msg = audio.error ? String(audio.error.message || '') : '';
      const hint = code === 4 ? '链接不可达或被网络拦截' : code === 3 ? '解码失败' : code === 2 ? '网络错误' : '未知错误';
      time.setText(`✕ 音频加载失败（${hint}）`);
      this.log(`AUDIO ERROR code=${code} msg=${msg} url=${it.audio}`);
      if (!bar.querySelector('.er-audio-fail')) {
        const fail = bar.createDiv('er-audio-fail');
        fail.createSpan({ text: '可以试试：' });
        const open = fail.createEl('a', { text: '浏览器打开音频', href: it.audio });
        open.onclick = (e) => { e.preventDefault(); window.open(it.audio); };
        const cp = fail.createEl('button', { text: '复制链接' });
        cp.onclick = () => {
          if (navigator.clipboard) navigator.clipboard.writeText(it.audio);
          new Notice('音频链接已复制');
        };
      }
    };
    audio.onloadedmetadata = () => {
      if (!it.duration && isFinite(audio.duration)) it.duration = Math.round(audio.duration);
      if (pendingSeek > 0) { try { audio.currentTime = pendingSeek; } catch (e) { /* ignore */ } }
      if (resume && !resume.paused) audio.play().catch(() => {});
      if (this.transcriptInfo && !this.transcriptInfo.timed) {
        this.estimateTimings(it);
        this.refreshSegTimes();
      }
    };

    // 键盘：空格播放/暂停
    this.audioKeyHandler = (ev) => {
      const tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || ev.target.isContentEditable) return;
      if (ev.code === 'Space') { ev.preventDefault(); this.togglePlay(); }
    };
    document.addEventListener('keydown', this.audioKeyHandler);
  }

  togglePlay() {
    if (!this.audioEl) return;
    if (this.audioEl.paused) {
      try {
        const p = this.audioEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => new Notice('播放失败，可能被网络拦截'));
      } catch (e) { /* ignore */ }
    } else {
      try { this.audioEl.pause(); } catch (e) { /* ignore */ }
    }
  }
  /** 命令面板/快捷键用：切换单句循环 */
  async toggleLoop() {
    this.data.settings.loopSentence = !this.data.settings.loopSentence;
    await this.plugin.save();
    const on = this.data.settings.loopSentence;
    this.loopIdx = on ? (this.curSeg >= 0 ? this.curSeg : 0) : -1;
    new Notice(on ? '已开启单句循环：反复听当前句' : '已关闭单句循环');
  }


  stopAudio() {
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch (e) { /* ignore */ }
      try { if (typeof this.audioEl.removeAttribute === 'function') this.audioEl.removeAttribute('src'); } catch (e) { /* ignore */ }
      try { if (typeof this.audioEl.load === 'function') this.audioEl.load(); } catch (e) { /* ignore */ }
      this.audioEl = null;
    }
    if (this.audioKeyHandler) {
      document.removeEventListener('keydown', this.audioKeyHandler);
      this.audioKeyHandler = null;
    }
  }

  persistPos(id, pos) {
    const st = this.data.state[id] || {};
    if (Math.abs((st.pos || 0) - pos) < 2) return;
    this.data.state[id] = Object.assign({}, st, { pos });
    this.plugin.scheduleSave();
  }

  renderTextPane(pane, it) {
    const html = sanitizeHtml(it.fullHtml || it.content || '<p>' + esc(it.summary || '') + '</p>', it.baseUrl);
    const article = pane.createDiv('er-article');
    article.innerHTML = html;
    const shownLen = (article.textContent || '').replace(/\s+/g, '').length;
    if (shownLen < 900 && it.link) {
      const hint = pane.createDiv('er-text-hint');
      hint.createSpan({
        text: it.fullHtml
          ? '已抓取网页正文，但仍较短（可能这集本来就只有简介）。'
          : '⚠ 这里只有 ' + shownLen + ' 字的节目简介 —— RSS 本身不带全文。',
      });
      if (!it.fullHtml) {
        const b = hint.createEl('button', { cls: 'er-link-btn', text: '抓取网页正文' });
        b.onclick = () => this.loadFullText(it, b);
      }
    }
    // TTS 朗读条
    const tts = pane.createDiv('er-tts');
    const b = tts.createEl('button', { cls: 'er-link-btn', text: '🔊 朗读全文（TTS）' });
    b.onclick = () => this.speak(stripTags(article.textContent || '').slice(0, 6000));
    const stop = tts.createEl('button', { cls: 'er-link-btn', text: '停止' });
    stop.onclick = () => window.speechSynthesis && window.speechSynthesis.cancel();
  }

  renderTranscriptPane(pane, it) {
    if (this.whisperJob && this.whisperJob.running && (!this.whisperJob.itemId || this.whisperJob.itemId === it.id)) {
      const box = pane.createDiv('er-whisper');
      box.createDiv({ cls: 'er-whisper-text', text: (this.whisperJob.phase || '准备中') + ' ' + (this.whisperJob.pct || 0) + '%' + (this.whisperJob.sizeMB ? '（音频 ' + this.whisperJob.sizeMB + ' MB）' : '') });
      const bar = box.createDiv({ cls: 'er-whisper-bar' });
      const fill = bar.createEl('i');
      fill.style.width = (this.whisperJob.pct || 0) + '%';
      box.createDiv({ cls: 'er-hint', text: '本地转写在本机跑，不上传音频。可以先去听别的，完成后这里会自动出现逐句字幕。' });
      const cancel = box.createEl('button', { cls: 'er-link-btn', text: '取消转写' });
      cancel.onclick = () => { this.plugin.cancelWhisper(); this.whisperJob = null; const el = this.getReaderEl(); if (el) { el.empty(); this.renderReader(el); } };
      return;
    }

    if (this.isLoading(it.id)) {
      pane.createDiv({ cls: 'er-empty', text: '正在获取逐字稿…' });
      return;
    }
    if (!this.segs.length) {
      const box = pane.createDiv('er-transcript-empty');
      const emptyIcon = box.createSpan({ cls: 'er-empty-icon' });
      setIcon(emptyIcon, 'file-question');
      box.createDiv({ cls: 'er-empty-title', text: it.audio ? '这一集还没有可用的逐字稿。' : '这个源是图文内容，没有音频/字幕。' });
      box.createDiv({ cls: 'er-hint', text: '可以：① 换到「原文阅读」；② 用下面按钮到网页里找逐字稿；③ 手动粘贴字幕。' });
      const row = box.createDiv('er-empty-actions');
      const b1 = row.createEl('button', { text: '去网页找逐字稿' });
      b1.onclick = () => this.plugin.fetchTranscript(it, true).then((r) => {
        if (r) { this.segs = r.segments; this.transcriptInfo = r; this.render(); }
        else new Notice('没找到逐字稿，可以手动粘贴');
      });
      const b2 = row.createEl('button', { text: '手动粘贴字幕' });
      b2.onclick = () => this.openPasteTranscript(it);
      const st = this.data.settings;
      const whisperReady = !Platform.isMobile && !!(st.whisperDir && st.whisperPython && st.whisperModelDir);
      if (it.audio && whisperReady) {
        const mins = it.duration ? Math.max(1, Math.round(it.duration / 60 / 10)) : 3;
        const b4 = row.createEl('button', { cls: 'mod-cta', text: '本地转写这一集（约 ' + mins + ' 分钟）' });
        b4.onclick = () => this.runWhisper(it);
      } else if (it.audio) {
        box.createDiv({ cls: 'er-hint', text: '提示：配置「本地转写」后，没字幕的节目可以一键生成逐句字幕（免费离线）。' });
      }
      const b3 = row.createEl('button', { text: '用整篇原文当字幕' });
      b3.onclick = () => {
        const sents = splitSentences(stripTags(it.content || it.summary || ''));
        if (!sents.length) return new Notice('这篇没有正文可切分');
        this.segs = sents.map((t) => ({ start: 0, end: 0, text: t }));
        this.transcriptInfo = { timed: false, kind: 'from-text' };
        this.estimateOn = true;
        this.estimateTimings(it);
        this.render();
      };
      return;
    }

    const realTimed = !!this.transcriptInfo?.timed;
    if (!realTimed && this.estimateOn) this.estimateTimings(it);
    const showTime = realTimed || this.estimateOn;

    const info = pane.createDiv('er-transcript-info');
    info.setText(
      realTimed
        ? '✓ 字幕带真实时间戳 · ' + this.segs.length + ' 句'
        : this.estimateOn
          ? '≈ 时间轴按句长估算，可能和音频有偏差 · ' + this.segs.length + ' 句'
          : '⚠ 这段文字来自网页，没有时间轴，点句不会跳转 · ' + this.segs.length + ' 句'
    );
    if (!realTimed) {
      const est = info.createEl('button', { cls: 'er-link-btn', text: this.estimateOn ? '关闭估算' : '按句长估算时间轴' });
      est.onclick = () => {
        this.estimateOn = !this.estimateOn;
        const el = this.getReaderEl();
        if (el) { el.empty(); this.renderReader(el); }
      };
      const fix = info.createEl('button', { cls: 'er-link-btn', text: '重新获取' });
      fix.onclick = () => this.plugin.fetchTranscript(this.currentItem().it, true).then((r) => {
        if (r) { this.segs = r.segments; this.transcriptInfo = r; this.render(); }
      });
    }

    // 进度条 + 句号 + 跟随开关
    const prog = pane.createDiv('er-seg-progress');
    const progFill = prog.createEl('i');
    progFill.style.width = '0%';
    info.createSpan({ cls: 'er-seg-pos', text: '第 1 / ' + this.segs.length + ' 句' });
    info.createSpan({ cls: 'er-seg-tip', text: '单击句子播放 · 双击单词查义' });
    const loopBtn = info.createEl('button', {
      cls: 'er-link-btn er-loop-btn' + (this.data.settings.loopSentence ? ' is-active' : ''),
      text: this.data.settings.loopSentence ? '单句循环 ●' : '单句循环 ○',
      attr: { title: '反复播放当前句，点别的句子就换目标' },
    });
    loopBtn.onclick = async () => {
      this.data.settings.loopSentence = !this.data.settings.loopSentence;
      if (this.data.settings.loopSentence && this.data.settings.autoAdvance) {
        this.data.settings.autoAdvance = false;
        if (autoBtn) { autoBtn.setText('自动连播 ○'); autoBtn.removeClass('is-active'); }
      }
      await this.plugin.save();
      const on = this.data.settings.loopSentence;
      this.loopIdx = on ? (this.curSeg >= 0 ? this.curSeg : 0) : -1;
      loopBtn.setText(on ? '单句循环 ●' : '单句循环 ○');
      if (on) loopBtn.addClass('is-active'); else loopBtn.removeClass('is-active');
      new Notice(on ? '已开启单句循环：反复听当前句' : '已关闭单句循环');
    };

    const followOn = this.data.settings.autoScroll;
    const followBtn = info.createEl('button', {
      cls: 'er-link-btn er-follow-btn' + (followOn ? ' is-active' : ' is-off'),
      text: followOn ? '跟随中 ●' : '跟随已关 ○ · 点此开启',
      attr: { title: followOn ? '播放时自动滚动到当前句（点击关闭）' : '当前已关闭自动滚动，点击开启' },
    });
    followBtn.onclick = async () => {
      this.data.settings.autoScroll = !this.data.settings.autoScroll;
      await this.plugin.save();
      const on = this.data.settings.autoScroll;
      followBtn.setText(on ? '跟随中 ●' : '跟随已关 ○ · 点此开启');
      followBtn.toggleClass('is-active', on);
      followBtn.toggleClass('is-off', !on);
      followBtn.setAttribute('title', on ? '播放时自动滚动到当前句（点击关闭）' : '当前已关闭自动滚动，点击开启');
      if (on && this.curSeg >= 0) {
        this.lastUserScroll = 0;
        this._programmaticScroll = 0;
        this.followCurrent(this.curSeg);
      }
    };

    // 只有用户真的在滚（滚轮 / 触摸 / 拖滚动条）才暂停跟随
    const markUserScroll = () => { this.lastUserScroll = Date.now(); };
    pane.addEventListener('wheel', markUserScroll, { passive: true });
    pane.addEventListener('touchmove', markUserScroll, { passive: true });
    pane.addEventListener('mousedown', (ev) => { if (ev.target === pane) markUserScroll(); });

    if (this.data.settings.segSearch !== false) {
      const srow = pane.createDiv('er-seg-search-row');
      const sinp = srow.createEl('input', {
        cls: 'er-seg-search',
        attr: { type: 'search', placeholder: '搜索本集字幕', title: '输入即过滤，回车跳到下一处命中' },
      });
      sinp.value = this._segQuery || '';
      const scnt = srow.createSpan({ cls: 'er-seg-search-count', text: '' });
      const runFilter = () => {
        this._segQuery = (sinp.value || '').trim();
        const n = this.applySegFilter();
        scnt.setText(this._segQuery ? (n ? '命中 ' + n + ' 句' : '没有匹配') : '');
      };
      sinp.oninput = runFilter;
      sinp.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); this.jumpToMatch(1); } };
      if (this._segQuery) runFilter();
    }
    const autoBtn = info.createEl('button', {
      cls: 'er-link-btn er-auto-btn' + (this.data.settings.autoAdvance ? ' is-active' : ''),
      text: this.data.settings.autoAdvance ? '自动连播 ●' : '自动连播 ○',
      attr: { title: '播完一句自动播下一句；单句循环与它互斥，跟读未达标时会停下' },
    });
    autoBtn.onclick = async () => {
      await this.toggleAutoAdvance();
      const on = this.data.settings.autoAdvance;
      autoBtn.setText(on ? '自动连播 ●' : '自动连播 ○');
      if (on) autoBtn.addClass('is-active'); else autoBtn.removeClass('is-active');
      const lbtn = info.querySelector('.er-loop-btn');
      if (lbtn) {
        lbtn.setText(this.data.settings.loopSentence ? '单句循环 ●' : '单句循环 ○');
        if (this.data.settings.loopSentence) lbtn.addClass('is-active'); else lbtn.removeClass('is-active');
      }
    };
    const list = pane.createDiv('er-segs');
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      const row = list.createDiv('er-seg');
      row.dataset.seg = String(i);
      const t = row.createSpan({
        cls: 'er-seg-time' + (showTime ? '' : ' is-na'),
        text: showTime ? fmtTime(s.start || 0) : '—',
      });
      if (showTime) t.onclick = (e) => { e.stopPropagation(); this.seek(s.start || 0); };
      const segText = row.createSpan({ cls: 'er-seg-text' });
      segText.createSpan({ cls: 'er-seg-ink', text: s.text });
      const tools = row.createDiv('er-seg-tools');
      const rec = tools.createEl('button', { cls: 'er-mini', attr: { title: '跟读这一句' }, text: '🎙' });
      rec.onclick = (e) => { e.stopPropagation(); this.startRecording(s); };
      const flag = tools.createEl('button', { cls: 'er-mini er-flag-btn', attr: { title: '记入错题本' }, text: '⚑' });
      flag.onclick = (e) => { e.stopPropagation(); this.toggleMistake(i, s); };
      const quote = tools.createEl('button', { cls: 'er-mini', attr: { title: '引用这句写进笔记（带时间点）' }, text: '引' });
      quote.onclick = (e) => { e.stopPropagation(); this.quoteSegment(i); };
      const tr = tools.createEl('button', { cls: 'er-mini', attr: { title: '翻译这句' }, text: '译' });
      tr.onclick = async (e) => {
        e.stopPropagation();
        const box = row.querySelector('.er-seg-tr');
        if (box) { box.remove(); return; }
        const div = row.createDiv({ cls: 'er-seg-tr', text: '翻译中…' });
        div.setText(await translateSentence(s.text));
      };
      this.decorateSegRow(row, i);
    }
    this.segsEl = list;
    if (this.audioEl) this.syncToTime(this.audioEl.currentTime, true);
  }

  estimateTimings(it) {
    const total = it.duration && it.duration > 30 ? it.duration : (this.audioEl && isFinite(this.audioEl.duration) ? this.audioEl.duration : 0);
    if (!total) return;
    const lens = this.segs.map((s) => Math.max(12, s.text.length));
    const sum = lens.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    for (let i = 0; i < this.segs.length; i++) {
      const dur = (lens[i] / sum) * total;
      if (this.segs[i].start == null || this.transcriptInfo?.kind === 'from-text' || !this.transcriptInfo?.timed) {
        this.segs[i].start = acc;
        this.segs[i].end = acc + dur;
      }
      acc += dur;
    }
  }

  seek(t) {
    if (!this.audioEl) return new Notice('这一集没有音频');
    this._lastTickT = t;
    try { this.audioEl.currentTime = t; } catch (e) { /* ignore */ }
    if (this.audioEl.paused) {
      try {
        const p = this.audioEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) { /* ignore */ }
    }
  }

  stepSegment(dir) {
    if (!this.audioEl || !this.segs.length) return;
    const t = this.audioEl.currentTime;
    let idx = this.curSeg;
    if (idx < 0) idx = this.segs.findIndex((s) => s.start > t);
    idx = Math.max(0, Math.min(this.segs.length - 1, idx + dir));
    this.curSeg = idx;
    if (this.data.settings.loopSentence) this.loopIdx = idx;
    this.seek(this.segs[idx].start || 0);
    // 自动连播会跳过下一拍的 syncToTime，这里主动刷新高亮与句进度条，避免卡在旧句
    this.syncToTime(this.audioEl.currentTime, true);
  }

  syncToTime(t, force) {
    if (!this.segs.length || !this.segsEl) return;
    if (!this.transcriptInfo?.timed && !this.estimateOn) return;
    let lo = 0, hi = this.segs.length - 1, idx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if ((this.segs[mid].start || 0) <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    // 即使 curSeg 相同，也要确认 DOM 高亮确实在 idx 上（自动连播改了 curSeg 却跳过刷新时会错位）
    if (idx === this.curSeg && !force) {
      const now = this.segsEl.querySelector('.er-seg.is-playing');
      if (now && Number(now.dataset.seg) === idx) {
        // 高亮没变也要每拍检查视野：用户滚走 / 暂停跟随结束后，视图要能自己回到当前句
        this.maybeFollowCurrent(idx);
        return;
      }
    }
    const prev = this.segsEl.querySelector('.er-seg.is-playing');
    if (prev) prev.removeClass('is-playing');
    const cur = this.segsEl.querySelector(`[data-seg="${idx}"]`);
    if (cur) {
      cur.addClass('is-playing');
      this.curSeg = idx;
      this.updateSegProgress(idx);
      this.maybeFollowCurrent(idx);
    }
  }

  /** 字幕内搜索：只隐藏不匹配行，不重建 DOM（输入框不会失焦） */
  applySegFilter() {
    const q = (this._segQuery || '').toLowerCase();
    if (!this.segsEl) return 0;
    let n = 0;
    const rows = this.segsEl.querySelectorAll('.er-seg');
    for (const row of rows) {
      const seg = this.segs[Number(row.dataset.seg)];
      const hay = String((seg && seg.text) || '').toLowerCase();
      const hit = !q || hay.indexOf(q) >= 0;
      if (hit && q) n++;
      if (hit) row.removeClass('is-filtered-out'); else row.addClass('is-filtered-out');
    }
    return n;
  }

  /** 回车：从当前句往后找命中，到末尾再从头找 */
  jumpToMatch(dir) {
    const q = (this._segQuery || '').toLowerCase();
    if (!q || !this.segsEl || !this.segs.length) return;
    const rows = Array.from(this.segsEl.querySelectorAll('.er-seg'));
    const cur = Math.max(0, this.curSeg || 0);
    const order = [];
    const step = dir > 0 ? 1 : -1;
    for (let k = cur + step; k >= 0 && k < rows.length; k += step) order.push(k);
    for (let k = dir > 0 ? 0 : rows.length - 1; k >= 0 && k < rows.length; k += step) {
      if (dir > 0 ? k <= cur : k > cur) order.push(k);
    }
    for (const k of order) {
      const row = rows[k];
      if (!row || row.hasClass('is-filtered-out')) continue;
      row.addClass('is-match-flash');
      setTimeout(() => row.removeClass('is-match-flash'), 1200);
      this.playSegmentAt(String(k));
      return;
    }
  }

  /** 自动连播：播到句尾进下一句。单句循环 / 跟读待评 / 录音中都不抢方向盘 */
  maybeAutoAdvance(audio) {
    if (!this.data.settings.autoAdvance || this.data.settings.loopSentence) return false;
    if (this._shadowPending != null || this.recState === 'recording') return false;
    const i = this.curSeg;
    const seg = this.segs[i];
    if (!seg || !(seg.end > seg.start)) return false;
    const t = audio.currentTime;
    if (t < seg.end - 0.12 || t > seg.end + 1.5) return false;
    if (i + 1 >= this.segs.length) {
      try { audio.pause(); } catch (e) { /* ignore */ }
      return true;
    }
    this.stepSegment(1);
    if (audio.paused) { try { const p = audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
    return true;
  }

  /** 自动连播开关：与单句循环互斥 */
  async toggleAutoAdvance() {
    this.data.settings.autoAdvance = !this.data.settings.autoAdvance;
    if (this.data.settings.autoAdvance && this.data.settings.loopSentence) {
      this.data.settings.loopSentence = false;
      this.loopIdx = -1;
    }
    await this.plugin.save();
    new Notice(this.data.settings.autoAdvance ? '已开启自动连播：播完自动下一句' : '已关闭自动连播');
    return this.data.settings.autoAdvance;
  }

  /** 引用当前句：来源 + 集名 + 可点回跳的时间戳 */
  async quoteSegment(idx) {
    const seg = this.segs[idx];
    if (!seg) return;
    const found = this.currentItem();
    const line = quoteLineFor(seg, found && found.it, found && found.feed, PROTOCOL);
    const folder = this.data.settings.noteFolder || 'English';
    await this.plugin.ensureFolder(folder);
    const path = folder + '/' + QUOTE_FILE;
    const adapter = this.plugin.app.vault.adapter;
    if (!(await adapter.exists(path))) {
      await adapter.write(path, '---\ntags: [' + QUOTE_TAG + ']\n---\n\n# ' + QUOTE_TITLE + '\n\n' + line);
    } else {
      await adapter.append(path, line);
    }
    new Notice(QUOTE_NOTICE);
  }

  /** 单句循环：播到本句结尾就跳回句首；返回是否发生了跳转 */
  maybeLoopSeg(audio) {
    if (!this.data.settings.loopSentence) return false;
    const seg = this.segs[this.loopIdx >= 0 ? this.loopIdx : this.curSeg];
    if (!seg || !(seg.end > seg.start)) return false;
    const t = audio.currentTime;
    // 只在句尾附近才跳回：拖进度条跑远时不打断（否则会被一直拽回来）
    if (t < seg.end - 0.12 || t > seg.end + 3) return false;
    this.loopIdx = this.loopIdx >= 0 ? this.loopIdx : this.curSeg;
    try { audio.currentTime = seg.start; } catch (e) { /* ignore */ }
    return true;
  }

  /** 用户刚滚动过就先不接管，避免抢方向盘 */
  isFollowing() {
    return Date.now() - (this.lastUserScroll || 0) > 4000;
  }

  /** 高亮与视图跟随解耦：每一拍都检查当前句是否在视野内，暂停期结束自动归位 */
  maybeFollowCurrent(idx) {
    if (!this.data.settings.autoScroll || !this.isFollowing()) return;
    this.followCurrent(idx);
  }

  /** 让当前句回到阅读区舒适位置：只滚 .er-pane，平滑过渡 */
  followCurrent(idx) {
    const pane = this.paneEl;
    const cur = this.segsEl && this.segsEl.querySelector(`[data-seg="${idx}"]`);
    if (!pane || !cur || (cur.hasClass && cur.hasClass('is-filtered-out'))) return;
    const pr = pane.getBoundingClientRect();
    const cr = cur.getBoundingClientRect();
    if (!pr.height || !cr.height) return;
    const topGuard = pr.top + pr.height * 0.30;
    const bottomGuard = pr.top + pr.height * 0.66;
    // 还在舒适区内就不动，避免每句都抖一下
    if (cr.top >= topGuard && cr.bottom <= bottomGuard) return;
    const target = Math.max(0, pane.scrollTop + (cr.top - pr.top) - pr.height * 0.36);
    // 已经到位就不用动；平滑滚动有动画，别每拍重复启动打断它
    if (Math.abs(pane.scrollTop - target) < 4) return;
    const now = Date.now();
    if (now - (this._programmaticScroll || 0) < 500) return;
    this._programmaticScroll = now;
    try {
      pane.scrollTo({ top: target, behavior: 'smooth' });
    } catch (e) {
      pane.scrollTop = target;
    }
  }

  /** 顶部进度条 + 句号显示 */
  updateSegProgress(idx) {
    const total = this.segs.length || 1;
    const el = this.getReaderEl();
    if (!el) return;
    const pos = el.querySelector('.er-seg-pos');
    if (pos) pos.setText('第 ' + (idx + 1) + ' / ' + total + ' 句');
    const fill = el.querySelector('.er-seg-progress i');
    if (fill) fill.style.width = Math.min(100, ((idx + 1) / total) * 100) + '%';
  }

  /* ---------------- 选区 / 点词 ---------------- */
  /** 字幕区单击＝播放该句；原文区保持点词查义 */
  onReaderClickDeferred(ev) {
    const segEl = ev.target.closest ? ev.target.closest('.er-seg') : null;
    if (!segEl) { this.onReaderClick(ev); return; }
    // 正在选文字（拖选后松手）不要顺手播出声音
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && (sel.toString() || '').trim().length > 1) return;
    clearTimeout(this._clickTimer);
    const x = ev.clientX;
    const y = ev.clientY;
    const idx = segEl.dataset.seg;
    // 稍等 200ms：若紧接着发生双击，就取消播放改为查词
    this._clickTimer = setTimeout(() => this.playSegmentAt(idx, x, y), 200);
  }

  /** 播放指定句（点哪句播哪句） */
  playSegmentAt(idxStr, x, y) {
    const idx = Number(idxStr);
    const seg = this.segs[idx];
    if (!seg) return;
    const timed = !!this.transcriptInfo?.timed || this.estimateOn;
    if (!timed) {
      if (this.data.settings.lookupOnClick) this.lookupPopup(x, y);
      else new Notice('这段字幕没有时间轴，无法定位播放');
      return;
    }
    if (!this.audioEl) return new Notice('这一集没有音频');
    this.curSeg = idx;
    if (this.data.settings.loopSentence) this.loopIdx = idx;
    this.seek(seg.start || 0);
    this.syncToTime(seg.start || 0, true);
  }

  lookupPopup(x, y) {
    const hit = this.wordAtPoint(x, y);
    if (!hit) return;
    this.plugin.showWordPopup(hit.word, { x, y, context: this.contextSentence(hit.node) });
  }

  /** 双击查词：播放中先暂停，弹窗关掉再继续 */
  lookupWordAt(ev) {
    if (!this.data.settings.lookupOnClick) return;
    if (ev.target.closest && ev.target.closest('button, a, input, select, .er-seg-time')) return;
    const hit = this.wordAtPoint(ev.clientX, ev.clientY);
    if (!hit) return;

    const wasPlaying = !!(this.audioEl && !this.audioEl.paused);
    if (wasPlaying) { try { this.audioEl.pause(); } catch (e) { /* ignore */ } }

    let resumed = false;
    const resume = () => {
      if (!wasPlaying || resumed) return;
      resumed = true;
      try {
        const pr = this.audioEl && this.audioEl.play();
        if (pr && typeof pr.catch === 'function') pr.catch(() => {});
      } catch (e) { /* ignore */ }
    };

    this.plugin.showWordPopup(hit.word, {
      x: ev.clientX,
      y: ev.clientY,
      context: this.contextSentence(hit.node),
      onClose: resume,
    });
  }

  onReaderClick(ev) {
    if (!this.data.settings.lookupOnClick) return;
    if (ev.target.closest('button, a, input, select, .er-seg-time')) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const hit = this.wordAtPoint(ev.clientX, ev.clientY);
    if (!hit) return;
    this.plugin.showWordPopup(hit.word, { x: ev.clientX, y: ev.clientY, context: this.contextSentence(hit.node) });
  }

  wordAtPoint(x, y) {
    let range = null;
    if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
    if (!range) return null;
    const node = range.startContainer;
    if (!node || node.nodeType !== 3) return null;
    const text = node.textContent || '';
    const isW = (c) => /[A-Za-z'’\-]/.test(c || '');
    let i = range.startOffset;
    if (!isW(text[i]) && !isW(text[i - 1])) return null;
    if (!isW(text[i])) i -= 1;
    let s = i, e = i + 1;
    while (s > 0 && isW(text[s - 1])) s--;
    while (e < text.length && isW(text[e])) e++;
    const word = text.slice(s, e).replace(/^[-'’]+|[-'’]+$/g, '');
    if (!/^[A-Za-z][A-Za-z'’\-]{0,}$/.test(word) || word.length < 2) return null;
    return { word, node, s, e };
  }

  contextSentence(node) {
    const block = node.parentElement;
    const txt = (block?.textContent || '').replace(/\s+/g, ' ').trim();
    const w = (node.textContent || '');
    const idx = Math.max(0, txt.indexOf(w.slice(0, 40)));
    const sentences = splitSentences(txt);
    const found = sentences.find((s) => s.includes(w.slice(0, 30))) || sentences[0] || '';
    return found.slice(0, 240);
  }

  onReaderMouseUp(ev) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length < 2) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    this.plugin.showSelectionBar(text, rect);
  }

  openPasteTranscript(it) {
    const modal = new Modal(this.app);
    modal.titleEl.setText('粘贴逐字稿');
    const ta = modal.contentEl.createEl('textarea', { attr: { rows: '12', placeholder: '支持 SRT / VTT / 纯文本（每行一句）' } });
    ta.style.width = '100%';
    const row = modal.contentEl.createDiv();
    const ok = row.createEl('button', { text: '保存', cls: 'mod-cta' });
    ok.onclick = async () => {
      const raw = ta.value;
      if (!raw.trim()) return;
      const parsed = /-->/.test(raw) ? parseVttOrSrt(raw) : splitSentences(raw).map((t) => ({ start: 0, end: 0, text: t }));
      if (!parsed.length) return new Notice('没解析出内容');
      this.segs = parsed;
      this.transcriptInfo = { timed: /-->/.test(raw), kind: 'manual' };
      await this.plugin.saveTranscriptCache(it.id, this.segs, this.transcriptInfo);
      modal.close();
      this.render();
    };
    modal.open();
  }

  async runWhisper(it) {
    if (this.whisperJob && this.whisperJob.running) return;
    // 缓存里已经有就不重跑
    const hit = await this.plugin.readCache(it.id);
    if (hit && hit.segments && hit.segments.length) {
      this.segs = hit.segments;
      this.transcriptInfo = Object.assign({ timed: true, kind: 'whisper' }, hit.info || {});
      this.tab = 'transcript';
      const elc = this.getReaderEl();
      if (elc) { elc.empty(); this.renderReader(elc); }
      new Notice('已载入本地缓存的字幕（' + hit.segments.length + ' 句）');
      return;
    }
    const token = it.id;
    this.whisperJob = { running: true, phase: '检查环境', pct: 0, itemId: token };
    const el0 = this.getReaderEl();
    if (el0) { el0.empty(); this.renderReader(el0); }
    try {
      const segs = await this.plugin.transcribeLocal(it, (st) => {
        if (!this.whisperJob || this.whisperJob.itemId !== token) return;
        this.whisperJob = Object.assign({ running: true, itemId: token }, st);
        this.updateWhisperProgress();
      });
      if (this.itemId !== token) {
        // 用户已经切走了：只提示，不动当前界面
        this.whisperJob = null;
        new Notice('转写完成：' + segs.length + ' 句（已存进缓存，回到那一集即可看到）');
        return;
      }
      this.segs = segs;
      this.transcriptInfo = { timed: true, kind: 'whisper' };
      this.estimateOn = false;
      this.tab = 'transcript';
      this.whisperJob = null;
      const el = this.getReaderEl();
      if (el) { el.empty(); this.renderReader(el); }
      new Notice('转写完成，共 ' + segs.length + ' 句');
    } catch (e) {
      this.whisperJob = null;
      new Notice('转写失败：' + ((e && e.message) || e), 10000);
      this.log('whisper 失败 ' + ((e && e.message) || e));
      const el = this.getReaderEl();
      if (el) { el.empty(); this.renderReader(el); }
    }
  }

  updateWhisperProgress() {
    const el = this.getReaderEl();
    const box = el && el.querySelector('.er-whisper');
    if (!box) return; // 已经切到别处，不重绘干扰

    const j = this.whisperJob || {};
    const txt = box.querySelector('.er-whisper-text');
    if (txt) txt.setText((j.phase || '准备中') + ' ' + (j.pct || 0) + '%' + (j.sizeMB ? '（音频 ' + j.sizeMB + ' MB）' : ''));
    const fill = box.querySelector('.er-whisper-bar i');
    if (fill) fill.style.width = (j.pct || 0) + '%';
  }

  async loadFullText(it, btn) {
    if (btn) btn.setText('抓取中…');
    try {
      const res = await requestUrl({ url: it.link });
      const html = extractArticleHtml(res.text, it.link);
      if (!html) {
        if (btn) btn.setText('没抽到正文（页面结构特殊）');
        this.log('抓全文失败：无可识别正文 ' + it.link);
        return;
      }
      it.fullHtml = html;
      await this.plugin.saveFullText(it.id, html);
      const el = this.getReaderEl();
      if (el) { el.empty(); this.renderReader(el); }
    } catch (e) {
      if (btn) btn.setText('抓取失败');
      this.log('抓全文异常 ' + ((e && e.message) || e));
    }
  }

  speak(text) {
    if (!window.speechSynthesis) return new Notice('当前环境不支持语音合成');
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = this.data.settings.defaultRate || 1;
    const v = (window.speechSynthesis.getVoices() || []).find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }

  /** 某一句练过几次（存在 state[itemId].rec 里，随条目一起持久化） */
  recStatOf(idx) {
    const found = this.currentItem();
    if (!found) return null;
    const st = (this.data.state || {})[found.it.id] || {};
    return (st.rec || {})[String(idx)] || null;
  }

  /** 在句子行上打「练 N」徽章；练得越多颜色越深 */
  decorateSegRow(row, idx) {
    if (!row) return;
    this.syncFlagBtn(row, idx);
    const s = this.recStatOf(idx);
    let b = row.querySelector('.er-seg-badge');
    if (!s || !s.n) { if (b) b.remove(); return; }
    if (!b) {
      b = row.ownerDocument.createElement('span');
      const tools = row.querySelector('.er-seg-tools');
      if (tools) row.insertBefore(b, tools); else row.appendChild(b);
    }
    b.className = 'er-seg-badge' + (s.n >= 3 ? ' is-hot' : '') + (s.score ? ' has-score' : '');
    b.textContent = '练 ' + s.n + (s.score ? ' · ' + s.score : '');
    const bits = ['已练 ' + s.n + ' 次，最近 ' + dayKey(s.ts)];
    if (s.score) bits.push('最近得分 ' + s.score);
    b.setAttribute('title', bits.join(' · '));
  }

  /** 句子是否已进错题本 */
  hasMistake(idx) {
    const found = this.currentItem();
    if (!found) return false;
    return this.plugin.hasMistake(found.it.id, idx);
  }

  /** 小旗按钮：已标记就高亮，再点一次取消 */
  syncFlagBtn(row, idx) {
    const btn = row && row.querySelector('.er-flag-btn');
    if (!btn) return;
    const on = this.hasMistake(idx);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('title', on ? '已在错题本里，点一下取消' : '记入错题本（没听懂 / 读错的句子）');
  }

  async toggleMistake(idx, seg) {
    const found = this.currentItem();
    if (!found || !seg) return;
    const it = found.it;
    const on = this.plugin.hasMistake(it.id, idx);
    if (on) {
      await this.plugin.removeMistake(it.id, idx);
      new Notice('已从错题本移除');
    } else {
      await this.plugin.addMistake({
        itemId: it.id,
        feedId: found.feed && found.feed.id,
        itemTitle: it.title,
        idx,
        text: seg.text,
        start: seg.start || 0,
        end: seg.end || 0,
        link: it.link,
        audio: it.audio || '',
      });
      new Notice('已记入错题本 · 复习时重点听这句');
    }
    const row = this.segsEl && this.segsEl.querySelector('[data-seg="' + idx + '"]');
    if (row) this.syncFlagBtn(row, idx);
    this.refreshSideFooter();
  }

  /** 从错题本跳回原句：打开那一集，等字幕就绪后定位并高亮 */
  async jumpToMistake(itemId, idx) {
    try {
      if (this.itemId !== itemId) await this.openItem(itemId);
    } catch (e) { /* ignore */ }
    let tries = 0;
    const tick = () => {
      if (this.segs && this.segs[idx]) {
        const seg = this.segs[idx];
        this.curSeg = idx;
        const row = this.segsEl && this.segsEl.querySelector('[data-seg="' + idx + '"]');
        if (row) {
          try { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ }
          row.addClass('is-flash');
          setTimeout(() => { try { row.removeClass('is-flash'); } catch (e) { /* ignore */ } }, 1800);
        }
        if (this.audioEl) this.seek(seg.start || 0);
        return;
      }
      if (tries++ < 40) setTimeout(tick, 150);
      else new Notice('字幕还在加载，稍等一下再点一次');
    };
    tick();
  }

  /** 只重绘侧栏底部，避免打断正在播放的音频 */
  refreshSideFooter() {
    try {
      const side = this.containerEl && this.containerEl.querySelector('.er-side');
      if (!side) return;
      side.empty();
      this.renderSide(side);
    } catch (e) { /* ignore */ }
  }

  /** 记一次跟读（录音或导入都算） */
  bumpRecStat(idx, ms) {
    const found = this.currentItem();
    if (!found || idx == null || idx < 0) return;
    const id = found.it.id;
    const st = this.data.state[id] || {};
    const rec = Object.assign({}, st.rec || {});
    const key = String(idx);
    const cur = rec[key] || { n: 0, ts: 0, ms: 0 };
    rec[key] = { n: (cur.n || 0) + 1, ts: Date.now(), ms: Math.round(ms || 0) };
    this.data.state[id] = Object.assign({}, st, { rec });
    this.plugin.scheduleSave();
    const row = this.segsEl && this.segsEl.querySelector('[data-seg="' + idx + '"]');
    if (row) this.decorateSegRow(row, idx);
  }

  /* ---------------- 跟读 ---------------- */
  renderShadowBar(reader) {
    const bar = reader.createDiv('er-shadow-bar');
    this._shadowBar = bar;

    const row = bar.createDiv('er-shadow-row');
    row.createSpan({ cls: 'er-shadow-label', text: '跟读练习' });
    const curSeg = () => (this.curSeg >= 0 ? this.segs[this.curSeg] : null);

    const btnPlay = row.createEl('button', { cls: 'er-shadow-btn', text: '▶ 原句', attr: { title: '播放当前句' } });
    btnPlay.onclick = () => {
      const s = curSeg();
      if (!s) return new Notice('先播放一下，定位到当前句');
      this.seek(s.start || 0);
      const dur = (s.end || 0) - (s.start || 0);
      if (dur > 0) setTimeout(() => this.audioEl && this.audioEl.pause(), Math.max(1200, dur * 1000 + 300));
    };

    // 录音 / 停止 拆成两个按钮，状态互斥，避免误触
    const btnRec = row.createEl('button', { cls: 'er-shadow-btn er-rec-btn', text: '● 录音', attr: { title: '开始录音（录音中按 Esc 可停止）' } });
    btnRec.onclick = () => this.startRecording(curSeg());

    const btnStop = row.createEl('button', { cls: 'er-shadow-btn er-stop-btn', text: '■ 停止', attr: { title: '结束录音' } });
    btnStop.onclick = () => this.stopRecording();

    const btnMine = row.createEl('button', { cls: 'er-shadow-btn er-shadow-mine', text: '↺ 听我的', attr: { title: '回放刚才的录音' } });
    btnMine.onclick = () => {
      if (!this.recBlobUrl) return new Notice('还没有录音');
      new Audio(this.recBlobUrl).play().catch(() => new Notice('回放失败'));
    };

    // 麦克风不可用时的替代路径：导入手机/录音笔的文件
    const btnImport = row.createEl('button', {
      cls: 'er-shadow-btn er-import-btn', text: '⬆ 导入',
      attr: { title: '导入一个音频文件当作这次的录音（麦克风不可用时用）' },
    });
    btnImport.onclick = () => this.importRecording();

    const status = row.createSpan({ cls: 'er-rec-status' });

    // 跟读评分区（录完自动填）
    this._scoreBox = bar.createDiv('er-shadow-score');

    // 提示改成第二行、正常字号，不再挤在右侧
    bar.createDiv({
      cls: 'er-shadow-hint',
      text: '点某句右侧的 🎙 只录那一句；录音不播原句（想先听可点「▶ 原句」）；时长按句子长度自动放宽，可提前点「■ 停止」或按 Esc 结束。',
    });

    this._recUI = { btnRec, btnStop, btnMine, status };
    this.syncRecUI();
    this.renderShadowScore();
  }

  /** 渲染跟读评分（空 / 识别中 / 结果 / 不可用） */
  renderShadowScore() {
    const box = this._scoreBox;
    if (!box) return;
    box.empty();
    box.removeClass('is-great');
    box.removeClass('is-ok');
    box.removeClass('is-again');
    box.removeClass('is-busy');

    if (this.shadowGrading) {
      box.setText('正在识别你的跟读…（本地跑，2–4 秒）');
      box.addClass('is-busy');
      return;
    }
    const r = this.shadowResult;
    if (!r) {
      if (this.shadowError) box.setText('这次没评上：' + this.shadowError);
      else if (!this.plugin.shadowReady()) {
        box.setText('配好「本地转写」后，录完会自动打分，标出漏读、多读的词。');
      }
      return;
    }

    box.addClass('is-' + (r.level || 'ok'));
    const num = box.createDiv({ cls: 'er-sc-num', text: String(r.score) });
    num.setAttribute('title', r.score >= 90 ? '很接近原句' : r.score >= 70 ? '能听懂，但有词漏掉' : '再听一遍原句，重点补漏掉的词');
    const body = box.createDiv('er-sc-body');
    body.createDiv({ cls: 'er-sc-line', text: r.matched + ' / ' + r.total + ' 词对上 · ' + r.score + ' 分' });
    if (r.missing && r.missing.length) {
      body.createDiv({ cls: 'er-sc-miss', text: '漏了：' + r.missing.slice(0, 12).join(' ') + (r.missing.length > 12 ? ' …' : '') });
    }
    if (r.extra && r.extra.length) {
      body.createDiv({ cls: 'er-sc-extra', text: '多念：' + r.extra.slice(0, 8).join(' ') + (r.extra.length > 8 ? ' …' : '') });
    }
    if (r.heard) {
      const h = body.createDiv({ cls: 'er-sc-heard', text: '识别为：' + r.heard });
      h.setAttribute('title', '本地语音识别结果，可能有个别字听错');
    }
  }

  /** 录音落盘后自动评分；失败只是不显示分数，不影响录音本身 */
  async startShadowGrade(relPath, refText, idx) {
    if (!this.plugin.shadowReady()) return;
    this.shadowResult = null;
    this.shadowError = '';
    this.shadowGrading = true;
    this.shadowFor = idx;
    if (this.data.settings.shadowGate) this._shadowPending = idx;
    this.renderShadowScore();
    try {
      const res = await this.plugin.gradeShadow(relPath, refText);
      if (this.shadowFor !== idx) return;
      this.shadowResult = res;
      this.saveRecScore(idx, res.score);
      if (this.data.settings.shadowGate && idx === this.curSeg) {
        if (shadowAdvance(res.score, true)) {
          this._shadowPending = null;
          new Notice('跟读达标（' + res.score + ' 分），进入下一句');
          this.stepSegment(1);
        } else {
          this._shadowPending = idx;
          new Notice('这句还差一点（' + res.score + ' 分，需 70 分），再练一次');
        }
      }
    } catch (e) {
      if (this.shadowFor !== idx) return;
      this.shadowError = String((e && e.message) || e);
      this._shadowPending = null;
    } finally {
      if (this.shadowFor === idx) {
        this.shadowGrading = false;
        this.renderShadowScore();
      }
    }
  }

  /** 把分数记进 state[itemId].rec[idx]，下次打开还能看到「练 3 · 88」 */
  saveRecScore(idx, score) {
    const found = this.currentItem();
    if (!found || idx == null || idx < 0) return;
    const id = found.it.id;
    const st = this.data.state[id] || {};
    const rec = Object.assign({}, st.rec || {});
    const key = String(idx);
    const cur = rec[key] || { n: 0, ts: 0, ms: 0 };
    rec[key] = Object.assign({}, cur, { score: Math.round(score), scoreTs: Date.now() });
    this.data.state[id] = Object.assign({}, st, { rec });
    this.plugin.scheduleSave();
    const row = this.segsEl && this.segsEl.querySelector('[data-seg="' + idx + '"]');
    if (row) this.decorateSegRow(row, idx);
  }

  /** 按录音状态刷新按钮可用性与文字 */
  syncRecUI() {
    const ui = this._recUI;
    if (!ui || !ui.btnRec) return;
    const recording = this.recState === 'recording';
    try {
      ui.btnRec.disabled = recording;
      ui.btnStop.disabled = !recording;
      ui.btnMine.disabled = !this.recBlobUrl;
      if (recording) {
        const ms = Date.now() - this._recStartAt;
        const left = Math.max(0, this._recMaxMs - ms);
        ui.status.setText('录音中 ' + (ms / 1000).toFixed(1) + 's / 上限 ' + (this._recMaxMs / 1000).toFixed(0) + 's');
        ui.status.addClass('is-rec');
      } else {
        ui.status.removeClass('is-rec');
        if (this.recBlobUrl) ui.status.setText('已录 ' + (this._recLenMs / 1000).toFixed(1) + 's，点「↺ 听我的」对比');
        else ui.status.setText('');
      }
    } catch (e) { /* ignore */ }
  }

  _startRecTick() {
    this._stopRecTick();
    this._recTick = setInterval(() => {
      if (this.recState !== 'recording') return this._stopRecTick();
      if (Date.now() - this._recStartAt >= this._recMaxMs) return this.stopRecording();
      this.syncRecUI();
    }, 200);
    this._escHandler = (ev) => {
      if (ev.key === 'Escape' && this.recState === 'recording') {
        ev.preventDefault();
        this.stopRecording();
      }
    };
    document.addEventListener('keydown', this._escHandler);
  }

  _stopRecTick() {
    if (this._recTick) { clearInterval(this._recTick); this._recTick = null; }
    if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
  }

  /**
   * 估算这一句该给多长录音窗口。
   * 公式：max(词数 × 0.5s × 复杂度, 原句时长 × 1.5) + 2s 起手，再乘宽松度，限制在 8~45 秒。
   * 0.5s/词 ≈ 120 wpm，是「不流利学习者跟读」的舒适语速（母语者约 150-160 wpm）。
   */
  estimateRecWindow(seg) {
    const text = ((seg && seg.text) || '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const audioDur = seg ? Math.max(0, (seg.end || 0) - (seg.start || 0)) : 0;

    // 复杂度：长词多、带停顿标点 → 需要更久
    let factor = 1;
    if (words > 0) {
      const letters = text.replace(/[^A-Za-z'’]/g, '').length;
      if (letters / words > 5.5) factor *= 1.15;
      if (/[,;:—–()]/.test(text)) factor *= 1.1;
      const longest = text.split(/\s+/).reduce((max, w) => Math.max(max, w.replace(/[^A-Za-z'’]/g, '').length), 0);
      if (longest >= 12) factor *= 1.05;
    }

    const byWords = words * 0.5 * factor;
    const byAudio = audioDur * 1.5;
    let ms = (Math.max(byWords, byAudio) + 2) * 1000;

    const loosen = [0.85, 1, 1.25][Number(this.data.settings.recLooseness == null ? 2 : this.data.settings.recLooseness)] || 1;
    ms *= loosen;
    return Math.round(Math.min(45000, Math.max(8000, ms)));
  }

  /**
   * 打开麦克风，按「最原始 → 逐步放宽」的顺序试。
   * 有些声卡不支持关闭回声消除/指定声道数，直接给全套参数会抛 OverconstrainedError，
   * 旧版只传 { audio: true } 反而能录 —— 所以必须带降级。
   */
  async openMicStream() {
    const wantRaw = this.data.settings.recRawMic !== false;
    const attempts = [];
    if (wantRaw) {
      attempts.push({
        label: '原声采集',
        cfg: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      attempts.push({
        label: '原声采集（不指定声道）',
        cfg: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    }
    attempts.push({ label: '默认（保留浏览器语音优化）', cfg: true });

    let last = null;
    for (const a of attempts) {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: a.cfg });
        this.log('麦克风已打开：' + a.label);
        return st;
      } catch (e) {
        last = e;
        const nm = (e && e.name) || '?';
        this.log('麦克风尝试「' + a.label + '」失败：' + nm + ' ' + ((e && e.message) || ''));
        // 权限被拒 / 没有设备，换参数也没用，直接放弃，免得反复弹系统授权框
        if (nm === 'NotAllowedError' || nm === 'PermissionDeniedError' ||
            nm === 'NotFoundError' || nm === 'DevicesNotFoundError' ||
            nm === 'SecurityError') break;
      }
    }
    throw last || new Error('麦克风不可用');
  }

  /** 把 getUserMedia 的错误翻译成能照着做的提示 */
  micErrorHint(e) {
    const name = (e && e.name) || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return '麦克风权限被拒绝。到 Windows「设置 → 隐私和安全性 → 麦克风」打开「允许桌面应用访问麦克风」，' +
        '然后完全退出 Obsidian 再重开（只关窗口不算退出）。';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '没有检测到麦克风。检查耳机/麦克风是否插好，或到「声音设置 → 输入」里看设备是否被禁用。';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '麦克风被别的程序占用了（会议软件、录音软件、浏览器里的会议页面）。关掉它们再试。';
    }
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return '麦克风不支持所请求的参数（' + ((e && e.constraint) || '未知') +
        '）。已自动退回默认设置，如果仍然失败，请在设置里关掉「原声采集」。';
    }
    if (name === 'AbortError') return '设备被系统中断，重新插拔麦克风后再试。';
    if (name === 'SecurityError') return '当前窗口不允许访问麦克风，请确认没有开启严格的安全限制。';
    return (e && (e.message || e.name)) || String(e);
  }

  /** 开始录音（重复调用会被忽略，避免连点叠出多个 MediaRecorder） */
  async startRecording(seg) {
    if (this.recState === 'recording') return new Notice('正在录音，按「■ 停止」或 Esc 结束');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return new Notice('当前环境不支持录音（需要麦克风权限）');
    }

    let stream;
    try {
      stream = await this.openMicStream();
    } catch (e) {
      const hint = this.micErrorHint(e);
      this.log('麦克风打开失败：name=' + ((e && e.name) || '?') +
        ' message=' + ((e && e.message) || '') + ' constraint=' + ((e && e.constraint) || '') +
        ' | 给出提示：' + hint);
      return new Notice('无法访问麦克风：' + hint, 14000);
    }
    if (this.recState === 'recording') { stream.getTracks().forEach((t) => t.stop()); return; }

    // 录音不需要先播原句：整段录音时间都留给跟读
    // 但要把正在播放的音频停掉，否则麦克风会把原声一起录进去
    if (this.audioEl && !this.audioEl.paused) {
      try { this.audioEl.pause(); } catch (e) { /* ignore */ }
    }

    let rec;
    try {
      rec = new MediaRecorder(stream);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      return new Notice('无法创建录音器：' + ((e && e.message) || e));
    }

    this.recChunks = [];
    this._recSeg = seg || null;
    this._recSegIdx = this.curSeg;
    this._recMic = (() => {
      try {
        const t = stream.getAudioTracks()[0];
        return t && t.getSettings ? t.getSettings() : {};
      } catch (e) { return {}; }
    })();
    rec.ondataavailable = (e) => { if (e.data.size) this.recChunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (this.recBlobUrl) URL.revokeObjectURL(this.recBlobUrl);
      const mime = rec.mimeType || 'audio/webm';
      const blob = new Blob(this.recChunks, { type: mime });
      try {
        this.recBlobUrl = URL.createObjectURL(blob);
      } catch (e) { this.recBlobUrl = null; }
      this._recLenMs = Date.now() - this._recStartAt;
      this.recState = 'ready';
      this._stopRecTick();
      this.syncRecUI();

      this.finishRecording(blob, mime);
    };

    this.recorder = rec;
    this.recState = 'recording';
    this._recStartAt = Date.now();
    this._recMaxMs = this.estimateRecWindow(seg);
    rec.start();
    this._startRecTick();
    this.syncRecUI();
  }

  /** 录音结束后处理：去掉首尾静音 → 存 WAV → 写索引 */
  async finishRecording(blob, mime) {
    const mic = this._recMic || {};
    const seg = this._recSeg;

    let out = blob;
    let outMime = mime;
    let note = '';
    const trimmed = await this.trimRecording(blob);
    if (trimmed) {
      out = trimmed.blob;
      outMime = 'audio/wav';
      note = `，裁掉首尾静音 ${(trimmed.orig - trimmed.duration).toFixed(1)}s`;
    }

    this.log('录音结束 ' + mime + ' ' + blob.size + ' 字节 / ' + (this._recLenMs / 1000).toFixed(1) + 's' +
      ' 采样率=' + (mic.sampleRate || '?') + ' 声道=' + (mic.channelCount || '?') +
      ' 回声消除=' + mic.echoCancellation + ' 降噪=' + mic.noiseSuppression + ' 自动增益=' + mic.autoGainControl);
    if (trimmed) {
      this.log('已裁剪：' + (trimmed.orig / 1000).toFixed(2) + 's → ' + trimmed.duration.toFixed(2) +
        's（去掉开头 ' + (trimmed.start / trimmed.sr).toFixed(2) + 's）');
      try {
        if (this.recBlobUrl) URL.revokeObjectURL(this.recBlobUrl);
        this.recBlobUrl = URL.createObjectURL(out);
      } catch (e) { /* ignore */ }
    }

    this.bumpRecStat(this._recSegIdx, trimmed ? trimmed.duration * 1000 : this._recLenMs);

    const item = this.currentItem() ? this.currentItem().it : null;
    // 用 try/catch 而不是 .catch()：方法缺失时会同步抛，.catch 挂不上去，
    // 结果变成未处理的 rejection，整个界面跟着挂。
    let path = '';
    try {
      path = await this.plugin.saveRecording({
        item,
        segText: seg ? seg.text : '',
        segStart: seg ? seg.start : null,
        mime: outMime,
        ms: trimmed ? trimmed.duration * 1000 : this._recLenMs,
        blob: out,
      });
    } catch (e) {
      this.log('录音保存失败：' + ((e && e.message) || e));
    }
    if (path) {
      this._lastRecPath = path;
      new Notice('录音已保存' + note + '：' + path, 4500);
      // 有本地转写就顺手打个分（后台跑，不挡界面）
      if (seg && seg.text && this.plugin.shadowReady()) {
        this.startShadowGrade(path, seg.text, this._recSegIdx);
      }
    } else {
      new Notice('录音完成，点「↺ 听我的」回放对比');
    }
  }

  /** 解码 → 找到首尾静音 → 重新编码成 WAV */
  async trimRecording(blob) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ab = await blob.arrayBuffer();
      const ctx = new AC();
      const audio = await ctx.decodeAudioData(ab.slice(0));
      const data = audio.getChannelData(0);
      const sr = audio.sampleRate;
      const { start, end } = findSpeechBounds(data, sr, 0.12);
      const dur = (end - start) / sr;
      const orig = audio.duration;
      try { ctx.close && ctx.close(); } catch (e) { /* ignore */ }
      // 太短说明几乎没录到东西，保留原始文件便于排查
      if (dur < 0.15 || end <= start) return null;
      const wav = encodeWav16(data.subarray(start, end), sr);
      return { blob: new Blob([wav], { type: 'audio/wav' }), start, end, sr, duration: dur, orig };
    } catch (e) {
      this.log('裁剪失败（保留原始录音）：' + ((e && e.message) || e));
      return null;
    }
  }

  /** 选一个音频文件当录音（麦克风不可用时的替代路径） */
  importRecording() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.m4a,.wav,.ogg,.opus,.webm,.aac,.amr,.flac';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async () => {
      const f = input.files && input.files[0];
      try { input.remove(); } catch (e) { /* ignore */ }
      if (f) await this.useImportedAudio(f);
      else return;
    };
    input.click();
  }

  /** 把导入的文件当作「我的录音」：可回放、可落盘、进索引 */
  async useImportedAudio(file) {
    const name = file.name || 'imported';
    let out = file;
    let outMime = file.type || '';
    let ms = 0;
    let note = '';

    // 走同一套裁剪：去掉首尾静音，顺便转成 WAV，体积和时长都更干净
    const trimmed = await this.trimRecording(file);
    if (trimmed) {
      out = trimmed.blob;
      outMime = 'audio/wav';
      ms = trimmed.duration * 1000;
      note = '，裁掉首尾静音 ' + (trimmed.orig - trimmed.duration).toFixed(1) + 's';
    } else {
      ms = (await this.measureAudioDuration(file)) * 1000;
    }

    if (this.recBlobUrl) { try { URL.revokeObjectURL(this.recBlobUrl); } catch (e) { /* ignore */ } }
    try {
      this.recBlobUrl = URL.createObjectURL(out);
    } catch (e) { this.recBlobUrl = null; }
    this.recState = 'ready';
    this._recLenMs = ms;
    this._recSeg = this.curSeg >= 0 ? this.segs[this.curSeg] : null;
    this.syncRecUI();

    this.bumpRecStat(this.curSeg, ms);

    const extFromName = ((name.match(/\.([A-Za-z0-9]+)$/) || [])[1] || '').toLowerCase();
    const seg = this.curSeg >= 0 ? this.segs[this.curSeg] : null;
    let path = '';
    try {
      path = await this.plugin.saveRecording({
        item: this.currentItem() ? this.currentItem().it : null,
        segText: seg ? seg.text : '',
        segStart: seg ? seg.start : null,
        mime: outMime,
        ext: trimmed ? 'wav' : extFromName,
        ms,
        blob: out,
      });
    } catch (e) {
      this.log('导入录音保存失败：' + ((e && e.message) || e));
    }

    this.log('导入录音 ' + name + ' ' + out.size + ' 字节 / ' + (ms / 1000).toFixed(1) + 's -> ' + (path || '未保存'));
    new Notice('已导入「' + name + '」' + note + (path ? '\n已保存：' + path : '') +
      '\n点「↺ 听我的」回放对比', 8000);
  }

  /** 只测时长，不重编码（解码失败返回 0） */
  async measureAudioDuration(blob) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return 0;
      const ab = await blob.arrayBuffer();
      const ctx = new AC();
      const audio = await ctx.decodeAudioData(ab.slice(0));
      const d = audio.duration || 0;
      try { ctx.close && ctx.close(); } catch (e) { /* ignore */ }
      return d;
    } catch (e) {
      return 0;
    }
  }

  /** 结束录音（没有在录也安全） */
  stopRecording() {
    if (this.recorder && this.recorder.state === 'recording') {
      try { this.recorder.stop(); } catch (e) { /* ignore */ }
      return;
    }
    this.recState = this.recBlobUrl ? 'ready' : 'idle';
    this._stopRecTick();
    this.syncRecUI();
  }

  /** 兼容旧入口：已在录就停，否则开始 */
  async toggleRecord() {
    if (this.recState === 'recording') return this.stopRecording();
    await this.startRecording(this.curSeg >= 0 ? this.segs[this.curSeg] : null);
  }

  async recordShadow(seg) {
    await this.startRecording(seg);
  }

  /* ---------------- 动作分发 ---------------- */
  async onAction(act) {
    const found = this.currentItem();
    const it = found && found.it;
    switch (act) {
      case 'refresh':
        new Notice('正在刷新订阅…');
        await this.plugin.refreshAll();
        this.render();
        new Notice('刷新完成');
        break;
      case 'discover':
        new DiscoverModal(this.app, this.plugin, this).open();
        break;
      case 'settings':
        this.app.setting.open();
        this.app.setting.openTabById?.('pineapple-english');
        break;
      case 'toggleStar':
        if (!it) return;
        it.star = !it.star;
        this.data.state[it.id] = Object.assign({}, this.data.state[it.id], { star: it.star });
        await this.plugin.save();
        this.render();
        break;
      case 'toggleRead':
        if (!it) return;
        it.read = !it.read;
        this.data.state[it.id] = Object.assign({}, this.data.state[it.id], { read: it.read });
        await this.plugin.save();
        this.render();
        break;
      case 'saveNote':
        if (!it) return;
        await this.plugin.saveReadingNote(it, found.feed, this.segs);
        break;
      case 'toDaily':
        if (!it) return;
        await this.plugin.appendToDaily(`- [${it.title}](${it.link}) — ${found.feed.title}`);
        new Notice('已记到今日日记');
        break;
      case 'exportTranscript':
        if (!it) return;
        await this.plugin.exportTranscriptNote(it, found.feed, this.segs);
        break;
      case 'vocab':
        new VocabModal(this.app, this.plugin).open();
        break;
      case 'review': {
        const queue = this.plugin.dueVocab();
        if (!queue.length) new Notice('今天没有到期的词，明天再来');
        else new ReviewModal(this.app, this.plugin, queue).open();
        break;
      }
      case 'mistakes':
        new MistakeModal(this.app, this.plugin, this).open();
        break;
      case 'stats':
        new StatModal(this.app, this.plugin).open();
        break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 生词弹窗                                                             */
/* ------------------------------------------------------------------ */
class WordPopup {
  constructor(plugin, onClose) {
    this.plugin = plugin;
    this.onClose = onClose || null;
    this._closed = false;
    this.el = document.createElement('div');
    this.el.className = 'er-word-pop';
    document.body.appendChild(this.el);
    this.hide = this.hide.bind(this);
    setTimeout(() => document.addEventListener('mousedown', this.hide, true), 0);
  }

  hide(ev) {
    if (ev && this.el.contains(ev.target)) return;
    document.removeEventListener('mousedown', this.hide, true);
    try { this.el.remove(); } catch (e) { /* ignore */ }
    if (this._closed) return;
    this._closed = true;
    if (this.onClose) { try { this.onClose(); } catch (e) { /* ignore */ } }
  }

  async show(word, opts) {
    this.el.empty?.();
    this.el.innerHTML = `<div class="er-wp-head"><b>${esc(word)}</b><span class="er-wp-loading">查询中…</span></div>`;
    this.place(opts);
    const info = await lookupEnglish(word);
    const already = this.plugin.data.vocab.some((v) => v.word.toLowerCase() === word.toLowerCase());

    let defs = '';
    if (info.defs.length) {
      defs = info.defs.slice(0, 3).map((d) =>
        `<div class="er-wp-def"><i>${esc(d.pos)}</i> ${esc(d.def)}</div>`).join('');
    } else {
      defs = '<div class="er-wp-def er-dim">未收录，可能是人名/术语/变形</div>';
    }

    this.el.innerHTML = `
      <div class="er-wp-head">
        <b>${esc(word)}</b>
        <span class="er-wp-phon">${esc(info.phonetic || '')}</span>
        ${info.audio ? '<button class="er-wp-say" title="发音">🔊</button>' : ''}
      </div>
      ${info.gloss ? `<div class="er-wp-gloss">${esc(info.gloss)}</div>` : ''}
      <div class="er-wp-defs">${defs}</div>
      ${info.example ? `<div class="er-wp-ex">“${esc(info.example)}”</div>` : ''}
      <div class="er-wp-actions">
        <button class="er-wp-add ${already ? 'is-added' : ''}">${already ? '✓ 已在生词本' : '＋ 加入生词本'}</button>
        <button class="er-wp-tr">译整句</button>
      </div>
      <div class="er-wp-trbox"></div>`;

    const say = this.el.querySelector('.er-wp-say');
    if (say) say.onclick = () => { const a = new Audio(info.audio); a.play().catch(() => {}); };

    const add = this.el.querySelector('.er-wp-add');
    add.onclick = async () => {
      if (add.classList.contains('is-added')) return;
      await this.plugin.addVocab({ ...info, word, context: opts.context || '' });
      add.classList.add('is-added');
      add.setText('✓ 已加入生词本');
    };

    const tr = this.el.querySelector('.er-wp-tr');
    tr.onclick = async () => {
      const box = this.el.querySelector('.er-wp-trbox');
      box.setText('翻译中…');
      box.setText(await translateSentence(opts.context || word) || '翻译失败');
    };

    this.place(opts);
  }

  place(opts) {
    const pad = 10;
    const { innerWidth: W, innerHeight: H } = window;
    this.el.style.visibility = 'hidden';
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    const r = this.el.getBoundingClientRect();
    let left = opts.x + 12;
    let top = opts.y + 16;
    if (left + r.width > W - pad) left = Math.max(pad, W - r.width - pad);
    if (top + r.height > H - pad) top = Math.max(pad, opts.y - r.height - 12);
    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
    this.el.style.visibility = 'visible';
  }
}

/* ------------------------------------------------------------------ */
/* 生词本弹窗                                                           */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* 复习弹窗（间隔重复）                                                 */
/* ------------------------------------------------------------------ */
class ReviewModal extends Modal {
  constructor(app, plugin, queue) {
    super(app);
    this.plugin = plugin;
    this.queue = queue || plugin.dueVocab();
    this.idx = 0;
    this.revealed = false;
    this.done = 0;
    this.forgot = 0;
    this.onDone = null;
    this._key = null;
  }

  onOpen() {
    this.contentEl.addClass('er-review-modal');
    this._key = (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        if (!this.revealed) { ev.preventDefault(); this.reveal(); }
      } else if (ev.key === '1') {
        if (this.revealed) { ev.preventDefault(); this.answer(false); }
      } else if (ev.key === '2') {
        if (this.revealed) { ev.preventDefault(); this.answer(true); }
      }
    };
    document.addEventListener('keydown', this._key);
    this.render();
  }

  onClose() {
    if (this._key) document.removeEventListener('keydown', this._key);
    this.contentEl.empty();
    if (this.onDone) { try { this.onDone(); } catch (e) { /* ignore */ } }
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    const total = this.queue.length;
    if (this.idx >= total) return this.renderDone();
    const v = this.queue[this.idx];

    const head = contentEl.createDiv('er-rv-head');
    head.createSpan({ cls: 'er-rv-prog', text: (this.idx + 1) + ' / ' + total });
    head.createSpan({ cls: 'er-rv-stat', text: '记得 ' + this.done + ' · 忘了 ' + this.forgot });

    const card = contentEl.createDiv('er-rv-card');
    const line = card.createDiv('er-rv-wordline');
    line.createSpan({ cls: 'er-rv-word', text: v.word });
    if (v.audio) {
      const b = line.createEl('button', { cls: 'er-mini', text: '🔊' });
      b.onclick = () => { try { new Audio(v.audio).play().catch(() => {}); } catch (e) { /* ignore */ } };
    }
    if (v.phonetic) card.createDiv({ cls: 'er-rv-phon', text: v.phonetic });
    if (v.level) {
      card.createDiv({ cls: 'er-rv-level', text: '熟度 ' + v.level + '/' + SRS_MAX_LEVEL + ' · 已复习 ' + (v.reviews || 0) + ' 次' });
    }

    if (!this.revealed) {
      const show = contentEl.createEl('button', { cls: 'mod-cta er-rv-show', text: '显示答案（空格）' });
      show.onclick = () => this.reveal();
      return;
    }

    const ans = contentEl.createDiv('er-rv-answer');
    if (v.gloss) ans.createDiv({ cls: 'er-rv-gloss', text: v.gloss });
    for (const d of (v.defs || []).slice(0, 3)) {
      ans.createDiv({ cls: 'er-rv-def', text: (d.pos ? d.pos + '. ' : '') + (d.def || '') });
    }
    if (v.context) ans.createDiv({ cls: 'er-rv-ctx', text: '“' + v.context + '”' });
    if (v.source) ans.createDiv({ cls: 'er-rv-src', text: '— ' + v.source });

    const acts = contentEl.createDiv('er-rv-actions');
    const no = acts.createEl('button', { cls: 'er-rv-forgot', text: '忘了（1）' });
    no.onclick = () => this.answer(false);
    const yes = acts.createEl('button', { cls: 'er-rv-known mod-cta', text: '记得（2）' });
    yes.onclick = () => this.answer(true);
  }

  reveal() {
    this.revealed = true;
    this.render();
  }

  async answer(remembered) {
    const v = this.queue[this.idx];
    try { await this.plugin.reviewVocab(v.word, remembered); } catch (e) { /* ignore */ }
    if (remembered) this.done += 1; else this.forgot += 1;
    this.idx += 1;
    this.revealed = false;
    this.render();
  }

  renderDone() {
    const { contentEl } = this;
    const box = contentEl.createDiv('er-rv-done');
    box.createDiv({ cls: 'er-rv-done-title', text: '这一轮复习完了' });
    box.createDiv({ cls: 'er-rv-done-sum', text: '记得 ' + this.done + ' 个，忘了 ' + this.forgot + ' 个' });
    const left = this.plugin.dueVocab().length;
    box.createDiv({ cls: 'er-rv-done-sub', text: left ? '还有 ' + left + ' 个待复习' : '今天没有到期的词了' });
    if (this.forgot) {
      box.createDiv({ cls: 'er-rv-done-hard', text: '答错的 ' + this.forgot + ' 个词已进「易错」，下次单独练' });
    }
    const close = box.createEl('button', { cls: 'mod-cta', text: '关闭' });
    close.onclick = () => this.close();
  }
}

class VocabModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.filter = 'all';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('er-vocab-modal');
    const dueCount = this.plugin.dueVocab().length;
    contentEl.createEl('h2', {
      text: `生词本（${this.plugin.data.vocab.length}）` + (dueCount ? ` · 待复习 ${dueCount}` : ''),
    });

    const bar = contentEl.createDiv('er-vocab-bar');
    const exportBtn = bar.createEl('button', { text: '导出 CSV / Anki', cls: 'mod-cta' });
    exportBtn.onclick = () => this.plugin.exportVocabCsv();
    if (dueCount) {
      const rv = bar.createEl('button', { text: `开始复习（${dueCount}）`, cls: 'mod-cta' });
      rv.onclick = () => {
        const m = new ReviewModal(this.app, this.plugin, this.plugin.dueVocab());
        // 复习完把侧栏的「待复习」计数刷新一下（不重绘阅读区，避免播放被打断）
        m.onDone = () => {
          try {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE) || [];
            const v = leaves.length ? leaves[0].view : null;
            const side = v && v.containerEl ? v.containerEl.querySelector('.er-side') : null;
            if (side && typeof v.renderSide === 'function') { side.empty(); v.renderSide(side); }
          } catch (e) { /* ignore */ }
        };
        m.open();
      };
    }
    const openBtn = bar.createEl('button', { text: '打开生词本笔记' });
    openBtn.onclick = () => this.plugin.openVocabFile();
    const search = bar.createEl('input', { attr: { placeholder: '筛选…', type: 'search' } });

    const total = this.plugin.data.vocab.length;
    const hardCnt = this.plugin.hardVocab().length;
    const tabs = contentEl.createDiv('er-vocab-tabs');
    const tab = (key, label, title) => {
      const b = tabs.createEl('button', {
        cls: 'er-chip' + (this.filter === key ? ' is-active' : ''),
        text: label,
        attr: title ? { title } : {},
      });
      b.onclick = () => { this.filter = key; render(search.value); refreshTabs(); };
    };
    const refreshTabs = () => {
      tabs.empty();
      tab('all', '全部 ' + total);
      tab('due', '待复习 ' + dueCount);
      tab('hard', '易错 ' + hardCnt, '复习时答错过的词，答错 2 次以上或刚忘掉的');
    };

    const list = contentEl.createDiv('er-vocab-list');
    const render = (q = '') => {
      list.empty();
      let words = this.plugin.data.vocab
        .filter((v) => !q || v.word.toLowerCase().includes(q.toLowerCase()) || (v.gloss || '').includes(q));
      if (this.filter === 'due') words = words.filter((v) => this.plugin.vocabDueAt(v) <= Date.now());
      if (this.filter === 'hard') words = words.filter((v) => this.plugin.hardVocab().includes(v));
      words = words.sort((a, b) => (this.filter === 'hard'
        ? ((b.lapses || 0) - (a.lapses || 0)) || (b.ts - a.ts)
        : b.ts - a.ts));
      if (!words.length) {
        const msg = this.filter === 'hard'
          ? '还没有易错词。复习时点「忘了」的词会慢慢攒到这里。'
          : this.filter === 'due'
            ? '今天没有到期的词，明天再来。'
            : '还没有生词。阅读时点任意英文单词即可加入。';
        return list.createDiv({ cls: 'er-empty', text: msg });
      }
      for (const w of words) {
        const row = list.createDiv('er-vocab-row');
        const head = row.createDiv('er-vocab-word');
        head.createSpan({ cls: 'er-vw-text', text: w.word });
        if (w.phonetic) head.createSpan({ cls: 'er-vw-phon', text: w.phonetic });
        if (w.audio) {
          const s = head.createEl('button', { cls: 'er-mini', text: '🔊' });
          s.onclick = () => new Audio(w.audio).play().catch(() => {});
        }
        const del = head.createEl('button', { cls: 'er-mini er-vw-del', text: '✕' });
        del.onclick = async () => { await this.plugin.removeVocab(w.word); render(search.value); };
        const dueAt = this.plugin.vocabDueAt(w);
        const meta = row.createDiv('er-vw-meta');
        meta.setText('熟度 ' + (w.level || 0) + '/' + SRS_MAX_LEVEL +
          ' · 复习 ' + (w.reviews || 0) + ' 次' +
          (w.lapses ? ' · 答错 ' + w.lapses + ' 次' : '') +
          (dueAt <= Date.now() ? ' · 待复习' : ' · ' + dayKey(dueAt) + ' 再见'));
        if (dueAt <= Date.now()) meta.addClass('is-due');
        if (this.filter === 'hard' && (w.lapses || 0) >= 2) meta.addClass('is-hard');
        if (w.gloss) row.createDiv({ cls: 'er-vw-gloss', text: w.gloss });
        if (w.context) row.createDiv({ cls: 'er-vw-ctx', text: '“' + w.context + '”' });
        if (w.source) row.createDiv({ cls: 'er-vw-src', text: '— ' + w.source });
      }
    };
    refreshTabs();
    render();
    search.oninput = () => render(search.value);
  }

  onClose() { this.contentEl.empty(); }
}

/* ------------------------------------------------------------------ */
/* 错题本                                                               */
/* ------------------------------------------------------------------ */
class MistakeModal extends Modal {
  constructor(app, plugin, view) {
    super(app);
    this.plugin = plugin;
    this.view = view || null;
    this.showAll = false;
    this.playing = false;
    this._audio = null;
  }

  onOpen() {
    this.contentEl.addClass('er-mistake-modal');
    this.render();
  }

  onClose() {
    this.stopPlay();
    this.contentEl.empty();
  }

  /* ---------- 连播：只听错题这几句 ---------- */

  stopPlay() {
    this.playing = false;
    if (this._audio) {
      try { this._audio.pause(); } catch (e) { /* ignore */ }
      this._audio = null;
    }
    try {
      this.contentEl.querySelectorAll('.er-mk-row.is-playing').forEach((r) => r.removeClass('is-playing'));
      const btn = this.contentEl.querySelector('.er-mk-play');
      if (btn) btn.setText('▶ 连播待过关');
    } catch (e) { /* ignore */ }
  }

  /** 从第 startIdx 条开始，一句接一句放；每句之间停 0.9 秒 */
  async playAll(startIdx) {
    if (this.playing) return this.stopPlay();
    const list = this.plugin.listMistakes({ includeDone: this.showAll }).filter((m) => m.audio);
    if (!list.length) {
      return new Notice(this.showAll ? '这些句子没有存音频地址，只能回原文听' : '待过关的句子都没存音频地址，点「▶ 原句」回原文听');
    }
    this.playing = true;
    const btn = this.contentEl.querySelector('.er-mk-play');
    if (btn) btn.setText('■ 停止连播');

    for (let i = Math.max(0, startIdx || 0); i < list.length; i++) {
      if (!this.playing) break;
      const m = list[i];
      this.markPlaying(m.key);
      await this.playOne(m);
      if (!this.playing) break;
      await new Promise((r) => setTimeout(r, 900));
    }
    this.stopPlay();
  }

  /** 点某一行：只放这一条 */
  async playAllIndex(m) {
    if (this.playing) return this.stopPlay();
    this.playing = true;
    const btn = this.contentEl.querySelector('.er-mk-play');
    if (btn) btn.setText('■ 停止连播');
    this.markPlaying(m.key);
    await this.playOne(m);
    this.stopPlay();
  }

  markPlaying(key) {
    try {
      this.contentEl.querySelectorAll('.er-mk-row').forEach((r) => r.removeClass('is-playing'));
      const row = this.contentEl.querySelector('.er-mk-row[data-key="' + String(key).replace(/"/g, '\\"') + '"]');
      if (row) {
        row.addClass('is-playing');
        try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  /** 播一条：从 start 播到 end，播不到就 10 秒兜底 */
  playOne(m) {
    return new Promise((resolve) => {
      const a = this._audio || (this._audio = new Audio());
      let done = false;
      let guard = null;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        try {
          a.removeEventListener('timeupdate', onTime);
          a.onended = null;
          a.pause();
        } catch (e) { /* ignore */ }
        resolve();
      };
      const start = Math.max(0, m.start || 0);
      const end = (m.end && m.end > start + 0.3) ? m.end + 0.2 : start + 10;
      const onTime = () => { if (a.currentTime >= end) finish(); };
      guard = setTimeout(finish, Math.min(40000, Math.max(8000, (end - start) * 1000 + 10000)));

      const seek = () => { try { a.currentTime = start; } catch (e) { /* ignore */ } };
      if (a.dataset && a.dataset.src !== m.audio) {
        if (a.dataset) a.dataset.src = m.audio;
        a.addEventListener('loadedmetadata', seek, { once: true });
        try { a.src = m.audio; } catch (e) { return finish(); }
      } else {
        seek();
      }
      a.addEventListener('timeupdate', onTime);
      a.onended = finish;
      const pr = a.play();
      if (pr && typeof pr.catch === 'function') pr.catch(() => finish());
    });
  }

  /** 找到正在用的阅读视图（没传进来时兜底） */
  readerView() {
    if (this.view) return this.view;
    try {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE) || [];
      return leaves.length ? leaves[0].view : null;
    } catch (e) { return null; }
  }

  jump(m) {
    const v = this.readerView();
    if (!v || typeof v.jumpToMistake !== 'function') return new Notice('先打开一个阅读面板再跳转');
    this.close();
    setTimeout(() => v.jumpToMistake(m.itemId, m.idx), 60);
  }

  render() {
    const { contentEl } = this;
    if (this.playing) this.stopPlay();
    contentEl.empty();
    const open = this.plugin.listMistakes({ includeDone: false }).length;
    const total = (this.plugin.data.mistakes || []).length;

    contentEl.createEl('h2', { text: '错题本 · ' + open + ' 句待过关' });
    contentEl.createDiv({
      cls: 'er-mk-sub',
      text: '阅读时点句子右侧的 ⚑ 就能收进来。回过一次「听清了、读顺了」再点 ✓ 归档。共记录 ' + total + ' 条。',
    });

    const bar = contentEl.createDiv('er-mk-bar');
    const chip = (label, on, fn) => {
      const b = bar.createEl('button', { cls: 'er-chip' + (on ? ' is-active' : ''), text: label });
      b.onclick = fn;
    };
    chip('待过关 ' + open, !this.showAll, () => { this.showAll = false; this.render(); });
    chip('全部 ' + total, this.showAll, () => { this.showAll = true; this.render(); });
    const playBtn = bar.createEl('button', {
      cls: 'er-chip er-mk-play',
      text: '▶ 连播待过关',
      attr: { title: '只放这几句，一句接一句，不用回原集' },
    });
    playBtn.onclick = () => this.playAll(0);
    const noteBtn = bar.createEl('button', { cls: 'er-chip', text: '打开错题本笔记' });
    noteBtn.onclick = () => {
      const folder = String((this.plugin.data.settings || {}).noteFolder || 'English').replace(/\/+$/, '');
      const file = this.app.vault.getAbstractFileByPath
        ? this.app.vault.getAbstractFileByPath(folder + '/错题本.md')
        : null;
      if (file) this.app.workspace.getLeaf(true).openFile(file);
      else new Notice('还没有生成错题本笔记，先标记几句');
    };

    const list = contentEl.createDiv('er-mk-list');
    const rows = this.plugin.listMistakes({ includeDone: this.showAll });
    if (!rows.length) {
      list.createDiv({ cls: 'er-empty', text: this.showAll ? '错题本还是空的。' : '没有待过关的句子，全清了 ✓' });
      return;
    }

    for (const m of rows) {
      const row = list.createDiv('er-mk-row' + (m.done ? ' is-done' : ''));
      row.dataset.key = m.key;
      row.onclick = (ev) => {
        if (ev.target && ev.target.closest && ev.target.closest('button')) return;
        if (m.audio) this.playAllIndex(m);
        else this.jump(m);
      };
      const main = row.createDiv('er-mk-main');
      main.createDiv({ cls: 'er-mk-text', text: m.text || '（这句没存到原文）' });
      const metaBits = [];
      if (m.itemTitle) metaBits.push(m.itemTitle);
      metaBits.push('标记 ' + (m.hits || 1) + ' 次');
      metaBits.push(dayKey(m.ts));
      if (m.done) metaBits.push('已掌握');
      main.createDiv({ cls: 'er-mk-meta', text: metaBits.join(' · ') });

      const acts = row.createDiv('er-mk-acts');
      if (!m.done) {
        const go = acts.createEl('button', { cls: 'er-mini', text: '▶ 原句', attr: { title: '打开这一集并定位到这句' } });
        go.onclick = () => this.jump(m);
      }
      const okBtn = acts.createEl('button', {
        cls: 'er-mini er-mk-ok',
        text: m.done ? '↩ 撤回' : '✓ 过关',
        attr: { title: m.done ? '放回待过关' : '这句已经听清读顺了' },
      });
      okBtn.onclick = async () => {
        await this.plugin.setMistakeDone(m.key, !m.done);
        this.render();
        if (this.view && typeof this.view.refreshSideFooter === 'function') this.view.refreshSideFooter();
      };
      const del = acts.createEl('button', { cls: 'er-mini er-mk-del', text: '✕', attr: { title: '从错题本删掉' } });
      del.onclick = async () => {
        await this.plugin.removeMistake(m.itemId, m.idx);
        this.render();
        if (this.view && typeof this.view.refreshSideFooter === 'function') this.view.refreshSideFooter();
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* 打卡 / 学习统计                                                       */
/* ------------------------------------------------------------------ */
class StatModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.weeks = 12;
  }

  onOpen() {
    this.contentEl.addClass('er-stat-modal');
    this.render();
  }

  onClose() { this.contentEl.empty(); }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    const now = Date.now();
    const s = this.plugin.statsSummary(now);

    const head = contentEl.createDiv('er-st-head');
    head.createDiv({ cls: 'er-st-streak', text: String(s.streak) });
    const hx = head.createDiv('er-st-head-r');
    hx.createDiv({ cls: 'er-st-streak-unit', text: '天连续打卡' });
    hx.createDiv({
      cls: 'er-st-today',
      text: s.todayMin ? '今天 ' + s.todayMin + ' 分钟' : '今天还没开始，听 1 分钟就算打卡',
    });

    const cards = contentEl.createDiv('er-st-cards');
    const card = (v, label, tip) => {
      const c = cards.createDiv('er-st-card');
      c.createDiv({ cls: 'er-st-num', text: String(v) });
      c.createDiv({ cls: 'er-st-label', text: label });
      if (tip) c.setAttribute('title', tip);
    };
    card(s.monthMinutes + ' 分', '本月时长');
    card(s.monthItems, '本月篇数');
    card(s.totalMinutes + ' 分', '累计时长', '只算真正播放的音频时间，拖进度条不算');
    card(s.activeDays, '学习天数', '当天满 1 分钟算一天');

    if (s.monthMinutes > 0) contentEl.createDiv({ cls: 'er-st-ride', text: rideText(s.monthMinutes) });

    // 近 30 天柱状图
    const box = contentEl.createDiv('er-st-chart');
    box.createDiv({ cls: 'er-st-sec-title', text: '最近 30 天' });
    const series = statSeries(this.plugin.data, now, 30);
    const maxMin = Math.max(1, ...series.map((d) => Math.round(d.sec / 60)));
    const bars = box.createDiv('er-st-bars');
    for (const d of series) {
      const m = Math.round(d.sec / 60);
      const col = bars.createDiv('er-st-bar-col');
      const bar = col.createDiv('er-st-bar' + (m ? '' : ' is-zero') + (d.key === dayKey(now) ? ' is-today' : ''));
      bar.style.height = Math.max(m ? 4 : 2, Math.round((m / maxMin) * 64)) + 'px';
      bar.setAttribute('title', d.key + ' · ' + m + ' 分钟 · ' + (d.items || 0) + ' 篇');
    }
    bars.createDiv({ cls: 'er-st-axis' }).setText('30 天前 → 今天');

    // 近 12 周热力图
    const hm = contentEl.createDiv('er-st-chart');
    const hmHead = hm.createDiv('er-st-head-row');
    hmHead.createDiv({ cls: 'er-st-sec-title', text: this.weeks > 12 ? '全部记录' : '最近 12 周' });
    const hmBtn = hmHead.createEl('button', {
      cls: 'er-link-btn',
      text: this.weeks > 12 ? '只看 12 周' : '看全部',
      attr: { title: '按周排的热力图，一格一天' },
    });
    hmBtn.onclick = () => { this.weeks = this.weeks > 12 ? 12 : 60; this.render(); };
    const grid = hm.createDiv('er-st-heat');
    for (const col of heatmapWeeks(this.plugin.data, now, this.weeks)) {
      const c = grid.createDiv('er-st-heat-col');
      for (const cell of col) {
        const d = c.createDiv('er-st-heat-cell is-l' + cell.level + (cell.future ? ' is-future' : ''));
        d.setAttribute('title', cell.future ? '' : cell.key + ' · ' + Math.round(cell.sec / 60) + ' 分钟');
      }
    }
    const legend = hm.createDiv('er-st-legend');
    legend.createSpan({ text: '少' });
    for (let i = 0; i < 5; i++) legend.createSpan({ cls: 'er-st-heat-cell is-l' + i });
    legend.createSpan({ text: '多' });

    // 收听生物钟（近 90 天小时桶）
    const ins = this.plugin.listenInsights(now, 90);
    const ringBox = contentEl.createDiv('er-st-chart');
    renderClockRing(ringBox, ins.hours);

    // 常听节目
    const showBox = contentEl.createDiv('er-st-chart');
    showBox.createDiv({ cls: 'er-st-sec-title', text: '你把时间给了谁 · 常听节目' });
    if (!ins.shows.length) {
      showBox.createDiv({ cls: 'er-st-empty', text: '还没有按节目统计的数据，听几集就有了。' });
    } else {
      const maxShow = Math.max.apply(null, ins.shows.map((x) => x.sec).concat([1]));
      for (const sh of ins.shows) {
        const row = showBox.createDiv('er-st-show');
        row.createSpan({ cls: 'er-st-show-name', text: sh.title, attr: { title: sh.title } });
        const track = row.createDiv('er-st-show-track');
        const bar2 = track.createDiv('er-st-show-bar');
        bar2.style.width = Math.max(4, Math.round(sh.sec / maxShow * 100)) + '%';
        row.createSpan({ cls: 'er-st-show-val', text: Math.round(sh.sec / 60) + ' 分' });
      }
    }

    // 小发现
    if (ins.disc.length) {
      const discBox = contentEl.createDiv('er-st-chart');
      discBox.createDiv({ cls: 'er-st-sec-title', text: '小发现' });
      for (const d of ins.disc) {
        const row = discBox.createDiv('er-st-disc');
        row.createSpan({ cls: 'er-st-disc-k', text: d.k });
        row.createSpan({ cls: 'er-st-disc-v', text: d.v });
      }
    }

    // 耳朵的成长：盲听理解度（按周）
    const bw = blindWeeks(this.plugin.data.stats, now, 12);
    const bBox = contentEl.createDiv('er-st-chart');
    const bHead = bBox.createDiv('er-st-head-row');
    bHead.createDiv({ cls: 'er-st-sec-title', text: '耳朵的成长 · 不开字幕听懂多少' });
    bHead.createEl('button', { cls: 'er-link-btn', text: '测一次' }).onclick = () => {
      this.close();
      this.plugin.startBlindTest();
    };
    const sampled = bw.reduce((n, w) => n + w.n, 0);
    if (!sampled) {
      bBox.createDiv({ cls: 'er-st-empty', text: '还没有盲听记录。点「测一次」：随机抽 3 句，关掉字幕听，再自评听懂多少。' });
    } else {
      const bBars = bBox.createDiv('er-st-bars');
      for (const w of bw) {
        const col = bBars.createDiv('er-st-bar-col');
        const bar = col.createDiv('er-st-bar' + (w.n ? '' : ' is-zero'));
        bar.style.height = (w.n ? Math.max(4, Math.round(w.ratio * 64)) : 2) + 'px';
        bar.setAttribute('title', w.key + ' 那周 · '
          + (w.n ? '理解度 ' + Math.round(w.ratio * 100) + '% · ' + w.n + ' 句' : '没测'));
      }
      bBars.createDiv({ cls: 'er-st-axis' }).setText('12 周前 → 本周');
      bBox.createDiv({
        cls: 'er-st-note',
        text: '按自评算：听懂记 1、半懂记 0.5。样本少于 5 句的周只作参考。',
      });
    }

    const foot = contentEl.createDiv('er-st-foot');
    foot.setText('生词 ' + s.vocab + ' 个 · 其中易错 ' + s.hard + ' 个 · 错题本待过关 ' + s.mistakes + ' 句');
    const vocabBtn = foot.createEl('button', { cls: 'er-link-btn', text: '看生词' });
    vocabBtn.onclick = () => { this.close(); new VocabModal(this.app, this.plugin).open(); };
  }
}

/* ------------------------------------------------------------------ */
/* 发现订阅                                                             */
/* ------------------------------------------------------------------ */
/** 首次使用引导：说明核心功能无需配置、逐句文本来源、可选增强在哪配 */
/** 盲听测试弹窗：不显示任何字幕，只放声音，听完自评 */
class BlindModal extends Modal {
  constructor(app, plugin, item, segs, sample) {
    super(app);
    this.plugin = plugin;
    this.item = item || {};
    this.segs = segs || [];
    this.picked = sample || [];
    this.idx = 0;
    this.results = [];
    this.replayLeft = {};
    this.phase = 'intro';
    this.audio = null;
    this.summary = null;
    this.showText = false;
  }

  onOpen() {
    this.contentEl.addClass('er-blind');
    this.render();
  }

  onClose() {
    this.stopAudio();
    this.contentEl.empty();
  }

  stopAudio() {
    if (!this.audio) return;
    try { this.audio.pause(); } catch (e) { /* ignore */ }
    if (this._onTick) {
      try { this.audio.removeEventListener('timeupdate', this._onTick); } catch (e) { /* ignore */ }
    }
    this._onTick = null;
  }

  ensureAudio() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'metadata';
    }
    return this.audio;
  }

  playCurrent() {
    const segIdx = this.picked[this.idx];
    const seg = this.segs[segIdx];
    if (!seg) return;
    if (!this.item.audio) { new Notice('这一集没有音频'); return; }
    this.stopAudio();
    const a = this.ensureAudio();
    const start = Math.max(0, (Number(seg.start) || 0) - 0.15);
    const stop = start + Math.max(0.8, segSpan(seg)) + 0.25;
    a.src = this.item.audio;
    try { a.currentTime = start; } catch (e) { /* ignore */ }
    this._onTick = () => {
      if (a.currentTime >= stop) {
        try { a.pause(); } catch (e) { /* ignore */ }
        if (this._onTick) a.removeEventListener('timeupdate', this._onTick);
        this._onTick = null;
        this.phase = 'judge';
        this.render();
      }
    };
    a.addEventListener('timeupdate', this._onTick);
    const p = a.play();
    if (p && p.catch) p.catch(() => new Notice('音频播放失败，检查网络或音频链接'));
  }

  judge(kind) {
    if (kind !== 'skip') this.results.push(kind);
    this.idx += 1;
    if (this.idx >= this.picked.length) {
      this.summary = this.plugin.recordBlind(this.item.id, this.results);
      this.phase = 'done';
      this.render();
      return;
    }
    this.phase = 'play';
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const head = el.createDiv('er-blind-head');
    head.createDiv({ cls: 'er-blind-title', text: '盲听测试' });
    head.createDiv({ cls: 'er-blind-sub', text: String(this.item.title || '').slice(0, 44) });

    const dots = el.createDiv('er-blind-dots');
    for (let i = 0; i < this.picked.length; i++) {
      const r = this.results[i];
      let cls = 'er-blind-dot';
      if (r === 'g') cls += ' is-g';
      else if (r === 'h') cls += ' is-h';
      else if (r === 'x') cls += ' is-x';
      else if (this.phase !== 'done' && i === this.idx) cls += ' is-cur';
      dots.createDiv({ cls });
    }

    if (this.phase === 'intro') {
      el.createEl('p', { cls: 'er-blind-lead', text: '随机抽 3 句，只放声音、不显示字幕。听完凭第一感觉自评，不必纠结每个词。' });
      el.createEl('p', { cls: 'er-hint', text: '大约 40 秒。中途关掉不计入；同一集每天只记一次。' });
      const row = el.createDiv('er-blind-actions');
      row.createEl('button', { cls: 'mod-cta', text: '开始' }).onclick = () => { this.phase = 'play'; this.render(); };
      row.createEl('button', { text: '取消' }).onclick = () => this.close();
      return;
    }

    if (this.phase === 'play') {
      el.createDiv({ cls: 'er-blind-step', text: '第 ' + (this.idx + 1) + ' / ' + this.picked.length + ' 句' });
      el.createDiv({ cls: 'er-blind-hint', text: '字幕已隐藏，点下面播放。' });
      const row = el.createDiv('er-blind-actions');
      row.createEl('button', { cls: 'mod-cta', text: '播放这一句' }).onclick = () => this.playCurrent();
      row.createEl('button', { text: '跳过这句' }).onclick = () => this.judge('skip');
      return;
    }

    if (this.phase === 'judge') {
      el.createDiv({ cls: 'er-blind-step', text: '刚才那句听懂了多少？' });
      el.createDiv({ cls: 'er-blind-hint', text: '按第一感觉点，别回想文字。' });
      const judgeRow = el.createDiv('er-blind-judge');
      judgeRow.createEl('button', { cls: 'is-g', text: '听懂了' }).onclick = () => this.judge('g');
      judgeRow.createEl('button', { cls: 'is-h', text: '半懂' }).onclick = () => this.judge('h');
      judgeRow.createEl('button', { cls: 'is-x', text: '没懂' }).onclick = () => this.judge('x');
      const row = el.createDiv('er-blind-actions');
      if (!this.replayLeft[this.idx]) {
        row.createEl('button', { text: '再听一遍（限 1 次）' }).onclick = () => {
          this.replayLeft[this.idx] = 1;
          this.phase = 'play';
          this.render();
          this.playCurrent();
        };
      }
      row.createEl('button', { text: '跳过这句' }).onclick = () => this.judge('skip');
      return;
    }

    const s = this.summary;
    const box = el.createDiv('er-blind-summary');
    if (!s) {
      box.createDiv({ cls: 'er-blind-score', text: '未计入' });
      box.createDiv({ cls: 'er-hint', text: '有效作答不足 2 句，本次不记录。' });
    } else {
      box.createDiv({ cls: 'er-blind-score', text: Math.round(blindRatio(s) * 100) + '%' });
      const skipped = this.picked.length - s.n;
      box.createDiv({
        cls: 'er-hint',
        text: '本次 ' + s.n + ' 句：听懂 ' + s.g + ' · 半懂 ' + s.h + ' · 没懂 ' + s.x
          + (skipped > 0 ? '（跳过 ' + skipped + ' 句，未计入）' : ''),
      });
    }
    const row = el.createDiv('er-blind-actions');
    row.createEl('button', { text: this.showText ? '收起原文' : '看这三句原文' }).onclick = () => {
      this.showText = !this.showText;
      this.render();
    };
    row.createEl('button', { cls: 'mod-cta', text: '完成' }).onclick = () => this.close();

    if (this.showText) {
      const list = el.createDiv('er-blind-text');
      for (const i of this.picked) {
        list.createDiv({ cls: 'er-blind-line', text: String((this.segs[i] && this.segs[i].text) || '') });
      }
    }
  }
}

class WelcomeModal extends Modal {
  constructor(app, plugin, stats) {
    super(app);
    this.plugin = plugin;
    this.stats = stats || { ok: 0, fail: 0, total: 0 };
  }

  onOpen() {
    const el = this.contentEl;
    el.empty();
    const name = (this.plugin && this.plugin.manifest && this.plugin.manifest.name) || '菠萝精听';
    el.createEl('h2', { text: '欢迎使用 ' + name });

    el.createEl('p', {
      text: '核心功能开箱即用：点开一篇就能逐句精听——单击播放、双击查词、单句循环、跟读打分，都不需要任何额外配置。',
    });

    const s = this.stats;
    if (s.total) {
      const msg = s.fail === 0
        ? '已为你预置 ' + s.ok + ' 个学习源，现在就能开始听。'
        : '已就绪 ' + s.ok + ' 个源；' + s.fail + ' 个源暂时连不上（大陆网络下很常见）。这不影响使用——点「发现订阅」挑标注「大陆可直连」的源即可。';
      el.createEl('p', { cls: s.fail ? 'er-welcome-warn' : 'er-welcome-ok', text: msg });
    }

    el.createEl('h3', { text: '逐句文本从哪来？' });
    const ul = el.createEl('ul');
    ul.createEl('li', { text: '多数学习源自带文字稿，打开就逐句高亮，无需设置。' });
    ul.createEl('li', { text: '没有字幕的节目，可以手动粘贴 SRT / VTT 字幕来做逐句精听。' });
    ul.createEl('li', { text: '想要「自动转写」属于可选增强：需要本机 Python 环境，不是必需的。' });

    el.createEl('h3', { text: '想开自动转写 / 跟读打分加速？' });
    el.createEl('p', {
      cls: 'er-hint',
      text: '最简单：到 设置 → 第三方插件 → ' + name + '，点最上面的「一键安装本地转写」，插件会自动装好依赖、脚本和模型，全程在本机完成。不想配也完全不影响使用。',
    });

    const row = el.createDiv('er-welcome-btns');
    row.createEl('button', { cls: 'mod-cta', text: '开始使用' }).onclick = () => this.close();
    const go = row.createEl('button', { text: '打开设置（可选）' });
    go.onclick = () => {
      this.close();
      try { this.app.setting.open(); this.app.setting.openPluginById(this.plugin.manifest.id); } catch (e) { /* 兼容版本差异 */ }
    };
  }

  onClose() { this.contentEl.empty(); }
}

class DiscoverModal extends Modal {
  constructor(app, plugin, view) {
    super(app);
    this.plugin = plugin;
    this.view = view;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '发现订阅' });
    contentEl.createEl('p', {
      cls: 'er-hint',
      text: '选中即订阅。也可以直接粘贴任意 RSS / Atom 地址（播客、Substack、个人博客都行）。',
    });

    // 一键订阅：核心 4 个（快）+ 全部（慢），都是实测大陆可直连
    const learnList = PRESETS.filter((x) => x.group.startsWith('英语学习'));
    const CORE = CORE_TITLES;
    const quickRow = contentEl.createDiv('er-quick-row');

    const doSubscribe = async (list, btn) => {
      const old = btn.textContent;
      btn.setText('订阅中…（' + list.length + ' 个）');
      btn.disabled = true;
      let n = 0;
      for (const p of list) {
        if (this.plugin.data.feeds.some((f) => f.url === p.url)) continue;
        const ok = await this.plugin.addFeed(p.url, p.title, p.kind, false, p.group);
        if (ok) n++;
        btn.setText('订阅中… ' + n + '/' + list.length);
      }
      btn.disabled = false;
      btn.setText(n ? `已订阅 ${n} 个` : old);
      if (n) new Notice('已订阅 ' + n + ' 个源，正在拉取列表…');
      this.view.render();
    };

    const quick = quickRow.createEl('button', { cls: 'mod-cta er-quick-sub', text: '一键订阅核心 4 个英语学习源（大陆可直连）' });
    quick.onclick = () => doSubscribe(learnList.filter((x) => CORE.includes(x.title)), quick);

    const quickAll = quickRow.createEl('button', {
      cls: 'er-quick-sub',
      text: `订阅全部 ${learnList.length} 个学习源`,
      attr: { title: `一次拉 ${learnList.length} 个 feed，会慢一点；建议先订核心 4 个，剩下的按需挑` },
    });
    quickAll.onclick = () => doSubscribe(learnList, quickAll);

    const addRow = contentEl.createDiv('er-add-row');
    const input = addRow.createEl('input', { attr: { placeholder: 'https://example.com/feed.xml', type: 'url' } });
    const addBtn = addRow.createEl('button', { text: '添加', cls: 'mod-cta' });
    addBtn.onclick = async () => {
      const url = input.value.trim();
      if (!/^https?:\/\//.test(url)) return new Notice('请填写完整地址');
      addBtn.setText('添加中…');
      const ok = await this.plugin.addFeed(url);
      addBtn.setText('添加');
      if (ok) { input.value = ''; new Notice('已订阅'); this.view.render(); }
    };

    const groups = {};
    for (const p of PRESETS) (groups[p.group] = groups[p.group] || []).push(p);
    for (const [g, arr] of Object.entries(groups)) {
      contentEl.createEl('h3', { text: g });
      for (const p of arr) {
        const row = contentEl.createDiv('er-discover-row');
        const info = row.createDiv('er-discover-info');
        info.createSpan({ cls: 'er-discover-title', text: p.title });
        info.createSpan({ cls: 'er-discover-note', text: p.note });
        const subscribed = this.plugin.data.feeds.some((f) => f.url === p.url);
        const b = row.createEl('button', { text: subscribed ? '已订阅' : '订阅', cls: subscribed ? 'is-disabled' : 'mod-cta' });
        if (subscribed) b.disabled = true;
        b.onclick = async () => {
          b.setText('订阅中…');
          const ok = await this.plugin.addFeed(p.url, p.title, p.kind, false, p.group);
          b.setText(ok ? '已订阅' : '失败');
          if (ok) this.view.render();
        };
      }
    }
  }

  onClose() { this.contentEl.empty(); }
}

/* ------------------------------------------------------------------ */
/* 设置面板                                                             */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* 可选增强状态：只读探测，不下载、不写文件、不启动进程                  */
/* 社区市场只安装三件套，这里把「缺什么、会怎样、怎么补」讲清楚          */
/* ------------------------------------------------------------------ */
function optionalAddons(plugin) {
  const st = (plugin && plugin.data && plugin.data.settings) || {};
  const out = {
    desktop: !Platform.isMobile,
    asrConfigured: !!(st.whisperDir && st.whisperPython && st.whisperModelDir),
    shadow: false,
  };
  try {
    if (out.desktop) {
      const fs = require('fs');
      const pathMod = require('path');
      const dir = plugin && plugin.manifest && plugin.manifest.dir;
      if (dir) out.shadow = fs.existsSync(pathMod.join(dir, 'shadow_server.py'));
    }
  } catch (e) { /* 探测失败一律视为未就位，不影响主流程 */ }
  return out;
}

/** 本地转写 3 步配置：设置页与欢迎页共用一份文案，避免两处走样 */
const ASR_SETUP = {
  pip: 'pip install faster-whisper',
  dlLabel: '下载 transcribe.py',
  dlUrl: 'https://raw.githubusercontent.com/louiseleeAI/pineapple-english/main/extras/transcribe.py',
  mdlLabel: '模型下载页',
  mdlUrl: 'https://huggingface.co/Systran/faster-whisper-base.en/tree/main',
  steps: [
    '① 装依赖：命令行执行 pip install faster-whisper（Python 3.10+，建议建独立虚拟环境）。',
    '② 放脚本：点「下载 transcribe.py」，存到任意文件夹，把该文件夹路径填进「转写脚本目录」。',
    '③ 下模型：base.en 约 145MB。点「模型下载页」手动下载，把含 model.bin 的文件夹填进「模型目录」；首次转写也会尝试自动下载。'
  ],
};

/* ==================================================================
   一键安装本地转写（英语版 · faster-whisper）
   社区市场只装三件套，故脚本以字符串内嵌；安装器在本机建 venv、
   装依赖、下载模型并自动填好设置，全程不上传任何数据。
   ================================================================== */
/* >>> ASR_WIZARD_BEGIN */
const ASR_WIZARD = {
  pipIndex: 'https://pypi.tuna.tsinghua.edu.cn/simple',
  pkgs: 'faster-whisper==1.2.1',
  modelRepo: 'Systran/faster-whisper-base.en',
  modelFiles: [
    ['config.json', 2227, 'config.json', 'f3bc3821e9fc76a27bae538e11ae5b677dcdd352b4600429ce7951d398569aeb'],
    ['tokenizer.json', 2128466, 'tokenizer.json', '929c5252409436dce1b38a75d1abbcb5e132d170d8e324e4e04ed915fa2d22df'],
    ['vocabulary.txt', 422309, 'vocabulary.txt', 'ff77588746d3a2595d32ab5b69ffd7b95ce2441ac57533cb66fc3eb575a115cf'],
    ['model.bin', 145216508, 'model.bin', '2a166925539a16005f14ff328359f9b9adb9dc4fb631bb3b227526862e93e2ef'],
  ],
  mirrorBases: [
    'https://hf-mirror.com/',
    'https://huggingface.co/',
  ],
  // transcribe.py 内嵌副本（与 extras/transcribe.py 一致）
  script: "\"\"\"\nEnglish Reader \u2014 \u672c\u5730\u8f6c\u5199\u811a\u672c\uff08faster-whisper\uff09\n\n\u7528\u6cd5:\n    python transcribe.py <\u97f3\u9891\u8def\u5f84> <\u8f93\u51faSRT\u8def\u5f84> <\u6a21\u578b\u76ee\u5f55> [\u7ebf\u7a0b\u6570]\n\n\u8f93\u51fa:\n    stdout \u6bcf\u884c PROGRESS <0-100> \u8868\u793a\u8fdb\u5ea6\uff0c\u6700\u540e\u8f93\u51fa DONE <\u53e5\u6570>\n    \u5931\u8d25\u65f6 stderr \u8f93\u51fa\u9519\u8bef\u5e76\u8fd4\u56de\u975e 0\n\"\"\"\nimport sys\nimport os\nimport time\n\ndef fmt_ts(sec):\n    if sec < 0:\n        sec = 0\n    ms = int(round(sec * 1000))\n    h, ms = divmod(ms, 3600000)\n    m, ms = divmod(ms, 60000)\n    s, ms = divmod(ms, 1000)\n    return \"%02d:%02d:%02d,%03d\" % (h, m, s, ms)\n\ndef main():\n    if len(sys.argv) < 4:\n        sys.stderr.write(\"usage: transcribe.py <audio> <out.srt> <model_dir> [threads]\\n\")\n        return 2\n\n    audio = sys.argv[1]\n    out_srt = sys.argv[2]\n    model_dir = sys.argv[3]\n    threads = int(sys.argv[4]) if len(sys.argv) > 4 else 8\n\n    if not os.path.exists(audio):\n        sys.stderr.write(\"audio not found: %s\\n\" % audio)\n        return 3\n    if not os.path.isdir(model_dir):\n        sys.stderr.write(\"model dir not found: %s\\n\" % model_dir)\n        return 4\n\n    # \u79bb\u7ebf\u6a21\u5f0f\uff1a\u7981\u6b62\u8054\u7f51\u627e\u6a21\u578b\n    os.environ.setdefault(\"HF_HUB_OFFLINE\", \"1\")\n    os.environ.setdefault(\"TRANSFORMERS_OFFLINE\", \"1\")\n\n    from faster_whisper import WhisperModel\n\n    t0 = time.time()\n    model = WhisperModel(\n        model_dir,\n        device=\"cpu\",\n        compute_type=\"int8\",\n        cpu_threads=threads,\n        num_workers=1,\n    )\n    segments, info = model.transcribe(\n        audio,\n        language=\"en\",\n        beam_size=1,\n        vad_filter=True,\n        vad_parameters=dict(min_silence_duration_ms=500),\n        condition_on_previous_text=False,\n    )\n\n    total = float(getattr(info, \"duration\", 0) or 0)\n    sys.stdout.write(\"TOTAL %.2f\\n\" % total)\n    sys.stdout.flush()\n\n    lines = []\n    n = 0\n    last_pct = -1\n    for seg in segments:\n        n += 1\n        text = (seg.text or \"\").strip()\n        if text:\n            lines.append(\n                \"%d\\n%s --> %s\\n%s\\n\" % (n, fmt_ts(seg.start), fmt_ts(seg.end), text)\n            )\n        if total > 0:\n            pct = min(99, int(seg.end / total * 100))\n            if pct != last_pct:\n                last_pct = pct\n                sys.stdout.write(\"PROGRESS %d\\n\" % pct)\n                sys.stdout.flush()\n\n    with open(out_srt, \"w\", encoding=\"utf-8\") as f:\n        f.write(\"\\n\".join(lines))\n\n    sys.stdout.write(\"PROGRESS 100\\n\")\n    sys.stdout.write(\"DONE %d %.1f\\n\" % (len(lines), time.time() - t0))\n    sys.stdout.flush()\n    return 0\n\nif __name__ == \"__main__\":\n    sys.exit(main())\n",
};

function asrWizardBaseDir(pluginId, platform, env) {
  const os = require('os');
  const path = require('path');
  const plat = platform || process.platform;
  const e = env || process.env;
  const home = os.homedir();
  let root;
  if (plat === 'win32') root = e.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  else if (plat === 'darwin') root = path.join(home, 'Library', 'Application Support');
  else root = e.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const id = String(pluginId || 'pineapple').replace(/[^A-Za-z0-9._-]/g, '_');
  return path.join(root, 'pineapple-asr', id);
}

function asrWizardUrl(file) {
  return ASR_WIZARD.mirrorBases[0] + ASR_WIZARD.modelRepo + '/resolve/main/' + file;
}

/** 探测可用 Python：返回 {exe, version} 或 null。优先系统 PATH，再试 py -3。 */
function asrWizardDetectPython() {
  const { spawnSync } = require('child_process');
  const tries = [
    ['python', ['--version']],
    ['python3', ['--version']],
    ['py', ['-3', '--version']],
  ];
  const out = [];
  for (const [exe, args] of tries) {
    try {
      const r = spawnSync(exe, args, { encoding: 'utf8', timeout: 8000 });
      const ver = ((r.stdout || '') + (r.stderr || '')).trim();
      if (r.status === 0 && /Python\s+3\.\d+/.test(ver)) {
        return { exe, version: ver };
      }
      if (ver) out.push(exe + ': ' + ver.slice(0, 60));
    } catch (e) { /* 该命令不存在，继续试下一个 */ }
  }
  return { error: out.join(' | ') || '没找到 Python 3' };
}

/** 用 Node 原生 https 下载文件（带重定向、进度回调），不依赖 Obsidian 网络层。 */
/** 流式计算文件 SHA256，避免大文件一次读入内存。 */
function asrWizardSha256(file) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (c) => hash.update(c));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function asrWizardDownload(url, dest, onBytes) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const fs = require('fs');
    const fetch = (u, redirects) => {
      if (redirects > 5) return reject(new Error('下载重定向过多'));
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return fetch(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode + '：' + u));
        }
        const tmp = dest + '.part';
        const file = fs.createWriteStream(tmp);
        let got = 0;
        res.on('data', (chunk) => {
          got += chunk.length;
          if (onBytes) onBytes(got, Number(res.headers['content-length'] || 0));
        });
        res.on('error', (e) => { try { file.close(); } catch (_) {} reject(e); });
        file.on('error', (e) => { res.destroy(); reject(e); });
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            try { fs.renameSync(tmp, dest); resolve(got); }
            catch (e) { reject(e); }
          });
        });
      }).on('error', reject);
    };
    fetch(url, 0);
  });
}

/** 跑一条子进程命令，把输出逐行回调给进度面板。 */
function asrWizardRun(exe, args, opts, onLine) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const child = spawn(exe, args, opts || {});
    let tail = '';
    const push = (buf) => {
      const s = String(buf || '');
      tail = (tail + s).slice(-4000);
      const lines = tail.split(/\r?\n/);
      tail = lines.pop() || '';
      for (const line of lines) if (onLine) onLine(line.trim());
    };
    child.stdout && child.stdout.on('data', push);
    child.stderr && child.stderr.on('data', push);
    child.on('error', reject);
    child.on('close', (code) => {
      if (onLine && tail.trim()) onLine(tail.trim());
      if (code === 0) resolve(tail); else reject(new Error('命令退出码 ' + code));
    });
  });
}

class AsrWizardModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.cancelled = false;
    this.child = null;
  }

  onOpen() {
    const el = this.contentEl;
    el.empty();
    el.addClass('er-wizard');
    el.createEl('h2', { text: '一键安装本地转写' });
    el.createEl('p', { cls: 'er-wizard-lead',
      text: '全程在本机完成：装 Python 依赖、下载脚本与模型，不上传任何音频或笔记。约 150 MB 下载，首次几分钟。' });
    this.statusEl = el.createEl('div', { cls: 'er-wizard-status', text: '准备就绪，点下面开始。' });
    this.bar = el.createEl('div', { cls: 'er-wizard-bar' });
    this.barFill = this.bar.createDiv({ cls: 'er-wizard-bar-fill' });
    this.logEl = el.createEl('div', { cls: 'er-wizard-log' });
    const btns = el.createDiv({ cls: 'er-wizard-btns' });
    this.startBtn = btns.createEl('button', { cls: 'mod-cta', text: '开始安装' });
    this.startBtn.onclick = () => this.run();
    this.cancelBtn = btns.createEl('button', { text: '取消' });
    this.cancelBtn.onclick = () => { this.cancelled = true; if (this.child) { try { this.child.kill(); } catch (_) {} } this.status('已取消。'); };
    this.doneBtn = btns.createEl('button', { text: '完成' });
    this.doneBtn.onclick = () => this.close();
    this.doneBtn.style.display = 'none';
  }

  status(s) { if (this.statusEl) this.statusEl.textContent = s; }
  log(s) {
    if (!this.logEl) return;
    const line = this.logEl.createDiv({ cls: 'er-wizard-line', text: String(s).slice(0, 300) });
    this.logEl.scrollTop = this.logEl.scrollHeight;
    return line;
  }
  pct(p) { if (this.barFill) this.barFill.style.width = Math.max(0, Math.min(100, p)) + '%'; }

  async run() {
    if (this.busy) return;
    this.busy = true;
    this.cancelled = false;
    this.startBtn.disabled = true;
    this.logEl.empty();
    const fs = require('fs');
    const path = require('path');
    try {
      // 1) Python
      this.status('① 检测 Python…'); this.pct(5);
      const py = asrWizardDetectPython();
      if (!py || !py.exe) throw new Error('没找到 Python 3。请先到 python.org 下载安装（安装时勾选 Add Python to PATH），装完再点开始。' + (py && py.error ? '\n' + py.error : ''));
      this.log('Python：' + py.exe + '（' + py.version + '）');

      const base = asrWizardBaseDir(this.plugin.manifest && this.plugin.manifest.id);
      const dir = base.replace(/\\/g, '/');
      const modelDir = (base + '/model').replace(/\\/g, '/');
      fs.mkdirSync(modelDir, { recursive: true });

      // 2) venv
      this.status('② 创建独立环境…'); this.pct(15);
      const venv = path.join(base, '.venv');
      const pyInVenv = (process.platform === 'win32')
        ? path.join(venv, 'Scripts', 'python.exe')
        : path.join(venv, 'bin', 'python');
      if (!fs.existsSync(pyInVenv)) {
        await asrWizardRun(py.exe, ['-m', 'venv', venv], {}, (l) => this.log(l));
      }
      if (this.cancelled) throw new Error('已取消');
      this.log('虚拟环境：' + pyInVenv);

      // 3) pip
      this.status('③ 安装依赖（清华源，约 1-2 分钟）…'); this.pct(30);
      await asrWizardRun(pyInVenv, ['-m', 'pip', 'install', '-i', ASR_WIZARD.pipIndex, ASR_WIZARD.pkgs],
        {}, (l) => this.log(l));
      if (this.cancelled) throw new Error('已取消');

      // 4) 脚本
      this.status('④ 写入转写脚本…'); this.pct(48);
      fs.writeFileSync(path.join(base, 'transcribe.py'), ASR_WIZARD.script, 'utf8');
      this.log('脚本：' + (base + '/transcribe.py').replace(/\\/g, '/'));

      // 5) 模型
      this.status('⑤ 下载模型（约 145 MB）…');
      for (let i = 0; i < ASR_WIZARD.modelFiles.length; i++) {
        if (this.cancelled) throw new Error('已取消');
        const [name, , dest, sha] = ASR_WIZARD.modelFiles[i];
        const target = path.join(modelDir, dest);
        if (fs.existsSync(target)) {
          const gotHash = await asrWizardSha256(target);
          if (gotHash !== sha) {
            this.log(name + ' 校验失败（文件损坏），删除后重新下载');
            fs.unlinkSync(target);
          }
        }
        if (!fs.existsSync(target)) {
          this.log('下载 ' + name + '…');
          await asrWizardDownload(asrWizardUrl(name), target, (got, total) => {
            const basePct = 48 + Math.round((i + (total ? got / total : 0)) / ASR_WIZARD.modelFiles.length * 42);
            this.pct(basePct);
            if (total) this.status('⑤ 下载模型 ' + name + ' ' + Math.round(got / total * 100) + '%');
          });
          const gotHash = await asrWizardSha256(target);
          if (gotHash !== sha) {
            try { fs.unlinkSync(target); } catch (_) {}
            throw new Error(name + ' 校验失败：下载文件与官方指纹不符，已删除。请检查网络后重试。');
          }
          this.log(name + ' ✓ 校验通过');
        }
      }
      if (this.cancelled) throw new Error('已取消');

      // 6) 写设置
      this.status('⑥ 保存设置并检测…'); this.pct(92);
      this.plugin.data.settings.whisperDir = dir;
      this.plugin.data.settings.whisperPython = pyInVenv.replace(/\\/g, '/');
      this.plugin.data.settings.whisperModelDir = modelDir;
      await this.plugin.save();
      const r = await this.plugin.checkWhisper();
      if (!r.ok) throw new Error('安装完成但检测未通过：' + (r.err || '未知原因'));

      this.status('✓ 安装完成！没有字幕的节目现在可以点「本地转写这一集」了。');
      this.log('就绪：' + r.exe);
      this.pct(100);
      new Notice('✓ 本地转写安装完成，可以开始使用了');
    } catch (e) {
      const msg = String((e && e.message) || e);
      this.status('安装失败：' + msg.split('\n')[0]);
      this.log('错误：' + msg.replace(/\n/g, ' | '));
      new Notice('本地转写安装失败：' + msg.split('\n')[0], 10000);
    } finally {
      this.busy = false;
      if (this.startBtn) { this.startBtn.disabled = false; this.startBtn.setText('重试'); }
      if (this.doneBtn) this.doneBtn.style.display = '';
    }
  }
}
/* <<< ASR_WIZARD_END */

class EnglishReaderSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: '菠萝英语精听 设置' });
    const ver = (this.plugin.manifest && this.plugin.manifest.version) || '未知';
    const fbox = containerEl.createDiv('er-feedback');
    fbox.createEl('div', { cls: 'er-feedback-title', text: '反馈与支持' });
    fbox.createEl('div', { cls: 'er-feedback-desc', text: '遇到问题或有建议，直接提交报告，作者能看得到；使用上的疑问也可以去讨论区交流。' });
    const facts = fbox.createDiv('er-feedback-actions');
    facts.createEl('button', { cls: 'mod-cta', text: '报告问题 / 提建议' }).onclick = () => {
      window.open(feedbackIssueUrl(ver), '_blank');
    };
    facts.createEl('button', { text: '去讨论区提问' }).onclick = () => {
      window.open(FEEDBACK_DISCUSS, '_blank');
    };
    fbox.createEl('div', { cls: 'er-feedback-ver', text: '当前版本 ' + ver + ' · 提交时会自动带上版本与系统信息' });
    // 可选增强状态：社区市场只装三件套，把缺失项与补齐方式直接摆出来
    const add = optionalAddons(this.plugin);
    const addBox = containerEl.createEl('div', { cls: 'er-addons' });
    addBox.createEl('div', { cls: 'er-addons-title', text: '可选增强状态（社区插件市场安装说明）' });
    const addList = addBox.createEl('div', { cls: 'er-addons-list' });
    const addLine = (label, good, hint) => addList.createEl('div', {
      cls: 'er-addons-line', text: (good ? '✓ ' : '○ ') + label + '：' + hint,
    });
    addLine('本地 Whisper 转写', add.asrConfigured,
      add.asrConfigured ? '已配置' : '未配置（可选）→ 没字幕的节目手动粘贴 SRT/VTT 即可');
    addLine('常驻识别 / 跟读打分加速', add.shadow,
      add.shadow ? '已就位' : '缺 shadow_server.py → 自动退回单次转写，打分仍可用');
    addBox.createEl('div', {
      cls: 'er-addons-note',
      text: '核心功能不依赖以上任何文件。市场安装只含 main.js / manifest.json / styles.css；' +
            '需要增强时从仓库 extras/ 手动放置脚本并在下方填路径，插件不会自动下载或安装依赖。',
    });
    const quick = addBox.createEl('div', { cls: 'er-addons-quick' });
    quick.createEl('div', { cls: 'er-addons-quick-title', text: '不想折腾？用一键安装：' });
    quick.createEl('button', { cls: 'mod-cta er-install-btn', text: '一键安装本地转写' }).onclick = () => {
      new AsrWizardModal(this.app, this.plugin).open();
    };
    if (!add.asrConfigured) {
      const help = addBox.createEl('div', { cls: 'er-addons-help' });
      help.createEl('div', { cls: 'er-addons-help-title', text: '本地转写怎么配（3 步，可选）' });
      const ol = help.createEl('ol', { cls: 'er-addons-steps' });
      for (const s of ASR_SETUP.steps) ol.createEl('li', { text: s });
      const act = help.createEl('div', { cls: 'er-addons-actions' });
      const cp = act.createEl('button', { text: '复制安装命令' });
      cp.onclick = async () => {
        try {
          await navigator.clipboard.writeText(ASR_SETUP.pip);
          new Notice('已复制：' + ASR_SETUP.pip);
        } catch (e) {
          new Notice('复制失败，手动输入：' + ASR_SETUP.pip, 8000);
        }
      };
      const dl = act.createEl('button', { text: ASR_SETUP.dlLabel });
      dl.onclick = () => window.open(ASR_SETUP.dlUrl, '_blank');
      const md = act.createEl('button', { text: ASR_SETUP.mdlLabel });
      md.onclick = () => window.open(ASR_SETUP.mdlUrl, '_blank');
      const jump = act.createEl('button', { text: '跳到下面的路径设置' });
      jump.onclick = () => {
        const h = containerEl.querySelector('h3.er-asr-head');
        if (h && h.scrollIntoView) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }


    new Setting(containerEl)
      .setName('笔记存放文件夹')
      .setDesc('精读笔记与导出文件的存放位置（相对库根目录）')
      .addText((t) => t.setValue(this.plugin.data.settings.noteFolder).onChange(async (v) => {
        this.plugin.data.settings.noteFolder = v.trim() || 'English';
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('生词本文件')
      .setDesc('新词会追加成 Markdown 表格；也可在这里手动整理')
      .addText((t) => t.setValue(this.plugin.data.settings.vocabFile).onChange(async (v) => {
        this.plugin.data.settings.vocabFile = v.trim() || 'English/生词本.md';
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('今日日记的小节标题')
      .setDesc('「记到今日日记」时会把链接追加到这个标题下面')
      .addText((t) => t.setValue(this.plugin.data.settings.dailySection).onChange(async (v) => {
        this.plugin.data.settings.dailySection = v;
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('默认播放速度')
      .setDesc('每篇文章会记住自己的速度')
      .addSlider((s) => s.setLimits(0.65, 1.75, 0.05).setValue(this.plugin.data.settings.defaultRate).setDynamicTooltip()
        .onChange(async (v) => { this.plugin.data.settings.defaultRate = v; await this.plugin.save(); }));

    new Setting(containerEl)
      .setName('自动连播')
      .setDesc('播完一句自动播下一句；与单句循环互斥。纯听模式下生效，跟读时让位给评分。')
      .addToggle((t) => t.setValue(this.plugin.data.settings.autoAdvance).onChange(async (v) => {
        this.plugin.data.settings.autoAdvance = v;
        if (v) this.plugin.data.settings.loopSentence = false;
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('跟读达标才进下一句')
      .setDesc('开启后，点跟读录完评分低于 70 分会停在当前句重练；达标后自动进下一句。不点跟读、只听的时候不受影响。')
      .addToggle((t) => t.setValue(this.plugin.data.settings.shadowGate).onChange(async (v) => {
        this.plugin.data.settings.shadowGate = v;
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('当前句聚焦')
      .setDesc('播放时突出当前句、淡化其余句子，视线更跟随。关闭则所有句子同样清晰。')
      .addToggle((t) => t.setValue(this.plugin.data.settings.focusCurrent !== false).onChange(async (v) => {
        this.plugin.data.settings.focusCurrent = v;
        await this.plugin.save();
        if (this.plugin.view && this.plugin.view.render) this.plugin.view.render();
      }));

    new Setting(containerEl)
      .setName('字幕全文搜索')
      .addToggle((t) => t.setValue(this.plugin.data.settings.segSearch !== false).onChange(async (v) => {
        this.plugin.data.settings.segSearch = v;
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('字幕自动跟随滚动')
      .addToggle((t) => t.setValue(this.plugin.data.settings.autoScroll).onChange(async (v) => {
        this.plugin.data.settings.autoScroll = v; await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('点击单词查词')
      .setDesc('关闭后只保留划词浮层')
      .addToggle((t) => t.setValue(this.plugin.data.settings.lookupOnClick).onChange(async (v) => {
        this.plugin.data.settings.lookupOnClick = v; await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('刷新时每个源保留文章数')
      .addSlider((s) => s.setLimits(10, 100, 10).setValue(this.plugin.data.settings.maxItemsPerFeed).setDynamicTooltip()
        .onChange(async (v) => { this.plugin.data.settings.maxItemsPerFeed = v; await this.plugin.save(); }));

        const asrHead = containerEl.createEl('h3', { text: '本地转写（faster-whisper，免费离线）', cls: 'er-asr-head' });
    containerEl.createEl('div', {
      cls: 'er-asr-note',
      text: '不想配也能用：没有字幕的节目，手动粘贴 SRT/VTT 即可逐句精听。想自动转写再按上面的 3 步配，配完点「检测」验证。',
    });
    new Setting(containerEl)
      .setName('转写脚本目录')
      .setDesc('存放 transcribe.py 的文件夹。例：D:/asr（不确定就留空，不影响手动粘贴字幕）')
      .addText((t) => t.setValue(this.plugin.data.settings.whisperDir).onChange(async (v) => {
        this.plugin.data.settings.whisperDir = v.trim();
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('Python 解释器')
      .setDesc('装了 faster-whisper 的 python.exe。例：D:/asr/.venv/Scripts/python.exe')
      .addText((t) => t.setValue(this.plugin.data.settings.whisperPython).onChange(async (v) => {
        this.plugin.data.settings.whisperPython = v.trim();
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('模型目录')
      .setDesc('含 model.bin 的文件夹。例：D:/asr/models/base.en（base.en 约 145MB）')
      .addText((t) => t.setValue(this.plugin.data.settings.whisperModelDir).onChange(async (v) => {
        this.plugin.data.settings.whisperModelDir = v.trim();
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('转写线程数')
      .setDesc('默认 8，接近 CPU 物理核心数')
      .addSlider((s) => s.setLimits(2, 16, 1).setValue(this.plugin.data.settings.whisperThreads).setDynamicTooltip()
        .onChange(async (v) => { this.plugin.data.settings.whisperThreads = v; await this.plugin.save(); }));

    new Setting(containerEl)
      .setName('检测本地转写环境')
      .setDesc('检查 Python、脚本、模型是否就位')
      .addButton((b) => b.setButtonText('检测').onClick(async () => {
        const r = await this.plugin.checkWhisper();
        new Notice(r.ok ? '✓ 本地转写就绪\n' + r.exe : '✗ 未就绪：' + r.err, 8000);
      }));

    containerEl.createEl('h3', { text: '跟读录音' });
    new Setting(containerEl)
      .setName('录音保存目录')
      .setDesc('每条跟读录音都会存到这里，并维护一份 索引.md')
      .addText((t) => t.setValue(this.plugin.data.settings.recFolder).onChange(async (v) => {
        this.plugin.data.settings.recFolder = v.trim() || 'English/录音';
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('原声采集（关闭浏览器语音优化）')
      .setDesc('关掉回声消除、降噪、自动增益。学发音时这些处理会吞掉弱读的辅音尾音（如 -ed / -s / -t），建议保持开启')
      .addToggle((t) => t.setValue(this.plugin.data.settings.recRawMic !== false).onChange(async (v) => {
        this.plugin.data.settings.recRawMic = v;
        await this.plugin.save();
      }));

    new Setting(containerEl)
      .setName('检测麦克风')
      .setDesc('查权限、设备数量，并逐档试参数。结果同时写进 cache/diag.log')
      .addButton((b) => b.setButtonText('开始检测').onClick(async () => {
        const r = await this.plugin.diagnoseMic();
        new Notice(r, 20000);
      }));

    new Setting(containerEl)
      .setName('录音时长宽松度')
      .setDesc('按句子长度与复杂度自动估算录音上限。英语还不流利建议「宽松」，给足起手和停顿时间')
      .addDropdown((d) => d
        .addOption('0', '紧凑 ×0.85')
        .addOption('1', '标准 ×1.0')
        .addOption('2', '宽松 ×1.25（推荐）')
        .setValue(String(this.plugin.data.settings.recLooseness == null ? 2 : this.plugin.data.settings.recLooseness))
        .onChange(async (v) => {
          this.plugin.data.settings.recLooseness = Number(v);
          await this.plugin.save();
        }));

    containerEl.createEl('h3', { text: '订阅源' });
    const listEl = containerEl.createDiv('er-settings-feeds');
    if (!this.plugin.data.feeds.length) listEl.createEl('p', { cls: 'er-hint', text: '还没有订阅源，可在阅读器里点 ＋ 添加。' });
    for (const f of this.plugin.data.feeds) {
      new Setting(listEl)
        .setName(f.title || f.url)
        .setDesc(f.url)
        .addButton((b) => b.setButtonText('删除').setWarning().onClick(async () => {
          await this.plugin.removeFeed(f.id);
          this.display();
        }));
    }

    containerEl.createEl('h3', { text: '维护' });
    new Setting(containerEl)
      .setName('清空字幕缓存')
      .setDesc('删除已下载的逐字稿，下次阅读会重新获取')
      .addButton((b) => b.setButtonText('清空').onClick(async () => {
        await this.plugin.clearTranscriptCache();
        new Notice('已清空');
      }));

    containerEl.createEl('h3', { text: '数据备份' });
    new Setting(containerEl)
      .setName('立即备份')
      .setDesc('把 data.json 复制到插件目录下的 backups/，保留最近 7 份。生词、错题、打卡统计、订阅都在里面。')
      .addButton((b) => b.setButtonText('备份').onClick(async () => {
        b.setButtonText('备份中…');
        const p = await this.plugin.autoBackup(true);
        b.setButtonText('备份');
        new Notice(p ? '已备份：' + p : '备份失败，看控制台日志');
      }));
    new Setting(containerEl)
      .setName('导出学习数据')
      .setDesc('把生词、错题、打卡统计和设置导成一份 JSON 到笔记目录，方便换机或长期留存。')
      .addButton((b) => b.setButtonText('导出').onClick(async () => {
        b.setButtonText('导出中…');
        await this.plugin.exportStudyData();
        b.setButtonText('导出');
      }));

    containerEl.createEl('h3', { text: '用法速查' });
    containerEl.createEl('div', {
      cls: 'er-help',
      text: [
        '1. 点左上角 ＋ 订阅。弹窗顶部有「一键订阅核心 4 个」和「全部 ' + PRESETS.filter((x) => x.group.startsWith('英语学习')).length + ' 个」两个按钮。',
        '2. 打开一集 → 先自动找现成逐字稿；找不到就点「本地转写这一集」。',
        '   本地转写完全免费、离线，20 分钟音频约 1.5-2 分钟（实测 12 倍速）。',
        '3. 播放可切 0.75x；点字幕里的时间码跳转；空格暂停；高亮自动跟随。',
        '4. 点任意英文单词查义 → ＋ 加入生词本；选中文字 → 划线/记笔记/朗读/翻译。',
        '5. 跟读：点某句右侧 🎙 先听原句再录音，用「↺ 听我的」对比。',
        '6. 「存为精读笔记」生成带原文链接、生词表、笔记待填区的 Markdown。',
        '7. RSS 只给简介的源，原文区会提示并给「抓取网页正文」按钮。',
        '8. 没有时间轴的字幕不会假装同步，需要时手动点「按句长估算时间轴」。',
        '9. 从社区插件市场安装只含三件套；可选增强看设置页顶部「可选增强状态」，脚本需从仓库 extras/ 手动放置。',
      ].join('\n'),
    });
  }
}

/* ------------------------------------------------------------------ */
/* 主插件                                                               */
/* ------------------------------------------------------------------ */
class EnglishReaderPlugin extends Plugin {
  async onload() {
    await this.loadData_();
    // 每次加载打一条版本戳：万一改完没重载，日志里一眼就能看出来
    this.diagLog('插件已加载 v' + (this.manifest && this.manifest.version || '?') +
      ' · 录音管线 ' + (typeof this.saveRecording === 'function' ? 'v2（裁剪+落盘）' : 'v1（仅内存）'));

    // 老数据补齐分组（按预置源地址匹配）
    for (const f of this.data.feeds) {
      if (!f.group) {
        const pre = PRESETS.find((x) => x.url === f.url);
        if (pre) f.group = pre.group;
      }
    }

    // 启动后延迟备份一次（6 小时内只做一次，不干扰打开速度）
    setTimeout(() => { this.autoBackup(false).catch(() => {}); }, 4000);

    this.registerView(VIEW_TYPE, (leaf) => new EnglishReaderView(leaf, this));
    this.registerObsidianProtocolHandler(PROTOCOL, async (params) => {
      const id = params.id || '';
      const t = Number(params.t || 0);
      await this.activateView();
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE) || [];
      const v = leaves.length ? leaves[0].view : null;
      if (!v) return;
      if (id && v.itemId !== id) { try { await v.openItem(id); } catch (e) { /* ignore */ } }
      setTimeout(() => {
        const a = v.audioEl;
        if (!a) return;
        try { a.currentTime = t; } catch (e) { /* ignore */ }
        if (typeof v.syncToTime === 'function') v.syncToTime(t, true);
        if (a.paused) { try { const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
      }, 400);
    });

    this.addRibbonIcon('headphones', '打开菠萝英语精听', () => this.activateView());

    this.addCommand({
      id: 'open-reader',
      name: '打开菠萝英语精听',
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: 'install-asr',
      name: '一键安装本地转写（可选）',
      callback: () => new AsrWizardModal(this.app, this).open(),
    });
    this.addCommand({
      id: 'refresh-feeds',
      name: '刷新全部订阅',
      callback: async () => {
        new Notice('刷新中…');
        const r = await this.refreshAll();
        if (r && r.fail) new Notice('刷新完成：' + r.ok + ' 个成功，' + r.fail + ' 个连不上（多为大陆直连问题，可到「发现订阅」换源）', 9000);
        else new Notice('刷新完成：' + ((r && r.ok) || 0) + ' 个源全部更新');
      },
    });
    this.addCommand({
      id: 'add-vocab-word',
      name: '把选中的单词加入生词本',
      callback: async () => {
        const sel = (window.getSelection()?.toString() || '').trim().replace(/[^A-Za-z'’\-]/g, '');
        if (!sel) return new Notice('先选中一个英文单词');
        const info = await lookupEnglish(sel);
        await this.addVocab({ ...info, word: sel, context: '' });
      },
    });

    // 命令面板 / 自定义快捷键：不用让焦点留在阅读面板上也能操作
    const withView = (fn) => () => {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE) || [];
      const v = leaves.length ? leaves[0].view : null;
      if (!v) { new Notice('先打开菠萝精听面板'); return; }
      try { fn(v); } catch (e) { this.log('命令执行失败：' + ((e && e.message) || e)); }
    };
    this.addCommand({ id: 'toggle-play', name: '播放 / 暂停（当前句）', callback: withView((v) => v.togglePlay()) });
    this.addCommand({ id: 'next-sentence', name: '下一句', callback: withView((v) => v.stepSegment(1)) });
    this.addCommand({ id: 'prev-sentence', name: '上一句', callback: withView((v) => v.stepSegment(-1)) });
    this.addCommand({ id: 'toggle-loop', name: '切换单句循环', callback: withView((v) => v.toggleLoop()) });
    this.addCommand({ id: 'toggle-auto-advance', name: '切换自动连播', callback: withView((v) => v.toggleAutoAdvance()) });
    this.addCommand({ id: 'blind-test', name: '盲听测试：当前这一集（3 句）', callback: withView(() => this.startBlindTest()) });

    this.addSettingTab(new EnglishReaderSettingTab(this.app, this));

    if (!this.data.settings.installedPresets || !this.data.settings.onboarded) {
      const needPreset = !this.data.settings.installedPresets;
      const needWelcome = !this.data.settings.onboarded;
      if (needPreset) this.data.settings.installedPresets = true;
      if (needWelcome) this.data.settings.onboarded = true;
      await this.save();
      // 首次安装：后台只订阅核心源，失败静默（交给欢迎页统一说明）；其余在「发现订阅」里按需加
      setTimeout(async () => {
        const appName = (this.manifest && this.manifest.name) || '菠萝精听';
        let ok = 0, total = 0;
        if (needPreset) {
          const first = PRESETS.filter((x) => CORE_TITLES.includes(x.title));
          total = first.length;
          for (const p of first) {
            if (await this.addFeed(p.url, p.title, p.kind, true, p.group).catch(() => false)) ok++;
          }
          const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
          leaves.forEach((l) => l.view && l.view.render && l.view.render());
        } else {
          total = this.data.feeds.length;
          ok = total;
        }
        if (needWelcome) {
          try { new WelcomeModal(this.app, this, { ok, fail: Math.max(0, total - ok), total }).open(); }
          catch (e) { new Notice(appName + '：已就绪。到「发现订阅」挑「大陆可直连」的源开始精听。', 12000); }
        }
      }, 1500);
    }
  }

  onunload() {
    this._killShadowWorker();
    this.cancelWhisper();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadData_() {
    const raw = (await super.loadData()) || {};
    this.data = {
      settings: Object.assign({}, DEFAULT_SETTINGS, raw.settings || {}),
      feeds: raw.feeds || [],
      items: raw.items || {},
      state: raw.state || {},
      vocab: raw.vocab || [],
      stats: raw.stats || {},
      mistakes: raw.mistakes || [],
      replays: raw.replays || {},
    };
  }

  scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save().catch(() => {}), 800);
  }

  async save() {
    // 控制体积：正文只留前 60k 字符
    for (const fid of Object.keys(this.data.items)) {
      for (const it of this.data.items[fid]) {
        if (it.content && it.content.length > 60000) it.content = it.content.slice(0, 60000);
      }
    }
    // 统计只留最近 400 天，每天的 seen 只留最近 7 天
    const sk = Object.keys(this.data.stats || {}).sort();
    if (sk.length > 400) {
      for (const k of sk.slice(0, sk.length - 400)) delete this.data.stats[k];
    }
    const cutoff = dayKey(Date.now() - 7 * DAY_MS);
    for (const k of Object.keys(this.data.stats || {})) {
      const r = this.data.stats[k];
      if (r && r.seen && k < cutoff) { delete r.seen; r.items = r.items || 0; }
    }
    // 错题本上限 600 条：没掌握的优先留，其余按时间从新到旧
    const mk = this.data.mistakes || [];
    if (mk.length > 600) {
      const byTs = (a, b) => (b.ts || 0) - (a.ts || 0);
      this.data.mistakes = mk.filter((m) => !m.done).sort(byTs)
        .concat(mk.filter((m) => m.done).sort(byTs))
        .slice(0, 600);
    }
    await super.saveData(this.data);
  }

  /* ---------- 订阅管理 ---------- */
  async addFeed(url, title, kind, silent, group) {
    url = (url || '').trim();
    if (!url) return false;
    if (this.data.feeds.some((f) => f.url === url)) {
      if (!silent) new Notice('已经订阅过了');
      return false;
    }
    let feedTitle = title || '';
    let items = [];
    let isPodcast = kind === 'podcast';
    try {
      const res = await requestUrl({ url });
      const parsed = parseFeedXml(res.text, url);
      feedTitle = feedTitle || parsed.title;
      items = dropVideoOnly(parsed.items);
      if (!kind) isPodcast = items.some((i) => i.audio);
    } catch (e) {
      if (!silent) new Notice('添加失败：' + friendlyFeedError(e, url), 9000);
      return false;
    }
    const feed = {
      id: hash(url),
      url,
      title: feedTitle || url,
      kind: isPodcast ? 'podcast' : 'article',
      group: group || '',
      addedAt: Date.now(),
      lastFetched: Date.now(),
    };
    this.data.feeds.push(feed);
    this.data.items[feed.id] = items.slice(0, this.data.settings.maxItemsPerFeed).map((it) => this.mergeItemState(it, feed.id));
    await this.save();
    return true;
  }

  mergeItemState(it, feedId) {
    const st = this.data.state[it.id] || {};
    return Object.assign({}, it, { read: !!st.read, star: !!st.star, pos: st.pos || 0 });
  }

  async removeFeed(feedId) {
    this.data.feeds = this.data.feeds.filter((f) => f.id !== feedId);
    delete this.data.items[feedId];
    await this.save();
  }

  async refreshFeed(feed) {
    try {
      const res = await requestUrl({ url: feed.url });
      const parsed = parseFeedXml(res.text, feed.url);
      const old = this.data.items[feed.id] || [];
      const oldMap = new Map(old.map((i) => [i.id, i]));
      const merged = dropVideoOnly(parsed.items).map((it) => {
        const prev = oldMap.get(it.id);
        const st = this.data.state[it.id] || {};
        return Object.assign({}, it, {
          read: st.read != null ? st.read : (prev ? prev.read : false),
          star: st.star != null ? st.star : (prev ? prev.star : false),
          pos: st.pos || (prev ? prev.pos : 0) || 0,
        });
      });
      this.data.items[feed.id] = merged.slice(0, this.data.settings.maxItemsPerFeed);
      feed.title = parsed.title || feed.title;
      feed.lastFetched = Date.now();
      feed.error = '';
      if (!feed.kind) feed.kind = merged.some((i) => i.audio) ? 'podcast' : 'article';
      return true;
    } catch (e) {
      feed.error = String(e.message || e);
      return false;
    }
  }

  async refreshAll() {
    const feeds = this.data.feeds.slice();
    let ok = 0;
    let fail = 0;
    for (const f of feeds) {
      if (await this.refreshFeed(f)) ok++; else fail++;
    }
    await this.save();
    return { ok, fail };
  }

  /* ---------- 逐字稿 ---------- */
  cachePath(itemId) {
    return `${CACHE_DIR}/${itemId}.json`;
  }

  /** 统一日志入口（视图与插件内部都用这个，避免各写一套） */
  log(msg) {
    try { return this.diagLog(msg); } catch (e) { /* ignore */ }
  }

  /** 诊断日志：写进 .obsidian/plugins/pineapple-english/cache/diag.log */
  async diagLog(msg) {
    try {
      const adapter = this.app.vault.adapter;
      const p = `${CACHE_DIR}/diag.log`;
      const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}\n`;
      if (await adapter.exists(CACHE_DIR)) {
        let size = 0;
        try { const st = await adapter.stat(p); size = (st && st.size) || 0; } catch (e) { /* ignore */ }
        if (size > 400000) await adapter.write(p, line);
        else if (size > 0) await adapter.append(p, line);
        else await adapter.write(p, line);
      } else {
        await adapter.mkdir(CACHE_DIR).catch(() => {});
        await adapter.write(p, line);
      }
    } catch (e) { /* 日志本身失败就放弃 */ }
  }

  /** 麦克风体检：权限、设备、逐档参数都试一遍，结果同时写日志 */
  async diagnoseMic() {
    const lines = [];
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return '当前环境没有 mediaDevices，无法录音（可能需要桌面版 Obsidian）';
    }
    let perm = '未知';
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const st = await navigator.permissions.query({ name: 'microphone' });
        perm = st.state;
      } else {
        perm = '无法查询';
      }
    } catch (e) { perm = '无法查询'; }
    lines.push('权限状态：' + perm);

    let inputs = [];
    try { inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'); } catch (e) { /* ignore */ }
    lines.push('输入设备：' + inputs.length + ' 个');
    inputs.slice(0, 4).forEach((d, i) => lines.push('  ' + (i + 1) + '. ' + (d.label || '(未授权时看不到名称)')));

    const tries = [
      ['原声采集', { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }],
      ['原声采集（不指定声道）', { echoCancellation: false, noiseSuppression: false, autoGainControl: false }],
      ['默认（保留语音优化）', true],
    ];
    let anyOk = false;
    for (const [label, cfg] of tries) {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: cfg });
        const t = st.getAudioTracks()[0];
        const g = t && t.getSettings ? t.getSettings() : {};
        lines.push('✓ ' + label + ' 可用 — ' + (g.sampleRate || '?') + ' Hz / ' +
          (g.channelCount || '?') + ' 声道 / 回声消除=' + g.echoCancellation +
          ' 降噪=' + g.noiseSuppression + ' 自动增益=' + g.autoGainControl);
        st.getTracks().forEach((x) => x.stop());
        anyOk = true;
        break;
      } catch (e) {
        lines.push('✗ ' + label + ' — ' + ((e && e.name) || '?') + ' ' + ((e && e.message) || ''));
      }
    }
    if (!anyOk) lines.push('三档全部失败，请看上面的错误名对照提示');
    const out = lines.join('\n');
    this.log('麦克风检测：\n' + out);
    return out;
  }

  /** 把跟读录音落盘，并追加一行到索引表 */
  async saveRecording(info) {
    try {
      const adapter = this.app.vault.adapter;
      const folder = String(this.data.settings.recFolder || 'English/录音').replace(/\/+$/, '');
      if (!(await adapter.exists(folder))) await adapter.mkdir(folder).catch(() => {});

      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      // 导入的文件保留原扩展名；录音走 mime 推断
      const guess = /mp4|m4a/.test(info.mime || '') ? 'm4a' : /ogg/.test(info.mime || '') ? 'ogg'
        : /wav/.test(info.mime || '') ? 'wav' : /mpeg|mp3/.test(info.mime || '') ? 'mp3'
        : /aac/.test(info.mime || '') ? 'aac' : 'webm';
      const wantExt = (info.ext || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      // 只认已知音频后缀，防止奇怪的值被当成扩展名写进文件名
      const ext = /^(mp3|m4a|mp4|wav|ogg|opus|webm|aac|amr|flac|3gp)$/.test(wantExt) ? wantExt : guess;
      const base = (info.item && info.item.id) || 'take';
      const name = `${base}-${stamp}.${ext}`;
      const full = `${folder}/${name}`;

      const buf = await info.blob.arrayBuffer();
      await adapter.writeBinary(full, buf);

      const idx = `${folder}/索引.md`;
      const title = ((info.item && info.item.title) || '(未知节目)').replace(/\|/g, '／').slice(0, 30);
      const text = (info.segText || '(整段)').replace(/\|/g, '／').slice(0, 40);
      const row = `| ${stamp.replace('-', ' ')} | ${title} | ${text} | ${(info.ms / 1000).toFixed(1)}s | [[${name}]] |\n`;
      if (!(await adapter.exists(idx))) {
        await adapter.write(idx, '# 跟读录音索引\n\n| 时间 | 节目 | 句子 | 时长 | 文件 |\n| --- | --- | --- | --- | --- |\n');
      }
      await adapter.append(idx, row);

      this.log('录音已保存 ' + full + '（' + buf.byteLength + ' 字节）');
      return full;
    } catch (e) {
      this.log('录音保存失败：' + ((e && e.message) || e));
      return '';
    }
  }

  async saveFullText(itemId, html) {
    try {
      if (!(await this.app.vault.adapter.exists(CACHE_DIR))) await this.app.vault.adapter.mkdir(CACHE_DIR).catch(() => {});
      await this.app.vault.adapter.write(`${CACHE_DIR}/${itemId}-full.json`, JSON.stringify({ html, ts: Date.now() }));
    } catch (e) { /* ignore */ }
  }

  async readFullText(itemId) {
    try {
      const p = `${CACHE_DIR}/${itemId}-full.json`;
      if (await this.app.vault.adapter.exists(p)) return JSON.parse(await this.app.vault.adapter.read(p)).html || '';
    } catch (e) { /* ignore */ }
    return '';
  }

  async readCache(itemId) {
    try {
      const p = this.cachePath(itemId);
      if (await this.app.vault.adapter.exists(p)) {
        return JSON.parse(await this.app.vault.adapter.read(p));
      }
    } catch (e) {
      this.diagLog(`读缓存失败 ${itemId} :: ${(e && e.message) || e}`);
    }
    return null;
  }

  async saveTranscriptCache(itemId, segments, info) {
    try {
      if (!(await this.app.vault.adapter.exists(CACHE_DIR))) {
        await this.app.vault.adapter.mkdir(CACHE_DIR).catch(() => {});
      }
      await this.app.vault.adapter.write(this.cachePath(itemId), JSON.stringify({ segments, info: info || {} }));
    } catch (e) { /* ignore */ }
  }

  async clearTranscriptCache() {
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(CACHE_DIR)) {
        for (const f of await adapter.list(CACHE_DIR)) {
          for (const file of f.files) {
            if (/diag\.log$/.test(file)) continue;
            await adapter.remove(file).catch(() => {});
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  /** 依次尝试：内存 → 磁盘 → podcast:transcript → 单集网页 → 网页里的 transcript 链接 */
  async fetchTranscript(it, force) {
    this.diagLog(`取字幕开始 ${it.id} | rss字幕=${(it.transcripts || []).length} | link=${(it.link || '').slice(0, 70)} | force=${!!force}`);
    if (!force) {
      const cached = await this.readCache(it.id);
      if (cached && cached.segments && cached.segments.length) {
        this.diagLog(`命中缓存 ${it.id} → ${cached.segments.length} 段`);
        return { segments: cached.segments, ...cached.info };
      }
      this.diagLog(`缓存未命中 ${it.id}`);
    }

    // 1) RSS 里的 podcast:transcript（优先带时间轴的 vtt/srt）
    const refs = (it.transcripts || []).slice().sort((a, b) => {
      const score = (x) => (/vtt|srt/i.test((x.type || '') + (x.url || '')) ? 0 : /json/i.test((x.type || '') + (x.url || '')) ? 1 : 2);
      return score(a) - score(b);
    });
    for (const t of refs) {
      try {
        const res = await requestUrl({ url: t.url });
        const body = res.text;
        let segs = [];
        let type = (t.type || '').toLowerCase();
        if (/vtt|srt/.test(type) || /-->/.test(body)) segs = parseVttOrSrt(body);
        else if (/json/.test(type) || body.trim().startsWith('[') || body.trim().startsWith('{')) segs = parseJsonTranscript(body);
        else segs = splitSentences(body).map((x) => ({ start: 0, end: 0, text: x }));
        if (segs.length) {
          const info = { timed: segs.every((s) => s.start > 0) || /vtt|srt/.test(type), kind: 'rss-transcript', source: t.url };
          await this.saveTranscriptCache(it.id, segs, info);
          return { segments: segs, ...info };
        }
      } catch (e) {
        this.diagLog(`rss字幕失败 ${t.url} :: ${(e && e.message) || e}`);
      }
    }

    // 2) 单集页面
    if (it.link) {
      try {
        const res = await requestUrl({ url: it.link });
        const html = res.text;

        // 2a. 页面里指向 transcript 的链接（优先同 slug，排除分类/标签页）
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let slug = '';
        try {
          const parts = new URL(it.link).pathname.split('/').filter(Boolean);
          slug = (parts[parts.length - 1] || '').toLowerCase();
        } catch (e) { /* ignore */ }

        // 只认同域名下的字幕页：跨站的 transcript 链接往往是别人家的内容
        const epHost = (() => { try { return new URL(it.link).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
        const sameSite = (u) => {
          try {
            const h = new URL(u).hostname.replace(/^www\./, '');
            return !!h && (h === epHost || h.endsWith('.' + epHost) || epHost.endsWith('.' + h));
          } catch (e) { return false; }
        };
        let cands = Array.from(doc.querySelectorAll('a[href]'))
          .map((a) => { try { return new URL(a.getAttribute('href'), it.link).href; } catch (e) { return null; } })
          .filter((h) => h && /transcript|逐字稿|文字稿/i.test(h) && !/\/(category|tag|topics|author)\//i.test(h) && sameSite(h));
        cands = [...new Set(cands)].sort((a, b) => {
          const score = (x) => (slug && x.toLowerCase().includes(slug) ? 0 : 1);
          return score(a) - score(b);
        });

        for (const abs of cands.slice(0, 3)) {
          try {
            const r2 = await requestUrl({ url: abs });
            const ex = extractTranscriptFromHtml(r2.text, abs);
            if (ex && ex.segments.length >= 8) {
              const info = { timed: ex.timed, kind: ex.kind, source: abs };
              await this.saveTranscriptCache(it.id, ex.segments, info);
              return { segments: ex.segments, ...info };
            }
          } catch (e) {
            this.diagLog(`字幕页抓取失败 ${abs} :: ${(e && e.message) || e}`);
          }
        }

        // 2b. 当前页直接抽
        const ex2 = extractTranscriptFromHtml(html, it.link);
        if (ex2 && ex2.segments.length) {
          const info = { timed: ex2.timed, kind: ex2.kind, source: it.link };
          await this.saveTranscriptCache(it.id, ex2.segments, info);
          return { segments: ex2.segments, ...info };
        }
      } catch (e) {
        this.diagLog(`单集页抓取失败 ${(it.link || '').slice(0, 60)} :: ${(e && e.message) || e}`);
      }
    }
    this.diagLog(`未找到字幕 ${it.id}`);
    return null;
  }

  /* ---------- 本地转写（whisper.cpp） ---------- */
  whisperPaths() {
    const norm = (v) => String(v || '').replace(/[\\/]+/g, '/').replace(/\/+$/, '');
    const dir = norm(this.data.settings.whisperDir);
    return {
      dir,
      python: norm(this.data.settings.whisperPython),
      script: dir + '/transcribe.py',
      modelDir: norm(this.data.settings.whisperModelDir),
      temp: dir + '/temp',
    };
  }

  async checkWhisper() {
    const out = { ok: false, exe: '', modelOk: false, err: '' };
    if (Platform.isMobile) {
      out.err = '本地转写只能在电脑上用（手机没有 Python 环境），手机上照样能听、看字幕、查词。';
      return out;
    }
    try {
      const p = this.whisperPaths();
      if (!p.dir || !p.python || !p.modelDir) {
        out.err = '未配置本地转写环境（可选功能）。在设置 → 本地转写里填三个路径即可启用，不影响其他功能。';
        return out;
      }
      const fs = require('fs');
      out.model = p.modelDir;
      if (!fs.existsSync(p.python)) { out.err = '找不到 Python：' + p.python; return out; }
      if (!fs.existsSync(p.script)) { out.err = '找不到 transcribe.py：' + p.script; return out; }
      if (!p.modelDir || !fs.existsSync(p.modelDir + '/model.bin')) { out.err = '找不到模型目录：' + (p.modelDir || '(未设置)'); return out; }
      out.exe = p.python;
      out.modelOk = true;
      out.ok = true;
    } catch (e) {
      out.err = String((e && e.message) || e);
    }
    return out;
  }

  cancelWhisper() {
    try { if (this._whisperChild) this._whisperChild.kill(); } catch (e) { /* ignore */ }
    this._whisperChild = null;
  }

  /** 跟读评分能不能用：只要本地转写配好了就行 */
  shadowReady() {
    if (Platform.isMobile) return false;
    try {
      const p = this.whisperPaths();
      if (!p.dir || !p.python || !p.modelDir) return false;
      const fs = require('fs');
      return fs.existsSync(p.python) && fs.existsSync(p.script);
    } catch (e) { return false; }
  }

  /**
   * 转一个本地音频文件（跟读录音），只跑进程，不下载、不覆盖整集字幕。
   * 单句通常 2–4 秒出结果，超时 40 秒直接掐掉。
   */
  async _spawnTranscribe(audioPath, outBase) {
    const fs = require('fs');
    const { spawn } = require('child_process');
    const chk = await this.checkWhisper();
    if (!chk.ok) throw new Error(chk.err);
    const p = this.whisperPaths();
    if (!fs.existsSync(p.temp)) fs.mkdirSync(p.temp, { recursive: true });
    const outSrt = outBase + '.srt';
    try { if (fs.existsSync(outSrt)) fs.unlinkSync(outSrt); } catch (e) { /* ignore */ }

    return await new Promise((resolve, reject) => {
      const args = [p.script, audioPath, outSrt, p.modelDir, String(this.data.settings.whisperThreads || 8)];
      let tail = '';
      let child;
      try {
        child = spawn(chk.exe, args, { cwd: p.dir, windowsHide: true });
      } catch (e) {
        return reject(e);
      }
      this._shadowChild = child;
      const timer = setTimeout(() => {
        try { child.kill(); } catch (e) { /* ignore */ }
        reject(new Error('评分超时（40 秒），这句可能太长，试试更短的句子'));
      }, 40000);
      child.stdout.on('data', (d) => { tail = (tail + d.toString()).slice(-4000); });
      child.stderr.on('data', (d) => { tail = (tail + d.toString()).slice(-4000); });
      child.on('error', (e) => { clearTimeout(timer); this._shadowChild = null; reject(e); });
      child.on('close', (code) => {
        clearTimeout(timer);
        this._shadowChild = null;
        if (code !== 0) return reject(new Error('识别进程退出码 ' + code + '：' + tail.slice(-200)));
        try {
          const srt = fs.readFileSync(outSrt, 'utf8');
          const segs = parseVttOrSrt(srt);
          try { fs.unlinkSync(outSrt); } catch (e) { /* ignore */ }
          resolve(segs);
        } catch (e) { reject(new Error('没生成识别结果')); }
      });
    });
  }

  /**
   * 给一次跟读录音打分。
   * relPath 是录音在库里的相对路径（saveRecording 返回的），转成绝对路径喂给识别脚本。
   */
  async gradeShadow(relPath, refText) {
    const fs = require('fs');
    const pathMod = require('path');
    const adapter = this.app.vault.adapter;
    const base = typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : '';
    const abs = base ? pathMod.join(base, relPath) : relPath;
    if (!fs.existsSync(abs)) throw new Error('找不到刚录的文件：' + relPath);

    let heard = '';
    let got = false;
    // 优先用常驻进程：首句 3–4 秒，之后每句不到 1 秒
    if (await this._ensureShadowWorker()) {
      const res = await this._shadowAsk(abs);
      if (res && res.ok) { heard = res.text || ''; got = true; }
      else if (res && res.err) this.log('常驻识别失败，回退到单次转写：' + res.err);
    }
    if (!got) {
      const outBase = pathMod.join(this.whisperPaths().temp, 'shadow-' + hash(abs));
      const segs = await this._spawnTranscribe(abs, outBase);
      heard = segs.map((s) => s.text).join(' ').trim();
    }

    const res = scoreShadow(refText, heard, { lang: 'en' });
    this.log('跟读评分 ' + res.score + ' 分（' + res.matched + '/' + res.total + '）· ' + heard);
    return res;
  }

  /* ---------- 跟读评分：常驻识别进程 ---------- */

  /** 可选增强：shadow_server.py 不在社区市场的三件套内，缺失时退回单次转写（打分功能仍可用） */
  shadowScriptPath() {
    try {
      const dir = this.manifest && this.manifest.dir;
      if (!dir) return '';
      const pathMod = require('path');
      const p = pathMod.join(dir, 'shadow_server.py');
      return require('fs').existsSync(p) ? p : '';
    } catch (e) { return ''; }
  }

  /** 确保常驻进程在跑；返回 false 让调用方回退 */
  async _ensureShadowWorker() {
    if (this._shadowReady && this._shadowProc) return true;
    if (this._shadowStarting) return await this._shadowStarting;
    const script = this.shadowScriptPath();
    if (!script) return false;
    const chk = await this.checkWhisper();
    if (!chk.ok) return false;

    this._shadowStarting = new Promise((resolve) => {
      const { spawn } = require('child_process');
      const p = this.whisperPaths();
      let child = null;
      try {
        child = spawn(chk.exe, [script, p.modelDir, String(this.data.settings.whisperThreads || 8)], {
          cwd: p.dir, windowsHide: true,
        });
      } catch (e) {
        this.log('启动识别进程失败：' + ((e && e.message) || e));
        return resolve(false);
      }
      this._shadowProc = child;
      this._shadowQueue = [];
      this._shadowReady = false;
      let buf = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this._killShadowWorker();
        resolve(false);
      }, 30000);

      child.stdout.on('data', (d) => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          let msg = null;
          try { msg = JSON.parse(line); } catch (e) { continue; }
          if (msg.ready) {
            this._shadowReady = true;
            if (!settled) { settled = true; clearTimeout(timer); resolve(true); }
            continue;
          }
          const q = this._shadowQueue.shift();
          if (q) { clearTimeout(q.timer); q.resolve(msg); }
        }
      });
      child.stderr.on('data', () => { /* 模型日志，忽略 */ });
      child.on('error', (e) => {
        this.log('识别进程错误：' + ((e && e.message) || e));
        if (!settled) { settled = true; clearTimeout(timer); resolve(false); }
      });
      child.on('close', () => {
        this._shadowProc = null;
        this._shadowReady = false;
        (this._shadowQueue || []).forEach((q) => {
          clearTimeout(q.timer);
          q.resolve({ ok: false, err: '识别进程已退出' });
        });
        this._shadowQueue = [];
        if (!settled) { settled = true; clearTimeout(timer); resolve(false); }
      });
    }).finally(() => { this._shadowStarting = null; });

    return await this._shadowStarting;
  }

  /** 往常驻进程丢一句，等它的 JSON 回复 */
  _shadowAsk(absPath) {
    return new Promise((resolve) => {
      if (!this._shadowProc || !this._shadowReady) return resolve({ ok: false, err: '识别进程未就绪' });
      const timer = setTimeout(() => resolve({ ok: false, err: '识别超时（20 秒）' }), 20000);
      this._shadowQueue.push({ resolve, timer });
      this._touchShadowIdle();
      try {
        this._shadowProc.stdin.write(absPath + '\n');
      } catch (e) {
        clearTimeout(timer);
        resolve({ ok: false, err: String((e && e.message) || e) });
      }
    });
  }

  /** 空闲 8 分钟就退出，这台机器内存不宽裕 */
  _touchShadowIdle() {
    clearTimeout(this._shadowIdle);
    this._shadowIdle = setTimeout(() => {
      this.log('跟读识别进程空闲退出');
      this._killShadowWorker();
    }, 8 * 60 * 1000);
  }

  _killShadowWorker() {
    clearTimeout(this._shadowIdle);
    this._shadowIdle = null;
    const child = this._shadowProc;
    this._shadowProc = null;
    this._shadowReady = false;
    if (!child) return;
    try { child.stdin.write('__QUIT__\n'); } catch (e) { /* ignore */ }
    try { child.kill(); } catch (e) { /* ignore */ }
  }

  /**
   * 下载音频 → whisper.cpp 转写 → 解析 SRT → 返回带真实时间戳的分句
   * @param onProgress ({phase, pct, sizeMB}) => void
   */
  async transcribeLocal(it, onProgress) {
    const fs = require('fs');
    const pathMod = require('path');
    const { spawn } = require('child_process');
    if (!it.audio) throw new Error('这一集没有音频地址');

    const chk = await this.checkWhisper();
    if (!chk.ok) throw new Error(chk.err);

    const p = this.whisperPaths();
    if (!fs.existsSync(p.temp)) fs.mkdirSync(p.temp, { recursive: true });
    const audioPath = pathMod.join(p.temp, it.id + '.mp3');
    const outBase = pathMod.join(p.temp, it.id);
    const t0 = Date.now();

    onProgress({ phase: '下载音频', pct: 0 });
    if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 10000) {
      const res = await requestUrl({ url: it.audio });
      const buf = Buffer.from(res.arrayBuffer);
      if (buf.length < 10000) throw new Error('音频下载失败（只有 ' + buf.length + ' 字节）');
      fs.writeFileSync(audioPath, buf);
    }
    const sizeMB = (fs.statSync(audioPath).size / 1048576).toFixed(1);
    onProgress({ phase: '转写中', pct: 0, sizeMB });

    const outSrt = outBase + '.srt';
    const segs = await new Promise((resolve, reject) => {
      const args = [p.script, audioPath, outSrt, p.modelDir, String(this.data.settings.whisperThreads || 8)];
      this.log('whisper 启动: ' + chk.exe + ' ' + args.join(' '));
      let tail = '';
      let child;
      try {
        child = spawn(chk.exe, args, { cwd: p.dir, windowsHide: true });
      } catch (e) {
        return reject(e);
      }
      this._whisperChild = child;
      // 进度从 stdout 的 PROGRESS 行读取
      child.stdout.on('data', (d) => {
        const txt = d.toString();
        tail += txt;
        if (tail.length > 6000) tail = tail.slice(-6000);
        const all = txt.match(/PROGRESS\s+(\d+)/g);
        if (all) {
          const last = all[all.length - 1].match(/PROGRESS\s+(\d+)/);
          onProgress({ phase: '转写中', pct: Number(last[1]), sizeMB });
        }
      });
      child.stderr.on('data', (d) => {
        tail += d.toString();
        if (tail.length > 6000) tail = tail.slice(-6000);
      });
      child.on('error', (e) => { this._whisperChild = null; reject(e); });
      child.on('close', (code) => {
        this._whisperChild = null;
        if (code !== 0) return reject(new Error('转写进程退出码 ' + code + '：' + tail.slice(-300)));
        try {
          const srt = fs.readFileSync(outSrt, 'utf8');
          resolve(parseVttOrSrt(srt));
        } catch (e) { reject(new Error('没生成字幕文件：' + outSrt)); }
      });
    });

    if (!segs || !segs.length) throw new Error('转写结果为空（音频可能无人声）');

    // 立刻写入字幕缓存，避免下次重跑
    try {
      await this.saveTranscriptCache(it.id, segs, { timed: true, kind: 'whisper', source: 'local' });
    } catch (e) { /* ignore */ }

    // 清理临时音频，保留 srt 便于排查
    try { fs.unlinkSync(audioPath); } catch (e) { /* ignore */ }
    this.log(`whisper 完成 ${it.id}: ${segs.length} 句，耗时 ${Math.round((Date.now() - t0) / 1000)}s`);
    return segs;
  }

  /* ---------- 复习调度（间隔重复） ---------- */

  /** 一个词什么时候该复习：没复习过就按加入时间 + 1 天 */
  vocabDueAt(v) {
    if (v && v.dueAt) return v.dueAt;
    return ((v && v.ts) || 0) + DAY_MS;
  }

  /** 到期待复习的词，按到期时间从早到晚 */
  dueVocab(now) {
    const t = now == null ? Date.now() : now;
    return (this.data.vocab || [])
      .filter((v) => this.vocabDueAt(v) <= t)
      .sort((a, b) => this.vocabDueAt(a) - this.vocabDueAt(b));
  }

  /**
   * 复习一个词。
   * 记得 → 熟度 +1，间隔按 SRS_INTERVALS 拉长
   * 忘了 → 熟度归 0，1 天后再见，并记一次 lapse
   */
  async reviewVocab(word, remembered) {
    const v = (this.data.vocab || []).find((x) => x.word.toLowerCase() === String(word).toLowerCase());
    if (!v) return null;
    const now = Date.now();
    if (remembered) {
      v.level = Math.min(SRS_MAX_LEVEL, (v.level || 0) + 1);
    } else {
      v.level = 0;
      v.lapses = (v.lapses || 0) + 1;
    }
    v.reviews = (v.reviews || 0) + 1;
    v.lastReview = now;
    v.dueAt = now + SRS_INTERVALS[v.level] * DAY_MS;
    await this.save();
    this.rewriteVocabFile().catch(() => {});
    return v;
  }

  /* ---------- 学习记录 ---------- */

  /** 播放时累计秒数；dt 太大说明是拖进度条跳过去的，不计 */
  addStudySeconds(dt, meta) {
    if (!(dt > 0) || dt > 3) return;
    const now = Date.now();
    const k = dayKey(now);
    if (!this.data.stats) this.data.stats = {};
    const rec = this.data.stats[k] || { sec: 0, items: 0 };
    // 存浮点：timeupdate 的增量只有 0.25 秒左右，四舍五入会把它们全部抹成 0
    rec.sec = (rec.sec || 0) + dt;
    // 收听生物钟：24 个小时桶
    if (!Array.isArray(rec.hours)) rec.hours = new Array(24).fill(0);
    const h = new Date(now).getHours();
    rec.hours[h] = Math.round(((rec.hours[h] || 0) + dt) * 10) / 10;
    // 常听节目：按订阅源累计
    const fid = meta && meta.feedId;
    if (fid) {
      if (!rec.shows || typeof rec.shows !== 'object') rec.shows = {};
      rec.shows[fid] = Math.round(((rec.shows[fid] || 0) + dt) * 10) / 10;
    }
    // 凌晨（0–5 点）还在听哪一集
    const title = meta && meta.title;
    if (title && h < 5) {
      if (!rec.night || typeof rec.night !== 'object') rec.night = {};
      rec.night[title] = Math.round(((rec.night[title] || 0) + dt) * 10) / 10;
    }
    this.data.stats[k] = rec;
    this._statsDirty = true;
    this.scheduleSave();
    this.flushStatsSoon();
  }

  /** 当天读过这一篇（同一天同一篇只算一次） */
  markStudyItem(id) {
    if (!id) return;
    const k = dayKey(Date.now());
    if (!this.data.stats) this.data.stats = {};
    const rec = this.data.stats[k] || { sec: 0, items: 0 };
    if (!rec.seen) rec.seen = {};
    if (rec.seen[id]) return;
    rec.seen[id] = 1;
    rec.items = Object.keys(rec.seen).length;
    this.data.stats[k] = rec;
    this._statsDirty = true;
    this.scheduleSave();
    this.flushStatsSoon();
  }

  /** 记一次「开始播放这一集」，用来算重复听 */
  bumpItemPlay(id) {
    if (!id) return;
    if (!this.data.replays) this.data.replays = {};
    const r = this.data.replays[id] || { n: 0, ts: 0 };
    r.n = (r.n || 0) + 1;
    r.ts = Date.now();
    this.data.replays[id] = r;
    const keys = Object.keys(this.data.replays);
    if (keys.length > 1000) {
      keys.sort((a, b) => ((this.data.replays[a] || {}).ts || 0) - ((this.data.replays[b] || {}).ts || 0));
      for (const k of keys.slice(0, keys.length - 1000)) delete this.data.replays[k];
    }
    this.scheduleSave();
  }

  /** 按 id 找篇目标题（统计里显示用） */
  itemTitleById(id) {
    for (const fid of Object.keys(this.data.items || {})) {
      const it = (this.data.items[fid] || []).find((x) => x.id === id);
      if (it) return it.title || '';
    }
    return '';
  }

  /** 收听统计面板要用的生物钟 / 常听节目 / 小发现 */
  listenInsights(now = Date.now(), days = 90) {
    const stats = this.data.stats || {};
    const hours = mergeHours(stats, now, days);
    const shows = topShows(stats, this.data.feeds, 5);
    const repeats = Object.keys(this.data.replays || {})
      .map((id) => ({ id, n: ((this.data.replays || {})[id] || {}).n || 0 }))
      .filter((x) => x.n >= 2)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map((x) => Object.assign({}, x, { title: this.itemTitleById(x.id) }));
    const disc = listenDiscoveries(stats, now, { repeats, shows });
    return { hours, shows, disc, days };
  }

  /** 记录一次盲听；有效作答少于 2 句不记 */
  recordBlind(itemId, results) {
    const valid = (results || []).filter((r) => r === 'g' || r === 'h' || r === 'x');
    if (valid.length < 2) return null;
    const k = dayKey(Date.now());
    if (!this.data.stats) this.data.stats = {};
    const rec = this.data.stats[k] || { sec: 0, items: 0 };
    if (!rec.blind) rec.blind = { n: 0, g: 0, h: 0, x: 0 };
    rec.blind.n += valid.length;
    rec.blind.g += valid.filter((r) => r === 'g').length;
    rec.blind.h += valid.filter((r) => r === 'h').length;
    rec.blind.x += valid.filter((r) => r === 'x').length;
    if (itemId) {
      if (!rec.blindSeen) rec.blindSeen = {};
      rec.blindSeen[itemId] = 1;
    }
    this.data.stats[k] = rec;
    this._statsDirty = true;
    this.scheduleSave();
    this.flushStatsSoon();
    return { n: valid.length, g: rec.blind.g, h: rec.blind.h, x: rec.blind.x };
  }

  blindDoneToday(itemId) {
    const rec = (this.data.stats || {})[dayKey(Date.now())];
    return !!(rec && rec.blindSeen && itemId && rec.blindSeen[itemId]);
  }

  /** 从统计面板或命令面板发起盲听 */
  startBlindTest() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE) || [];
    const v = leaves.length ? leaves[0].view : null;
    if (!v) { new Notice('先打开菠萝精听面板，并选一集'); return; }
    const found = v.currentItem ? v.currentItem() : null;
    if (!found) { new Notice('先在左侧选一集'); return; }
    const it = found.it || {};
    if (!it.audio) { new Notice('这一集没有音频，没法盲听'); return; }
    const timed = !!(v.transcriptInfo && v.transcriptInfo.timed) || v.estimateOn;
    if (!timed) { new Notice('这集没有时间轴：先点「按句长估算时间轴」再测'); return; }
    const segs = v.segs || [];
    if (segs.length < BLIND_MIN_SENTENCES) { new Notice('这集句子太少（不到 8 句），换一集再测'); return; }
    if (this.blindDoneToday(it.id)) { new Notice('这一集今天已经测过了，换一集或明天再来'); return; }
    const sample = pickBlindSegs(segs, 3);
    if (!sample.length) { new Notice('合适的句子不够，换一集试试'); return; }
    new BlindModal(this.app, this, it, segs, sample).open();
  }


  /** 攒一会儿再写文件，别每一秒都落盘 */
  flushStatsSoon() {
    if (!this._statsDirty) return;
    if (this._statsTimer) return;
    this._statsTimer = setTimeout(() => {
      this._statsTimer = null;
      this.writeStatsFile().catch(() => {});
    }, 8000);
  }

  /** 当月记录写成 Markdown 表格，一天一行 */
  async writeStatsFile() {
    if (!this._statsDirty) return;
    this._statsDirty = false;
    try {
      const folder = String(this.data.settings.statsFolder || '').replace(/\/+$/, '');
      if (!folder) return;
      await this.ensureFolder(folder);
      const month = dayKey(Date.now()).slice(0, 7);
      const path = folder + '/' + month + '.md';
      const days = Object.keys(this.data.stats || {})
        .filter((k) => k.slice(0, 7) === month)
        .sort();
      const lines = ['# 学习记录 · ' + month, '', '| 日期 | 分钟 | 篇数 |', '| --- | --- | --- |'];
      let totalSec = 0;
      for (const k of days) {
        const r = this.data.stats[k] || {};
        totalSec += r.sec || 0;
        lines.push('| ' + k + ' | ' + Math.round((r.sec || 0) / 60) + ' | ' + (r.items || 0) + ' |');
      }
      lines.push('', '本月合计：' + Math.round(totalSec / 60) + ' 分钟，' + this.studyStreak() + ' 天连续。', '');
      await this.app.vault.adapter.write(path, lines.join('\n'));
    } catch (e) { /* 静默 */ }
  }

  /** 连续学习天数：今天没达标就从昨天往前数 */
  studyStreak() {
    const stats = this.data.stats || {};
    const okDay = (k) => {
      const r = stats[k];
      return !!r && (r.sec || 0) >= 60;
    };
    let t = Date.now();
    if (!okDay(dayKey(t))) t -= DAY_MS;
    let n = 0;
    for (let i = 0; i < 4000; i++) {
      if (!okDay(dayKey(t))) break;
      n += 1;
      t -= DAY_MS;
    }
    return n;
  }

  todayMinutes() {
    const r = (this.data.stats || {})[dayKey(Date.now())];
    return Math.round(((r && r.sec) || 0) / 60);
  }

  /** 统计面板要用的全部数字，一次算完 */
  statsSummary(now = Date.now()) {
    const stats = this.data.stats || {};
    const keys = Object.keys(stats);
    let totalSec = 0;
    let totalItems = 0;
    let activeDays = 0;
    for (const k of keys) {
      const r = stats[k] || {};
      totalSec += r.sec || 0;
      totalItems += r.items || 0;
      if ((r.sec || 0) >= 60) activeDays += 1;
    }
    const m = monthStat(this.data, now);
    return {
      streak: this.studyStreak(),
      todayMin: this.todayMinutes(),
      monthMinutes: m.minutes,
      monthItems: m.items,
      monthDays: m.days,
      totalMinutes: Math.round(totalSec / 60),
      totalItems,
      activeDays,
      vocab: (this.data.vocab || []).length,
      hard: this.hardVocab().length,
      mistakes: this.listMistakes({ includeDone: false }).length,
    };
  }

  /* ---------- 错题本 ---------- */

  /** 全部错题，默认只给还没掌握的，按时间倒序（同毫秒按入库顺序，保证「刚标记的在最前」） */
  listMistakes(opts) {
    const all = (this.data.mistakes || []).slice();
    const arr = opts && opts.includeDone ? all : all.filter((m) => !m.done);
    return arr.sort((a, b) => ((b.ts || 0) - (a.ts || 0)) || ((b.seq || 0) - (a.seq || 0)));
  }

  hasMistake(itemId, idx) {
    const key = mistakeKey(itemId, idx);
    return (this.data.mistakes || []).some((m) => m.key === key);
  }

  findMistake(itemId, idx) {
    const key = mistakeKey(itemId, idx);
    return (this.data.mistakes || []).find((m) => m.key === key) || null;
  }

  /** 同一句重复标记只累加 hits，不产生重复条目 */
  async addMistake(entry) {
    const e = entry || {};
    if (!e.itemId) return null;
    if (!this.data.mistakes) this.data.mistakes = [];
    const key = mistakeKey(e.itemId, e.idx);
    const now = Date.now();
    let rec = this.data.mistakes.find((m) => m.key === key);
    if (rec) {
      rec.hits = (rec.hits || 1) + 1;
      rec.ts = now;
      rec.done = false;
      if (e.text) rec.text = e.text;
    } else {
      const maxSeq = this.data.mistakes.reduce((n, m) => Math.max(n, m.seq || 0), 0);
      rec = {
        key,
        itemId: e.itemId,
        feedId: e.feedId || '',
        itemTitle: e.itemTitle || '',
        idx: e.idx == null ? -1 : e.idx,
        text: String(e.text || '').trim(),
        link: e.link || '',
        audio: e.audio || '',
        start: e.start || 0,
        end: e.end || 0,
        note: '',
        hits: 1,
        done: false,
        seq: maxSeq + 1,
        ts: now,
      };
      this.data.mistakes.push(rec);
    }
    await this.save();
    this.rewriteMistakeFile().catch(() => {});
    return rec;
  }

  async removeMistake(itemId, idx) {
    if (idx == null) return;
    const key = mistakeKey(itemId, idx);
    this.data.mistakes = (this.data.mistakes || []).filter((m) => m.key !== key);
    await this.save();
    this.rewriteMistakeFile().catch(() => {});
  }

  async setMistakeDone(key, done) {
    const rec = (this.data.mistakes || []).find((m) => m.key === key);
    if (!rec) return null;
    rec.done = !!done;
    rec.doneAt = done ? Date.now() : 0;
    await this.save();
    this.rewriteMistakeFile().catch(() => {});
    return rec;
  }

  async rewriteMistakeFile() {
    const folder = String((this.data.settings && this.data.settings.noteFolder) || '').replace(/\/+$/, '');
    if (!folder) return;
    const path = folder + '/错题本.md';
    try {
      await this.ensureFolder(folder);
      const open = this.listMistakes({ includeDone: false });
      const cell = (x) => String(x == null ? '' : x).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
      const lines = [
        '---',
        'tags: [english/mistakes]',
        '---',
        '',
        '# 错题本',
        '',
        '> 还有 ' + open.length + ' 句没过关，共记录 ' + (this.data.mistakes || []).length + ' 条。',
        '> 由插件自动生成，手工修改会在下次写入时被覆盖。',
        '',
        '| 句子 | 来自 | 标记次数 | 最近标记 | 状态 |',
        '| --- | --- | --- | --- | --- |',
      ];
      for (const m of this.listMistakes({ includeDone: true })) {
        lines.push('| ' + [
          cell(m.text), cell(m.itemTitle), String(m.hits || 1), dayKey(m.ts), m.done ? '已掌握' : '待复习',
        ].join(' | ') + ' |');
      }
      const notes = await this._myNotesTail(path);
      lines.push('', '## 我的备注', '', '<!-- 手写在下面，插件重写表格时会保留这一段。 -->', '');
      if (notes) lines.push(notes);
      await this.app.vault.adapter.write(path, lines.join('\n'));
    } catch (e) { /* 静默 */ }
  }

  /* ---------- 易错词 ---------- */

  /** 易错词：答错过 2 次及以上，或最近一次复习还错的词 */
  hardVocab() {
    return (this.data.vocab || [])
      .filter((v) => (v.lapses || 0) >= 2 || (v.lapses === 1 && v.level === 0))
      .sort((a, b) => (b.lapses || 0) - (a.lapses || 0));
  }

  /* ---------- 生词 ---------- */
  async addVocab(entry) {
    const word = String(entry.word || '').trim();
    if (!word) return;
    if (this.data.vocab.some((v) => v.word.toLowerCase() === word.toLowerCase())) return;
    const rec = {
      word,
      phonetic: entry.phonetic || '',
      gloss: entry.gloss || '',
      defs: entry.defs || [],
      audio: entry.audio || '',
      context: entry.context || '',
      source: entry.source || '',
      ts: Date.now(),
    };
    this.data.vocab.push(rec);
    await this.save();
    await this.rewriteVocabFile();
    new Notice(`已加入生词本：${word}`);
  }

  async removeVocab(word) {
    this.data.vocab = this.data.vocab.filter((v) => v.word.toLowerCase() !== String(word).toLowerCase());
    await this.save();
  }

  /** 整表重写：加了「熟度/复习/下次」三列之后，append 会让表格错位 */
  async rewriteVocabFile() {
    const path = this.data.settings.vocabFile;
    const adapter = this.app.vault.adapter;
    try {
      await this.ensureFolder(path.split('/').slice(0, -1).join('/'));
      const due = this.dueVocab().length;
      const cell = (x) => String(x == null ? '' : x).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
      const lines = [
        '---',
        'tags: [english/vocabulary]',
        '---',
        '',
        '# 生词本',
        '',
        '> 共 ' + this.data.vocab.length + ' 个词，其中 ' + due + ' 个待复习。',
        '> 这张表由插件自动生成，手工修改会在下次写入时被覆盖。',
        '',
        '| 单词 | 音标 | 释义 | 例句 | 来源 | 加入时间 | 熟度 | 复习 | 下次复习 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ];
      const rows = (this.data.vocab || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
      for (const v of rows) {
        lines.push('| ' + [
          cell(v.word), cell(v.phonetic), cell(v.gloss),
          cell(v.defs && v.defs[0] ? v.defs[0].def : ''),
          cell(v.source), dayKey(v.ts),
          (v.level || 0) + '/' + SRS_MAX_LEVEL,
          String(v.reviews || 0), dayKey(this.vocabDueAt(v)),
        ].join(' | ') + ' |');
      }
      const notes = await this._myNotesTail(path);
      lines.push('', '## 我的备注', '', '<!-- 手写在下面，插件重写表格时会保留这一段。 -->', '');
      if (notes) lines.push(notes);
      await adapter.write(path, lines.join('\n'));
    } catch (e) { /* 静默 */ }
  }

  async exportVocabCsv() {
    const rows = [['word', 'phonetic', 'gloss', 'definition', 'context', 'source', 'date']];
    for (const v of this.data.vocab) {
      rows.push([v.word, v.phonetic, v.gloss, (v.defs[0]?.def || ''), v.context, v.source, window.moment(v.ts).format('YYYY-MM-DD')]);
    }
    const csv = rows.map((r) => r.map((x) => `"${String(x || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const path = `${this.data.settings.noteFolder}/生词库-${window.moment().format('YYYYMMDD')}.csv`;
    await this.ensureFolder(this.data.settings.noteFolder);
    await this.app.vault.adapter.write(path, '\ufeff' + csv);
    new Notice('已导出：' + path);
  }

  async openVocabFile() {
    const path = this.data.settings.vocabFile;
    if (!(await this.app.vault.adapter.exists(path))) return new Notice('还没有生词本文件');
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f) this.app.workspace.getLeaf(true).openFile(f);
  }

  /* ---------- 备份 ---------- */

  /** 读取旧文件「我的备注」段，重写表格时把它带过去（插件不该吃掉用户手写的东西） */
  async _myNotesTail(path) {
    try {
      const adapter = this.app.vault.adapter;
      if (typeof adapter.read !== 'function') return '';
      if (!(await adapter.exists(path))) return '';
      const old = await adapter.read(path);
      const mark = '## 我的备注';
      const i = old.indexOf(mark);
      if (i < 0) return '';
      const body = old.slice(i + mark.length).replace(/<!--[\s\S]*?-->/g, '').trim();
      return body ? body + '\n' : '';
    } catch (e) { return ''; }
  }

  /**
   * 把 data.json 复制到插件目录下的 backups/，保留最近 7 份。
   * 生词、错题、统计、订阅全在这一个文件里，写坏就一起没，md 那几份只是单向副本。
   * force=false 时 6 小时内只备份一次（每次启动都跑）。
   */
  async autoBackup(force) {
    const fs = require('fs');
    const pathMod = require('path');
    try {
      const dirRel = this.manifest && this.manifest.dir;
      if (!dirRel) return '';
      const adapter = this.app.vault.adapter;
      const base = typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : '';
      if (!base) return '';
      const src = pathMod.join(base, dirRel, 'data.json');
      if (!fs.existsSync(src)) return '';
      const last = Number(this.data.settings.lastBackupAt || 0);
      if (!force && last && Date.now() - last < 6 * 3600 * 1000) return '';

      const bdir = pathMod.join(base, dirRel, 'backups');
      if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
      const d = new Date();
      const p2 = (n) => String(n).padStart(2, '0');
      const stamp = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes());
      const dst = pathMod.join(bdir, 'data-' + stamp + '.json');
      fs.copyFileSync(src, dst);

      // 轮转：只留最近 7 份
      const olds = fs.readdirSync(bdir).filter((f) => /^data-\d{8}-\d{4}\.json$/.test(f)).sort();
      for (const f of olds.slice(0, Math.max(0, olds.length - 7))) {
        try { fs.unlinkSync(pathMod.join(bdir, f)); } catch (e) { /* ignore */ }
      }
      this.data.settings.lastBackupAt = Date.now();
      await this.save();
      this.log('已备份数据：' + dst);
      return dst;
    } catch (e) {
      this.log('备份失败：' + ((e && e.message) || e));
      return '';
    }
  }

  /** 导出学习数据（生词、错题、统计、设置），不含订阅正文缓存 */
  async exportStudyData() {
    const folder = String(this.data.settings.noteFolder || 'English').replace(/\/+$/, '') + '/备份';
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const stamp = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes());
    const path = folder + '/菠萝学习数据-' + stamp + '.json';
    try {
      await this.ensureFolder(folder);
      const payload = {
        exportedAt: new Date().toISOString(),
        plugin: 'pineapple-english',
        settings: this.data.settings,
        vocab: this.data.vocab || [],
        mistakes: this.data.mistakes || [],
        stats: this.data.stats || {},
        feeds: (this.data.feeds || []).map((f) => ({ id: f.id, url: f.url, title: f.title, kind: f.kind, group: f.group })),
      };
      await this.app.vault.adapter.write(path, JSON.stringify(payload, null, 2));
      new Notice('已导出学习数据：' + path, 6000);
      return path;
    } catch (e) {
      new Notice('导出失败：' + ((e && e.message) || e));
      return '';
    }
  }

  /* ---------- 文件工具 ---------- */
  async ensureFolder(folder) {
    if (!folder) return;
    const adapter = this.app.vault.adapter;
    const parts = folder.split('/').filter(Boolean);
    let cur = '';
    for (const p of parts) {
      cur = cur ? cur + '/' + p : p;
      if (!(await adapter.exists(cur))) await adapter.mkdir(cur).catch(() => {});
    }
  }

  dailyConfig() {
    let folder = '';
    let format = 'YYYY-MM-DD';
    try {
      const dn = this.app.internalPlugins?.getPluginById?.('daily-notes');
      const opts = dn?.instance?.options || {};
      folder = opts.folder || '';
      format = opts.format || 'YYYY-MM-DD';
    } catch (e) { /* ignore */ }
    return { folder, format };
  }

  async appendToDaily(line) {
    const cfg = this.dailyConfig();
    const name = window.moment().format(cfg.format || 'YYYY-MM-DD');
    const path = (cfg.folder ? cfg.folder.replace(/\/+$/, '') + '/' : '') + name + '.md';
    const adapter = this.app.vault.adapter;
    if (cfg.folder) await this.ensureFolder(cfg.folder);
    const section = this.data.settings.dailySection || '## 英语精听';
    if (!(await adapter.exists(path))) {
      await adapter.write(path, `# ${name}\n\n${section}\n\n${line}\n`);
      return path;
    }
    let content = await adapter.read(path);
    if (!content.includes(section)) {
      content += `\n\n${section}\n\n${line}\n`;
    } else {
      const idx = content.indexOf(section);
      const nl = content.indexOf('\n', idx);
      if (nl < 0) content += '\n' + line + '\n';
      else {
        // 插到该小节标题后第一行
        content = content.slice(0, nl + 1) + line + '\n' + content.slice(nl + 1);
      }
    }
    await adapter.write(path, content);
    return path;
  }

  async saveReadingNote(it, feed, segs) {
    const folder = this.data.settings.noteFolder;
    await this.ensureFolder(folder);
    const words = this.data.vocab.filter((v) => v.source === it.title);
    const fm = [
      '---',
      `title: "${String(it.title).replace(/"/g, "'")}"`,
      `feed: "${String(feed.title || '').replace(/"/g, "'")}"`,
      `date: ${it.date ? window.moment(it.date).format('YYYY-MM-DD') : window.moment().format('YYYY-MM-DD')}`,
      `link: ${it.link || ''}`,
      it.audio ? `audio: ${it.audio}` : null,
      `kind: ${feed.kind || 'article'}`,
      'tags: [english/reading]',
      '---',
      '',
      `# ${it.title}`,
      '',
      `来源：[${feed.title}](${it.link || feed.url})　${it.date ? window.moment(it.date).format('YYYY-MM-DD') : ''}${it.duration ? '　时长 ' + fmtTime(it.duration) : ''}`,
      '',
      '## 我的笔记',
      '',
      '- ',
      '',
    ].filter((x) => x !== null).join('\n');

    let body = fm;
    if (words.length) {
      body += '\n## 本篇生词\n\n| 单词 | 音标 | 释义 |\n| --- | --- | --- |\n';
      for (const w of words) body += `| ${w.word} | ${w.phonetic || ''} | ${(w.gloss || '').replace(/\|/g, '/')} |\n`;
      body += '\n';
    }
    if (this.data.settings.exportTranscript && segs && segs.length) {
      body += '\n## 逐句稿\n\n' + segs.map((s) => `- \`${fmtTime(s.start || 0)}\` ${s.text}`).join('\n') + '\n';
    }

    const path = `${folder}/${sanitizeFileName(it.title)}.md`;
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(path)) {
      const old = await adapter.read(path);
      await adapter.write(path, old.replace(/\n## 我的笔记\n\n- \s*$/, '\n') + '\n\n---\n\n' + body);
    } else {
      await adapter.write(path, body);
    }
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f) this.app.workspace.getLeaf(true).openFile(f);
    new Notice('已保存精读笔记');
  }

  async exportTranscriptNote(it, feed, segs) {
    if (!segs || !segs.length) return new Notice('还没有逐字稿');
    const folder = this.data.settings.noteFolder;
    await this.ensureFolder(folder);
    const rows = segs.map((s) => `- \`${fmtTime(s.start || 0)}\` ${s.text}`).join('\n');
    const body = [
      '---',
      `title: "逐字稿 · ${String(it.title).replace(/"/g, "'")}"`,
      `feed: "${String(feed.title || '').replace(/"/g, "'")}"`,
      `link: ${it.link || ''}`,
      'tags: [english/transcript]',
      '---',
      '',
      `# ${it.title}`,
      '',
      rows,
      '',
    ].join('\n');
    const path = `${folder}/逐字稿-${sanitizeFileName(it.title)}.md`;
    await this.app.vault.adapter.write(path, body);
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f) this.app.workspace.getLeaf(true).openFile(f);
    new Notice('已导出逐字稿');
  }

  /* ---------- 单词 / 选区浮层 ---------- */
  showWordPopup(word, opts) {
    if (this._popup) {
      try { this._popup.hide(); } catch (e) { /* ignore */ }
      this._popup = null;
    }
    this._popup = new WordPopup(this, opts && opts.onClose);
    this._popup.show(word, opts);
  }

  showSelectionBar(text, rect) {
    if (this._selBar) this._selBar.remove();
    const bar = document.createElement('div');
    bar.className = 'er-sel-bar';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = (e) => { e.preventDefault(); fn(); bar.remove(); };
      bar.appendChild(b);
    };
    mk('＋生词本', async () => {
      const word = text.trim().split(/\s+/)[0].replace(/[^A-Za-z'’\-]/g, '');
      if (!word) return new Notice('选中的不是英文单词');
      const info = await lookupEnglish(word);
      await this.addVocab({ ...info, word, context: text.slice(0, 240) });
    });
    mk('📝记笔记', async () => {
      await this.appendSmallNote(text);
    });
    mk('🔊朗读', () => {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    });
    mk('🔍翻译', async () => {
      const t = await translateSentence(text);
      new Notice(t || '翻译失败', 8000);
    });
    document.body.appendChild(bar);
    const w = bar.getBoundingClientRect().width;
    bar.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2)) + 'px';
    bar.style.top = Math.max(8, rect.top - 42) + 'px';
    this._selBar = bar;
    setTimeout(() => {
      const off = (ev) => { if (!bar.contains(ev.target)) { bar.remove(); document.removeEventListener('mousedown', off, true); } };
      document.addEventListener('mousedown', off, true);
    }, 0);
  }

  async appendSmallNote(text) {
    const folder = this.data.settings.noteFolder;
    await this.ensureFolder(folder);
    const path = `${folder}/英语精读摘录.md`;
    const adapter = this.app.vault.adapter;
    const found = this.app.workspace.getActiveViewOfType?.(EnglishReaderView);
    const src = this._currentSource || '';
    const line = `- ${text.replace(/\n+/g, ' ')}${src ? ' — ' + src : ''}\n`;
    if (!(await adapter.exists(path))) {
      await adapter.write(path, `---\ntags: [english/excerpt]\n---\n\n# 英语精读摘录\n\n${line}`);
    } else {
      await adapter.append(path, line);
    }
    new Notice('已记到摘录清单');
  }

  /* ---------- 视图 ---------- */
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}

module.exports = EnglishReaderPlugin;
module.exports.default = EnglishReaderPlugin;
// 供本地测试使用
module.exports.__dayKey = dayKey;
module.exports.__reviewModal = ReviewModal;
module.exports.__srs = { SRS_INTERVALS, SRS_MAX_LEVEL, DAY_MS };
module.exports.__test = { parseFeedXml, extractTranscriptFromHtml, parseVttOrSrt, splitSentences, sanitizeHtml, parseTimeStr, findSpeechBounds, encodeWav16 };
module.exports.__view = EnglishReaderView;
module.exports.__vocabModal = VocabModal;
module.exports.__settingTab = EnglishReaderSettingTab;
module.exports.__discoverModal = DiscoverModal;
module.exports.__mistakeModal = MistakeModal;
module.exports.__statModal = StatModal;
module.exports.__stats = { mistakeKey, statSeries, monthStat, heatmapWeeks };
module.exports.__listen = { mergeHours, topShows, listenDiscoveries, clockLabel, ringSlice, rideText, renderClockRing };
module.exports.__asrSetup = ASR_SETUP;
module.exports.__asrWizard = { ASR_WIZARD, AsrWizardModal, asrWizardUrl, asrWizardDetectPython, asrWizardBaseDir, asrWizardSha256 };
module.exports.__blind = { pickBlindSegs, segSpan, blindRatio, blindWeeks, BLIND_MIN_SENTENCES };
module.exports.__blindModal = BlindModal;
module.exports.__shadow = { scoreShadow, shadowTokens, lcsPairs };
module.exports.__presets = PRESETS;
module.exports.__friendlyFeedError = friendlyFeedError;
module.exports.__welcomeModal = WelcomeModal;
module.exports.__dropVideo = dropVideoOnly;
module.exports.__optionalAddons = optionalAddons;
module.exports.__quote = { quoteLineFor, shadowAdvance };
