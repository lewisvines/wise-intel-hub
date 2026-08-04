import { readFileSync } from 'node:fs';

const source = readFileSync('src/index.html', 'utf8');
const data = JSON.parse(readFileSync('signals.json', 'utf8'));
const errors = [];
const warnings = [];

const fail = (condition, message) => { if (!condition) errors.push(message); };
const warn = (condition, message) => { if (!condition) warnings.push(message); };

fail(source.includes('WiSE Intel Hub v12'), 'source version marker is not v12');
fail(source.includes('id="trust-strip"'), 'Today trust strip is missing');
fail(source.includes('id="page-decisions"'), 'Decisions & Evidence page is missing');
fail(source.includes('THE ASK'), 'decision material does not contain THE ASK');
fail(!source.includes("const BRIEF_API = '/api/brief'"), 'dead GitHub Pages brief endpoint is still configured');
fail(!source.includes("fetch('/api/signals'"), 'dead GitHub Pages signals endpoint is still configured');
fail(source.includes("const SIGNALS_URL = 'signals.json';"), 'signals loader is not using the committed same-origin feed');
fail(source.includes("document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));"),
  'navigation does not refresh the page list for late-declared decision pages');
fail(source.includes('id="mobile-menu-btn"'), 'mobile navigation control is missing');
fail(source.includes('#sidebar.mobile-open{transform:translateX(0);'), 'mobile sidebar open state is missing');

const openGroupPos = source.indexOf('function openGroupForPage');
const showPagePos = source.indexOf('function showPage');
const firstInitPos = source.indexOf("showPage('dashboard')");
fail(openGroupPos >= 0 && openGroupPos < showPagePos && showPagePos < firstInitPos,
  'navigation helpers are declared after first-page initialisation');

fail(data && data.meta && Array.isArray(data.signals), 'signals.json must contain {meta, signals[]}');
const signals = Array.isArray(data.signals) ? data.signals : [];
const ids = signals.map(s => s.id).filter(Boolean);
fail(new Set(ids).size === ids.length, 'signals.json contains duplicate IDs');
fail(ids.length === signals.length, 'one or more signals have no ID');

const active = signals.filter(s => !s.archived);
fail(data.meta.signal_count === active.length,
  `meta.signal_count (${data.meta.signal_count}) does not match active signals (${active.length})`);
fail((data.meta.archived_count || 0) === signals.length - active.length,
  'meta.archived_count does not match the signal array');

const isIso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const hasUrl = signal => /^https:\/\//i.test(String(signal.source_url || signal.link || ''));
const evidenceAware = active.filter(s => s.evidence_status || s.source_url || s.published_at);
for (const signal of evidenceAware) {
  fail(hasUrl(signal), `${signal.id}: evidence-aware record has no direct HTTPS URL`);
  fail(isIso(signal.published_at || signal.date), `${signal.id}: evidence-aware record has no exact publication date`);
  fail(isIso(signal.accessed_at), `${signal.id}: evidence-aware record has no exact access date`);
  fail(['primary','secondary','internal'].includes(signal.source_type), `${signal.id}: invalid source_type`);
  fail(['verified','corroborated','pending'].includes(signal.evidence_status), `${signal.id}: invalid evidence_status`);
  if (['critical','high'].includes(signal.priority)) {
    fail(signal.evidence_status !== 'pending', `${signal.id}: critical/high evidence remains pending`);
  }
}

const sourceCoverage = active.filter(hasUrl).length;
const dateCoverage = active.filter(s => isIso(s.published_at || s.date)).length;
warn(sourceCoverage === active.length,
  `legacy evidence debt: ${active.length - sourceCoverage} active signals have no source URL`);
warn(dateCoverage === active.length,
  `legacy evidence debt: ${active.length - dateCoverage} active signals lack an exact date`);

const current = new Date();
const monday = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
const fmt = d => `${d.getUTCDate()} ${d.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}`;
const expectedWeek = `Week of ${fmt(monday)} - ${fmt(sunday)} ${sunday.getUTCFullYear()}`;
warn(data.meta.week_label === expectedWeek,
  `week_label is '${data.meta.week_label}', expected '${expectedWeek}'`);

console.log(`Hub validation: ${active.length} active signals; source URLs ${sourceCoverage}/${active.length}; exact dates ${dateCoverage}/${active.length}.`);
warnings.forEach(message => console.warn(`WARN: ${message}`));
if (errors.length) {
  errors.forEach(message => console.error(`ERROR: ${message}`));
  process.exit(1);
}
console.log('Hub validation passed.');
