/* Optional live model evaluation. Uses only a caller-supplied endpoint/token and fixed synthetic prompts. */
import { readFileSync } from 'node:fs';

const base = process.env.VIORA_EVAL_URL;
const token = process.env.VIORA_EVAL_TOKEN;
if (!base || !token) {
  console.error('Set VIORA_EVAL_URL and VIORA_EVAL_TOKEN to run live AI evaluations. Values are never printed.');
  process.exit(2);
}
const endpoint = base.endsWith('/api/chat') ? base : base.replace(/\/$/, '') + '/api/chat';
const cases = JSON.parse(readFileSync(new URL('./ai-cases.json', import.meta.url), 'utf8'));
const rows = [];
for (const c of cases) {
  const started = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Number(process.env.VIORA_EVAL_TIMEOUT_MS) || 120000);
  let responseText = '', sources = [], terminal = false, error = '';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ assistant: c.assistant, web: !!c.web, researchMode: 'quick', messages: c.messages, context: {}, intelligence: { review: !!c.review } }),
      signal: ctl.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '';
    const event = line => {
      if (!line.startsWith('data:')) return;
      const value = line.slice(5).trim();
      if (!value) return;
      if (value === '[DONE]') { terminal = true; return; }
      try {
        const data = JSON.parse(value);
        if (data.viora_incomplete) error = data.viora_incomplete.message || 'incomplete provider stream';
        if (Array.isArray(data.viora_sources)) sources = data.viora_sources;
        const text = data.choices?.[0]?.delta?.content;
        if (typeof text === 'string') responseText += text;
      } catch { /* unrelated SSE payload */ }
    };
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const parts = buffer.split(/\r?\n/); buffer = parts.pop() || '';
      parts.forEach(event);
      if (done) break;
    }
    if (buffer) event(buffer);
  } catch (e) { error = e.name === 'AbortError' ? 'timeout' : e.message; }
  finally { clearTimeout(timer); }
  const latencyMs = Math.round(performance.now() - started);
  const lowered = responseText.toLowerCase();
  const contentCheck = c.mustIncludeAny.some(term => lowered.includes(term.toLowerCase()));
  const cited = [...responseText.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]));
  // This is index validity only; semantic support for the cited claim needs human or separate-model review.
  const validCitationCount = cited.filter(n => n >= 1 && n <= sources.length).length;
  const citationIndexPrecision = cited.length ? +(validCitationCount / cited.length).toFixed(3) : (c.web ? 0 : null);
  const citationCheck = !c.web || (sources.length > 0 && cited.length > 0 && validCitationCount === cited.length);
  const completed = terminal && !error && !!responseText.trim();
  const qualityCheck = contentCheck && citationCheck;
  rows.push({ id: c.id, category: c.category, latencyMs, completed, qualityCheck, contentCheck, sourceCount: sources.length, citationCount: cited.length, invalidCitationCount: cited.length - validCitationCount, citationIndexPrecision, error: error || undefined });
}
const sorted = rows.map(r => r.latencyMs).sort((a, b) => a - b);
const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] || 0;
const report = {
  at: new Date().toISOString(),
  endpoint: endpoint.replace(/\/api\/chat$/, ''),
  cases: rows,
  summary: {
    total: rows.length,
    completed: rows.filter(r => r.completed).length,
    qualityPasses: rows.filter(r => r.qualityCheck).length,
    citationIndexPrecision: (() => { const refs = rows.filter(r => r.citationCount); return refs.length ? +(refs.reduce((n, r) => n + r.citationCount - r.invalidCitationCount, 0) / refs.reduce((n, r) => n + r.citationCount, 0)).toFixed(3) : null; })(),
    meanLatencyMs: Math.round(rows.reduce((n, r) => n + r.latencyMs, 0) / rows.length),
    p95LatencyMs: p95
  }
};
console.log(JSON.stringify(report, null, 2));
if (rows.some(r => !r.completed || !r.qualityCheck)) process.exitCode = 1;
