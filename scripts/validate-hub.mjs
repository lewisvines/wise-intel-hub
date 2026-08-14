import { readFileSync } from 'node:fs';

const source = readFileSync('src/index.html', 'utf8');
const data = JSON.parse(readFileSync('signals.json', 'utf8'));
const monitorConfig = JSON.parse(readFileSync('config/intelligence_sources.json', 'utf8'));
const monitorState = JSON.parse(readFileSync('monitor_state.json', 'utf8'));
const errors = [];
const warnings = [];

const fail = (condition, message) => { if (!condition) errors.push(message); };
const warn = (condition, message) => { if (!condition) warnings.push(message); };

const versionMarker = source.match(/^<!DOCTYPE html><!-- WiSE Intel Hub v(\d+) - [^\r\n]+ -->/);
fail(Boolean(versionMarker), 'source version marker is missing or invalid');
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
const directUrl = value => {
  try {
    const parsed = new URL(String(value || ''));
    const host = parsed.hostname.toLowerCase();
    const bannedHosts = new Set([
      'vertexaisearch.cloud.google.com', 'google.com', 'www.google.com',
      'news.google.com', 'bing.com', 'www.bing.com', 'localhost'
    ]);
    const route = `${parsed.pathname}?${parsed.searchParams}`.toLowerCase();
    return parsed.protocol === 'https:' && !bannedHosts.has(host) &&
      parsed.pathname !== '/' && !route.includes('/search') &&
      !route.includes('/rss') && !route.includes('grounding-api-redirect');
  } catch {
    return false;
  }
};
const watchUrl = value => {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' && !['google.com','www.google.com','news.google.com','bing.com','www.bing.com','localhost'].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};
fail(Array.isArray(monitorConfig.monitoring_lenses) && monitorConfig.monitoring_lenses.length === 6,
  'monitor configuration must define all six intelligence lenses');
fail(Array.isArray(monitorConfig.watch_pages) && monitorConfig.watch_pages.length >= 12,
  'official-page watch list is too narrow for proactive price and hiring detection');
for (const page of monitorConfig.watch_pages || []) {
  fail(String(page.entity || '').length > 1, 'official-page watch entry has no entity');
  fail(['pricing','careers','newsroom','events'].includes(page.kind), `${page.entity}: unsupported official-page watch kind`);
  fail(watchUrl(page.url), `${page.entity}: official-page watch URL is not durable HTTPS evidence`);
  fail(Array.isArray(page.markets) && page.markets.length > 0, `${page.entity}: official-page watch has no market scope`);
}
fail(monitorState?.meta?.schema_version === 1 && monitorState.pages && typeof monitorState.pages === 'object',
  'monitor_state.json has an invalid schema');
const evidenceAware = active.filter(s => s.evidence_status || s.source_url || s.event_date || s.published_at);
for (const signal of evidenceAware) {
  fail(hasUrl(signal), `${signal.id}: evidence-aware record has no direct HTTPS URL`);
  fail(isIso(signal.event_date || signal.published_at || signal.date), `${signal.id}: evidence-aware record has no exact event date`);
  fail(isIso(signal.accessed_at), `${signal.id}: evidence-aware record has no exact access date`);
  fail(['primary','secondary','internal'].includes(signal.source_type), `${signal.id}: invalid source_type`);
  fail(['verified','corroborated','pending'].includes(signal.evidence_status), `${signal.id}: invalid evidence_status`);
  if (['critical','high'].includes(signal.priority)) {
    fail(signal.evidence_status !== 'pending', `${signal.id}: critical/high evidence remains pending`);
  }
}

const allowedMarkets = new Set([
  'EU','FR','ES','DE','PT','IT','NL','BE','LU','IE','AT','PL','CZ','SK','HU','RO',
  'BG','HR','SI','GR','CY','MT','SE','DK','FI','EE','LV','LT','GB','US'
]);
const euMarkets = new Set([...allowedMarkets].filter(market => !['GB','US'].includes(market)));
const eventTypes = new Set(['Hiring','Marketing','Launch','Pricing','Messaging','Expansion','Investment','M&A','Partnership','Regulatory','AI capability']);
const qualityCurrent = active.filter(signal => signal.quality_version === 3);
fail(active.every(signal => signal.quality_version === 3), 'active feed contains legacy or pre-v3 intelligence');
fail(active.length <= 42, 'active verified portfolio exceeds its 42-signal decision limit');
for (const signal of qualityCurrent) {
  fail(allowedMarkets.has(signal.market), `${signal.id}: unsupported market code`);
  fail(['Competitive','Regulatory','AI & Tech','Pricing','Hiring','Brand','Partnership','M&A'].includes(signal.category),
    `${signal.id}: unsupported signal category`);
  fail(eventTypes.has(signal.event_type), `${signal.id}: unsupported event type`);
  fail(String(signal.entity || '').length > 1, `${signal.id}: named entity is missing`);
  fail(isIso(signal.event_date), `${signal.id}: exact event date is missing`);
  fail(['published','observed_change'].includes(signal.date_basis), `${signal.id}: invalid date basis`);
  if (signal.date_basis === 'published') {
    fail(isIso(signal.published_at), `${signal.id}: published evidence lacks an exact publication date`);
    fail(signal.published_at === signal.event_date, `${signal.id}: publication and event dates differ`);
  }
  fail(directUrl(signal.source_url), `${signal.id}: source is not a durable direct evidence URL`);
  fail(['primary','secondary'].includes(signal.source_type), `${signal.id}: source must be public evidence`);
  fail(['verified','corroborated'].includes(signal.evidence_status), `${signal.id}: record did not pass evidence verification`);
  fail(isIso(signal.source_checked_at?.slice(0, 10)), `${signal.id}: source check timestamp is missing`);
  fail(Number(signal.source_http_status) >= 200 && Number(signal.source_http_status) < 400,
    `${signal.id}: source HTTP verification is invalid`);
  fail(Array.isArray(signal.source_match_terms) && signal.source_match_terms.length > 0,
    `${signal.id}: claim-to-source match evidence is missing`);
  fail(/^[a-f0-9]{64}$/.test(String(signal.source_content_sha256 || '')),
    `${signal.id}: immutable source snapshot hash is missing`);
  fail(signal.source_content_type !== 'application/pdf', `${signal.id}: unparsed PDF was used as decisive evidence`);
  fail(isIso(signal.first_seen_at), `${signal.id}: first-seen date is missing`);
  fail(Array.isArray(signal.affected_eu_markets) && signal.affected_eu_markets.length > 0,
    `${signal.id}: affected EU markets are missing`);
  fail((signal.affected_eu_markets || []).every(market => euMarkets.has(market)),
    `${signal.id}: affected EU markets contain an invalid code`);
  fail(String(signal.relevance_reason || '').length >= 50,
    `${signal.id}: European relevance is not specific enough`);
  fail(String(signal.materiality_reason || '').length >= 40,
    `${signal.id}: materiality threshold is not explained`);
  fail(signal.discovered_by === 'wise-signal-scanner-v6', `${signal.id}: scanner provenance is missing`);
  if (['GB','US'].includes(signal.market)) {
    fail(signal.eu_relevance === 'read_across', `${signal.id}: UK/US signal lacks a European read-across`);
  } else {
    fail(signal.eu_relevance === 'direct', `${signal.id}: EU signal is not marked as directly relevant`);
  }
  if (['critical','high'].includes(signal.priority) && signal.source_type === 'secondary') {
    fail(directUrl(signal.corroborating_url), `${signal.id}: high-impact secondary claim lacks durable corroboration`);
    fail(signal.evidence_status === 'corroborated', `${signal.id}: high-impact secondary claim is not corroborated`);
  }
  if (['Pricing','Messaging'].includes(signal.event_type)) {
    fail(directUrl(signal.baseline_url), `${signal.id}: change claim lacks a historical baseline URL`);
    fail(isIso(signal.baseline_date), `${signal.id}: change claim lacks an exact baseline date`);
    fail(String(signal.previous_state || '').length >= 12 && String(signal.current_state || '').length >= 12,
      `${signal.id}: change claim lacks before and after states`);
    fail(/^[a-f0-9]{64}$/.test(String(signal.baseline_content_sha256 || '')),
      `${signal.id}: historical baseline snapshot hash is missing`);
  }
  if (signal.date_basis === 'observed_change') {
    fail(signal.event_date === signal.first_seen_at, `${signal.id}: observed-change date is not the scanner's first-seen date`);
  }
  if (signal.event_type === 'Hiring') {
    fail(['leadership','cluster','new_country_team','strategic_capability'].includes(signal.hiring_signal_kind),
      `${signal.id}: hiring signal kind is not material`);
    if (signal.hiring_signal_kind === 'cluster') {
      fail(Number(signal.hiring_role_count) >= 3, `${signal.id}: hiring cluster has fewer than three evidenced roles`);
    }
  }
  if (signal.event_type === 'Marketing') {
    fail(['major_event','campaign','sponsorship','keynote'].includes(signal.marketing_signal_kind),
      `${signal.id}: marketing signal kind is not material`);
  }
  if (signal.event_type === 'Expansion') {
    fail(['legal_entity','office','country_leadership','hiring_cluster','market_launch'].includes(signal.expansion_evidence_kind),
      `${signal.id}: expansion signal lacks concrete market-entry evidence`);
  }
}

if (data.meta.scan_status?.quality_version === 3) {
  const scanned = data.meta.scan_status.markets_scanned || [];
  const skipped = data.meta.scan_status.markets_skipped || [];
  fail(new Set([...scanned, ...skipped]).size === 7,
    'latest scan health does not account for all seven EU/UK/US coverage lanes');
  fail(['complete','partial'].includes(data.meta.scan_status.status),
    'latest scan health has no explicit complete/partial status');
  const requiredLenses = new Set(['hiring','marketing','launches','pricing','messaging','expansion_investment']);
  for (const [lane, coverage] of Object.entries(data.meta.scan_status.coverage || {})) {
    if (coverage.status === 'complete') {
      const checked = new Set(coverage.lenses_checked || []);
      fail([...requiredLenses].every(lens => checked.has(lens)), `${lane}: complete scan did not check all monitoring lenses`);
    }
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
console.log(`Automated quality contract: ${qualityCurrent.length} v3 verified signals.`);
warnings.forEach(message => console.warn(`WARN: ${message}`));
if (errors.length) {
  errors.forEach(message => console.error(`ERROR: ${message}`));
  process.exit(1);
}
console.log('Hub validation passed.');
