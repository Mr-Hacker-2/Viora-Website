/* Routing eval: scores the current router and the legacy one on labelled prompts, then compares with the last saved run.
   This measures ROUTING accuracy only. It says nothing about the quality of the answers the server's models give. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { classify } from '../assets/x/router.js';
const legacy = (t, page) => { const x = t.toLowerCase();
  if (page && /\b(click|fill|sign ?up|log ?in|form|navigate|automate|button)\b/.test(x)) return 'automate';
  if (/humani[sz]e|paraphrase|rewrite this|sound (more )?(human|natural)/.test(x)) return 'human';
  if (/```|\b(bug|error|function|compile|python|javascript|typescript|html|css|sql|regex|code|script|solve|equation|integral|derivative|calculate|algorithm)\b/.test(x)) return 'math';
  const fileQ = page && !/\b(search|look up|online|on the web|latest news)\b/.test(x);
  if (!fileQ && /\b(latest|news|today|current|currently|price|who won|who is|who are|this week|this year|202\d|compare|research|sources|release|weather|score|stock|forecast|trending|election|near me)\b/.test(x)) return 'search';
  return 'flash'; };
const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
const run = fn => { const miss = []; let ok = 0; for (const [t, want, page] of cases) { const got = fn(t, !!page); if (got === want) ok++; else miss.push({ t, want, got }); } return { accuracy: +(ok / cases.length).toFixed(3), correct: ok, total: cases.length, misses: miss }; };
const result = { at: new Date().toISOString(), legacy: run(legacy), current: run((t, p) => classify(t, { hasPage: p }).assistant) };
const dir = new URL('./results/', import.meta.url).pathname; mkdirSync(dir, { recursive: true });
const latest = dir + 'latest.json', prev = dir + 'previous.json';
if (existsSync(latest)) renameSync(latest, prev);
writeFileSync(latest, JSON.stringify(result, null, 2));
const before = existsSync(prev) ? JSON.parse(readFileSync(prev)).current.accuracy : null;
console.log(`legacy router : ${result.legacy.correct}/${result.legacy.total} (${result.legacy.accuracy})`);
console.log(`current router: ${result.current.correct}/${result.current.total} (${result.current.accuracy})` + (before != null ? `   previous run: ${before}` : ''));
for (const m of result.current.misses) console.log('  MISS', JSON.stringify(m));
if (before != null && result.current.accuracy < before) { console.error('REGRESSION vs previous run'); process.exit(1); }
