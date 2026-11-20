'use strict';
/* 项目Git · 判定引擎（纯 JS，无依赖）
   切条 / 类型判定 / 项目判定 / 父节点打分 / 闸门 / 检索 / 轨迹
*/

const CJK = /[\u4e00-\u9fff]/g;

function nowISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toMs(s) {
  if (!s) return null;
  const t = String(s).trim().replace(/\//g, '-');
  const norm = t.length <= 7 ? t + '-01' : t.replace('T', ' ');
  const d = new Date(norm);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function tokenize(text) {
  if (!text) return new Set();
  const t = String(text).toLowerCase();
  const out = new Set();
  (t.match(/[a-z0-9_\-]{2,}/g) || []).forEach((w) => out.add(w));
  const cjk = (t.match(CJK) || []).join('');
  for (let i = 0; i < cjk.length - 1; i++) out.add(cjk.slice(i, i + 2));
  return out;
}

function overlap(a, b) {
  if (!a || !b || !a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

const TYPE_CUES = {
  decision: ['定了', '就按', '决定', '改为', '改成', '统一为', '暂停', '不做', '批准', '拍板',
    '确认用', '切换到', '取消', '同意', '上线吧', '就用', '延长到', '定为', '不再', '别再加',
    '就算了', '提前', '锁定'],
  plan: ['方案', 'prd', '设计稿', '计划', '排期', '草案', '初稿', '规划'],
  retro: ['复盘', '总结', '教训', '原以为', '结果发现', '踩坑', '回顾', '归因'],
  asset: ['数据表', '看板', '报表', '素材', '大盘', '图表', '链接', '文档库'],
  version: ['发布', '上线了', '版本', '灰度', '回滚', 'tag', 'release'],
};

function scoreType(text) {
  const t = String(text).toLowerCase();
  let best = 0, typ = 'unknown';
  for (const [k, cues] of Object.entries(TYPE_CUES)) {
    const n = cues.reduce((acc, c) => acc + (t.includes(c) ? 1 : 0), 0);
    if (n > best) { best = n; typ = k; }
  }
  if (!best) return ['unknown', 0];
  return [typ, Math.min(1, 0.55 + 0.25 * best)];
}

const HEADER = /^\s*([^\s:：]{1,14})\s+(?:(20\d{2})[-/](\d{1,2})[-/](\d{1,2}))?\s*(?:(\d{1,2}):(\d{2}))?\s*[：:]?\s*(.*)$/;
const NAME_COLON = /^\s*([^\s:：]{1,14})[：:]\s*(.+)$/;
const DATE_IN_LINE = /(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})?/;
const PLACEHOLDER = /\[(图片|语音|表情|视频|文件|链接|动画表情|截图)\]/g;
const ONLY_PLACEHOLDER = /^\s*(?:\[(?:图片|语音|表情|视频|文件|链接|动画表情|截图)\]\s*)+$/;

function scanDate(text, fallback) {
  const m = DATE_IN_LINE.exec(text || '');
  if (!m) return fallback || null;
  const [, y, mo, d] = m;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d || 1).padStart(2, '0')}`;
}

/** 把一段粘贴内容切成信息条目 */
function segment(text, defaultDate) {
  const items = [];
  const dropped = [];
  if (!text) return { kept: items, dropped };
  let cur = null;

  for (const raw of String(text).split(/\r?\n/)) {
    const ln = raw.replace(/\s+$/, '');
    if (!ln.trim()) continue;

    if (ONLY_PLACEHOLDER.test(ln)) {
      const phs = ln.match(PLACEHOLDER) || [];
      const marks = phs.map((x) => x.replace(/[\[\]]/g, ''));
      if (cur) cur.placeholders.push(...marks);
      else {
        cur = { text: ln.trim(), speaker: null, at: scanDate(ln, defaultDate), placeholders: marks, truncated: false };
        items.push(cur);
      }
      continue;
    }

    const m = HEADER.exec(ln);
    const hasStamp = !!(m && (m[2] || m[5]));
    if (m && hasStamp) {
      const at = m[2]
        ? `${String(m[2]).padStart(4, '0')}-${String(m[3]).padStart(2, '0')}-${String(m[4]).padStart(2, '0')}`
        : (defaultDate || null);
      const body = (m[7] || '').trim();
      cur = {
        text: body, speaker: m[1].trim(), at,
        placeholders: (body.match(PLACEHOLDER) || []).map((x) => x.replace(/[\[\]]/g, '')),
        truncated: /…|\.\.\./.test(body),
      };
      items.push(cur);
      continue;
    }

    const m2 = NAME_COLON.exec(ln);
    if (m2 && m2[2].length > 1) {
      const body = m2[2].trim();
      cur = {
        text: body, speaker: m2[1].trim(), at: scanDate(ln, defaultDate),
        placeholders: (body.match(PLACEHOLDER) || []).map((x) => x.replace(/[\[\]]/g, '')),
        truncated: /…|\.\.\./.test(body),
      };
      items.push(cur);
      continue;
    }

    if (cur) {
      cur.text = (cur.text + ' ' + ln.trim()).trim();
      (ln.match(PLACEHOLDER) || []).forEach((x) => cur.placeholders.push(x.replace(/[\[\]]/g, '')));
      if (/…|\.\.\./.test(ln)) cur.truncated = true;
    } else {
      cur = {
        text: ln.trim(), speaker: null, at: scanDate(ln, defaultDate),
        placeholders: (ln.match(PLACEHOLDER) || []).map((x) => x.replace(/[\[\]]/g, '')),
        truncated: /…|\.\.\./.test(ln),
      };
      items.push(cur);
    }
  }

  const kept = [];
  for (const it of items) {
    it.text = (it.text || '').trim();
    if (!it.text && !it.placeholders.length) continue;
    if (it.text.length <= 4 && !it.placeholders.length) { dropped.push(it); continue; }
    kept.push(it);
  }
  return { kept, dropped };
}

const ATTACH_HINTS = ['截图', '如图', '这个图', '附件', '见上图', '补一张', '证据', '原图'];

function classify(item, state, gate) {
  const text = item.text || '';
  const toks = tokenize(text);
  const [typ, tStrength] = scoreType(text);

  // 项目打分
  const projScores = state.projects.map((p) => {
    const hits = (p.keywords || []).filter((k) => text.includes(k)).length;
    const kw = Math.min(1, hits / 2);
    if (item.project) return [p.id, 0.75 * kw + 0.25 * (item.project === p.id ? 1 : 0)];
    return [p.id, kw];
  }).sort((a, b) => b[1] - a[1]);
  const [bestProj, pScore] = projScores[0] || [null, 0];

  // 父节点候选
  const itemMs = toMs(item.at) || toMs(nowISO());
  const cands = [];
  for (const n of state.nodes) {
    if (n.project !== bestProj) continue;
    const ntoks = tokenize((n.title || '') + ' ' + (n.summary || ''));
    const sim = overlap(toks, ntoks);
    const nMs = toMs(n.content_at) || itemMs;
    const deltaDays = (itemMs - nMs) / 86400000;
    let timeScore;
    if (deltaDays < -3) timeScore = 0.15;
    else if (deltaDays <= 40) timeScore = 1 - Math.abs(deltaDays) / 60;
    else timeScore = Math.max(0.1, 1 - deltaDays / 240);
    const affinity = (n.type === 'plan' || n.type === 'decision') ? 1 : 0.6;
    const score = 0.55 * sim + 0.25 * timeScore + 0.2 * affinity;
    cands.push({ id: n.id, score: Math.round(score * 1000) / 1000, title: n.title, project: n.project, type: n.type });
  }
  cands.sort((a, b) => b.score - a.score);
  const top = cands.slice(0, 3);
  const parentScore = top[0] ? top[0].score : 0;
  const margin = top.length > 1 ? top[0].score - top[1].score : (top.length ? 0.3 : 0);

  let conf = 0.45 * tStrength + 0.3 * pScore + 0.25 * parentScore;
  if (tStrength >= 0.8 && pScore >= 0.8) conf += 0.08;
  conf = Math.min(0.98, Math.max(0.05, Math.round(conf * 1000) / 1000));

  const looksAttach = ATTACH_HINTS.some((h) => text.includes(h)) || (item.placeholders || []).length > 0;
  const placement = (looksAttach && top.length && top[0].score >= 0.55) ? 'attach' : 'grow';

  let action = 'queue';
  if (conf >= gate.autoConf && margin >= gate.autoMargin) action = 'auto';
  else if (conf >= gate.autoConf) action = 'popup';

  return {
    type: typ === 'unknown' ? 'plan' : typ,
    typeConfident: typ !== 'unknown',
    project: bestProj,
    parent: top.length ? top[0].id : null,
    candidates: top,
    confidence: conf,
    margin: Math.round(margin * 1000) / 1000,
    placement,
    action,
  };
}

function search(q, state, limit = 8) {
  const qtoks = tokenize(q);
  if (!qtoks.size) return [];
  const hits = [];
  for (const n of state.nodes) {
    if (n.status === 'deleted') continue;
    const sTitle = overlap(qtoks, tokenize(n.title));
    const sSum = overlap(qtoks, tokenize(n.summary));
    const sEx = overlap(qtoks, tokenize((n.source && n.source.excerpt) || ''));
    const sExtra = overlap(qtoks, tokenize(Object.values(n.extra || {}).join(' ')));
    let score = 0.45 * sTitle + 0.25 * sSum + 0.2 * sEx + 0.1 * sExtra;
    if (((n.title || '') + (n.summary || '')).toLowerCase().includes(q.toLowerCase())) score += 0.35;
    if (score > 0.06) hits.push([score, n]);
  }
  hits.sort((a, b) => b[0] - a[0]);
  return hits.slice(0, limit).map(([score, n]) => ({
    id: n.id, title: n.title, project: n.project, type: n.type, status: n.status,
    score: Math.round(score * 1000) / 1000,
    snippet: overlap(qtoks, tokenize((n.source && n.source.excerpt) || '')) > 0.05 ? (n.source && n.source.excerpt) : null,
    locator: n.source && n.source.locator, file: n.source && n.source.file,
  }));
}

function buildTrace(q, hits, state) {
  const steps = [];
  let intent = '找节点';
  if (['还算不算', '有效', '状态', '取代', '作废'].some((k) => q.includes(k))) intent = '问状态';
  else if (['谁', '找谁', '负责'].some((k) => q.includes(k))) intent = '问人';
  steps.push(`① 判意图：${intent}`);
  steps.push(`② 检索：命中 ${hits.length} 个节点（标题 + 摘要 + 原文片段三路）`);
  let conflicts = [];
  if (hits.length) {
    const main = state.nodes.find((n) => n.id === hits[0].id);
    if (main) {
      conflicts = state.nodes.filter((n) => n !== main &&
        n.project === main.project && n.type === main.type &&
        n.status === 'active' && main.status === 'active' &&
        overlap(tokenize(n.title), tokenize(main.title)) > 0.2);
    }
  }
  steps.push(conflicts.length
    ? `③ 校验：发现 ${conflicts.length} 条并存的同类节点 → 需要在回答里指出分歧`
    : '③ 校验：无并存冲突，凭证完整');
  steps.push('④ 输出：命中节点 + 前后脉络 + 凭证定位');
  return steps;
}

module.exports = { segment, classify, search, buildTrace, tokenize, overlap, toMs, nowISO, scoreType };
