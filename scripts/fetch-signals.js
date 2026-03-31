/**
 * WiSE Intel Hub — Daily Signal Fetcher v3
 * 80+ sources across competitors, regulatory, market press, accounting bodies,
 * AI/tech, Sage news, venture capital and credible analyst publications
 * Cost: £0 — GitHub Actions free tier
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

const FEEDS = [
  // ── COMPETITOR DIRECT BLOGS ──────────────────────────────────────────
  { url:'https://blog.pennylane.com/feed/', source:'Pennylane Blog', category:'Competitive', market:'FR', topic:'competitor', label:'Pennylane', maxItems:3 },
  { url:'https://www.cegid.com/fr/blog/feed/', source:'Cegid Blog', category:'Competitive', market:'EU', topic:'competitor', label:'Cegid', maxItems:2 },
  { url:'https://www.holded.com/es/blog/feed/', source:'Holded Blog', category:'Competitive', market:'ES', topic:'competitor', label:'Holded', maxItems:2 },
  { url:'https://www.xero.com/blog/feed/', source:'Xero Blog', category:'Competitive', market:'EU', topic:'competitor', label:'Xero', maxItems:2, keywords:['accounting','accountant','AI','europe','invoice','compliance'] },
  { url:'https://quickbooks.intuit.com/blog/feed/', source:'QuickBooks Blog', category:'Competitive', market:'EU', topic:'competitor', label:'QuickBooks', maxItems:2, keywords:['AI','accountant','invoice','automation','europe'] },
  { url:'https://lexoffice.de/blog/feed/', source:'Lexoffice Blog', category:'Competitive', market:'DE', topic:'competitor', label:'Lexoffice', maxItems:2 },

  // ── COMPETITOR GOOGLE NEWS ──────────────────────────────────────────
  { url:'https://news.google.com/rss/search?q=Pennylane+accounting+fintech+Europe&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Competitive', market:'FR', topic:'competitor', label:'Pennylane EN', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Pennylane+expert-comptable+financement+levee+France&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Competitive', market:'FR', topic:'competitor', label:'Pennylane FR', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Pennylane+Spain+expansion+launch+2026&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Competitive', market:'ES', topic:'competitor', label:'Pennylane Spain', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Cegid+EBP+Shine+acquisition+comptabilite+France&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Competitive', market:'FR', topic:'competitor', label:'Cegid FR', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Cegid+Silver+Lake+accounting+Europe+2025&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Competitive', market:'EU', topic:'competitor', label:'Cegid EN', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Holded+Visma+Spain+software+contabilidad&hl=es&gl=ES&ceid=ES:es', source:'Google News ES', category:'Competitive', market:'ES', topic:'competitor', label:'Holded ES', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=DATEV+Steuerberater+cloud+software+Germany&hl=de&gl=DE&ceid=DE:de', source:'Google News DE', category:'Competitive', market:'DE', topic:'competitor', label:'DATEV DE', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Qonto+Regate+acquisition+comptabilite+France&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Competitive', market:'FR', topic:'competitor', label:'Qonto/Regate', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Lexoffice+SevDesk+Buchhaltung+cloud+Deutschland&hl=de&gl=DE&ceid=DE:de', source:'Google News DE', category:'Competitive', market:'DE', topic:'competitor', label:'DE Cloud Tools', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=MyUnisoft+Conciliator+Dext+France+cabinet+comptable&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Competitive', market:'FR', topic:'competitor', label:'FR Challengers', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=A3+Wolters+Kluwer+software+despachos+Espana&hl=es&gl=ES&ceid=ES:es', source:'Google News ES', category:'Competitive', market:'ES', topic:'competitor', label:'A3/Wolters ES', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=accounting+software+startup+funding+Series+Europe&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Competitive', market:'EU', topic:'competitor', label:'EU Accounting Funding', maxItems:3 },

  // ── REGULATORY OFFICIAL SOURCES ─────────────────────────────────────
  { url:'https://www.impots.gouv.fr/actualites/rss', source:'DGFiP Officiel', category:'Regulatory', market:'FR', topic:'regulatory', label:'DGFiP', maxItems:3 },
  { url:'https://www.agenciatributaria.es/rss/novedades.xml', source:'AEAT Spain', category:'Regulatory', market:'ES', topic:'regulatory', label:'AEAT Spain', maxItems:3 },
  { url:'https://www.bundesfinanzministerium.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/RSS_Aktuelle_Meldungen.xml', source:'BMF Germany', category:'Regulatory', market:'DE', topic:'regulatory', label:'BMF Germany', maxItems:2 },

  // ── REGULATORY GOOGLE NEWS ───────────────────────────────────────────
  { url:'https://news.google.com/rss/search?q=facturation+electronique+France+DGFiP+plateforme+agreee+2026&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Regulatory', market:'FR', topic:'regulatory', label:'FR PA Mandate', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Verifactu+facturacion+electronica+Espana+AEAT+2027&hl=es&gl=ES&ceid=ES:es', source:'Google News ES', category:'Regulatory', market:'ES', topic:'regulatory', label:'ES Verifactu', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=XRechnung+ZUGFeRD+E-Rechnung+Deutschland+Pflicht+2027&hl=de&gl=DE&ceid=DE:de', source:'Google News DE', category:'Regulatory', market:'DE', topic:'regulatory', label:'DE XRechnung', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=SAF-T+Portugal+fatura+AT+obrigatorio&hl=pt&gl=PT&ceid=PT:pt', source:'Google News PT', category:'Regulatory', market:'PT', topic:'regulatory', label:'PT SAF-T', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=EU+eInvoicing+VAT+digital+age+directive+mandate&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Regulatory', market:'EU', topic:'regulatory', label:'EU eInvoicing', maxItems:2 },

  // ── ACCOUNTING PRESS DIRECT ─────────────────────────────────────────
  { url:'https://www.accountingweb.co.uk/feed', source:'AccountingWEB UK', category:'Market Intelligence', market:'EU', topic:'market', label:'AccountingWEB', maxItems:3, keywords:['software','AI','automation','cloud','invoice','MTD','practice','fintech'] },
  { url:'https://www.accountingtoday.com/feed', source:'Accounting Today', category:'Market Intelligence', market:'EU', topic:'market', label:'Accounting Today', maxItems:2, keywords:['AI','automation','software','cloud','technology','practice'] },
  { url:'https://www.cpapracticeadvisor.com/feed/', source:'CPA Practice Advisor', category:'Market Intelligence', market:'EU', topic:'market', label:'CPA Practice Advisor', maxItems:2, keywords:['AI','automation','software','cloud','technology'] },
  { url:'https://www.finyear.com/rss.xml', source:'Finyear', category:'Market Intelligence', market:'FR', topic:'market', label:'Finyear FR', maxItems:2 },
  { url:'https://www.journaldunet.com/economie/finance/rss/', source:'Journal du Net', category:'Market Intelligence', market:'FR', topic:'market', label:'Journal du Net FR', maxItems:2, keywords:['comptabilit','logiciel','expert-comptable','factur','fintech','PME'] },

  // ── VENTURE CAPITAL & EU TECH ────────────────────────────────────────
  { url:'https://sifted.eu/feed/', source:'Sifted', category:'Competitive', market:'EU', topic:'competitor', label:'Sifted EU Tech', maxItems:3, keywords:['accounting','fintech','B2B','invoice','payment','CFO','finance','SaaS'] },
  { url:'https://eu-startups.com/feed/', source:'EU-Startups', category:'Competitive', market:'EU', topic:'competitor', label:'EU-Startups', maxItems:2, keywords:['accounting','fintech','B2B','invoice','SaaS','finance'] },
  { url:'https://www.maddyness.com/feed/', source:'Maddyness FR', category:'Competitive', market:'FR', topic:'competitor', label:'Maddyness FR', maxItems:2, keywords:['comptabilit','fintech','factur','logiciel','levee','startups'] },
  { url:'https://www.finsmes.com/feed', source:'FinSMEs', category:'Competitive', market:'EU', topic:'competitor', label:'FinSMEs Funding', maxItems:2, keywords:['accounting','invoicing','fintech','SME','bookkeeping','Europe'] },
  { url:'https://techcrunch.com/category/fintech/feed/', source:'TechCrunch Fintech', category:'Competitive', market:'EU', topic:'competitor', label:'TechCrunch Fintech', maxItems:2, keywords:['accounting','invoice','bookkeeping','SME','Europe'] },
  { url:'https://news.google.com/rss/search?q=fintech+accounting+Europe+Series+funding+raise+2025&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Competitive', market:'EU', topic:'competitor', label:'EU Fintech Funding', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=levee+fonds+logiciel+comptable+fintech+France+2025&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Competitive', market:'FR', topic:'competitor', label:'FR Fintech Funding', maxItems:2 },

  // ── AI & TECH DIRECT ─────────────────────────────────────────────────
  { url:'https://feeds.feedburner.com/TechCrunch/', source:'TechCrunch', category:'AI & Tech', market:'EU', topic:'ai', label:'TechCrunch', maxItems:2, keywords:['accounting software','bookkeeping AI','fintech AI','accounting automation','invoice AI'] },
  { url:'https://venturebeat.com/feed/', source:'VentureBeat', category:'AI & Tech', market:'EU', topic:'ai', label:'VentureBeat', maxItems:2, keywords:['accounting AI','finance AI','bookkeeping automation','CFO AI','accounting software'] },
  { url:'https://www.technologyreview.com/feed/', source:'MIT Tech Review', category:'AI & Tech', market:'EU', topic:'ai', label:'MIT Tech Review', maxItems:2, keywords:['AI accounting','automation finance','AI enterprise','generative AI business'] },
  { url:'https://www.theregister.com/software/applications/feed.atom', source:'The Register', category:'AI & Tech', market:'EU', topic:'ai', label:'The Register', maxItems:2, keywords:['accounting','ERP','AI finance','invoice automation','bookkeeping'] },
  { url:'https://www.zdnet.com/topic/artificial-intelligence/rss.xml', source:'ZDNet AI', category:'AI & Tech', market:'EU', topic:'ai', label:'ZDNet AI', maxItems:2, keywords:['accounting','finance AI','enterprise AI','automation business'] },
  { url:'https://www.infoworld.com/category/artificial-intelligence/index.rss', source:'InfoWorld', category:'AI & Tech', market:'EU', topic:'ai', label:'InfoWorld AI', maxItems:2, keywords:['accounting','ERP','finance','automation','enterprise software'] },

  // ── AI GOOGLE NEWS ───────────────────────────────────────────────────
  { url:'https://news.google.com/rss/search?q=AI+accounting+automation+accountant+software+Europe&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'AI & Tech', market:'EU', topic:'ai', label:'AI Accounting EU', maxItems:4 },
  { url:'https://news.google.com/rss/search?q=intelligence+artificielle+comptabilite+expert+comptable+cabinet&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'AI & Tech', market:'FR', topic:'ai', label:'IA Comptabilite FR', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=inteligencia+artificial+contabilidad+despacho+Espana&hl=es&gl=ES&ceid=ES:es', source:'Google News ES', category:'AI & Tech', market:'ES', topic:'ai', label:'IA Contabilidad ES', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=KI+Buchhaltung+Steuerberater+Automatisierung+Deutschland&hl=de&gl=DE&ceid=DE:de', source:'Google News DE', category:'AI & Tech', market:'DE', topic:'ai', label:'KI Buchhaltung DE', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=generative+AI+finance+copilot+accounting+2025&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'AI & Tech', market:'EU', topic:'ai', label:'Generative AI Finance', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=autonomous+AI+agent+accounting+bookkeeping+automation&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'AI & Tech', market:'EU', topic:'ai', label:'AI Agents Accounting', maxItems:2 },

  // ── SAGE NEWS DIRECT ─────────────────────────────────────────────────
  { url:'https://www.sage.com/en-gb/blog/feed/', source:'Sage Global Blog', category:'Sage News', market:'EU', topic:'sage', label:'Sage Global', maxItems:3 },
  { url:'https://www.sage.com/fr-fr/blog/feed/', source:'Sage France Blog', category:'Sage News', market:'FR', topic:'sage', label:'Sage France', maxItems:2 },
  { url:'https://www.sage.com/es-es/blog/feed/', source:'Sage Spain Blog', category:'Sage News', market:'ES', topic:'sage', label:'Sage Spain', maxItems:2 },
  { url:'https://developer.sage.com/blog/feed/', source:'Sage Developer', category:'Sage News', market:'EU', topic:'sage', label:'Sage Developer', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Sage+Group+accounting+announcement+product&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Sage News', market:'EU', topic:'sage', label:'Sage Global News', maxItems:2 },

  // ── PROFESSIONAL BODIES ──────────────────────────────────────────────
  { url:'https://www.icaew.com/rss/news', source:'ICAEW', category:'Market Intelligence', market:'EU', topic:'market', label:'ICAEW', maxItems:2, keywords:['software','technology','AI','digital','MTD','invoice','automation','fintech'] },
  { url:'https://www.aicpa-cima.com/news/rss', source:'AICPA-CIMA', category:'Market Intelligence', market:'EU', topic:'market', label:'AICPA-CIMA', maxItems:2, keywords:['technology','AI','automation','software','digital','future of accounting'] },
  { url:'https://news.google.com/rss/search?q=ordre+experts-comptables+France+logiciel+numerique+congres&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Market Intelligence', market:'FR', topic:'market', label:'OEC France', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=ICAC+Espana+contabilidad+digital+despacho+tecnologia&hl=es&gl=ES&ceid=ES:es', source:'Google News ES', category:'Market Intelligence', market:'ES', topic:'market', label:'ICAC Spain', maxItems:2 },

  // ── BUSINESS PRESS ───────────────────────────────────────────────────
  { url:'https://feeds.ft.com/rss/home/uk', source:'Financial Times', category:'Market Intelligence', market:'EU', topic:'market', label:'Financial Times', maxItems:2, keywords:['accounting software','fintech Europe','SME technology','invoice','Pennylane','Cegid','Sage','bookkeeping'] },
  { url:'https://feeds.bbci.co.uk/news/business/rss.xml', source:'BBC Business', category:'Market Intelligence', market:'EU', topic:'market', label:'BBC Business', maxItems:2, keywords:['accounting','fintech','SME software','invoice','AI finance','cloud software'] },
  { url:'https://www.lesechos.fr/rss/rss_finance.xml', source:'Les Echos', category:'Market Intelligence', market:'FR', topic:'market', label:'Les Echos FR', maxItems:2, keywords:['comptabilit','logiciel','fintech','factur','PME','expert-comptable'] },
  { url:'https://www.latribune.fr/rss/rubriques/economie.html', source:'La Tribune', category:'Market Intelligence', market:'FR', topic:'market', label:'La Tribune FR', maxItems:2, keywords:['comptabilit','logiciel','fintech','factur','PME'] },
  { url:'https://www.expansion.com/rss/ultimas-noticias.xml', source:'Expansion ES', category:'Market Intelligence', market:'ES', topic:'market', label:'Expansion ES', maxItems:2, keywords:['contabilidad','software','pyme','fintech','factura','digital','asesor'] },
  { url:'https://www.handelsblatt.com/contentexport/feed/themen/digitalisierung', source:'Handelsblatt DE', category:'Market Intelligence', market:'DE', topic:'market', label:'Handelsblatt DE', maxItems:2, keywords:['Buchhaltung','Steuerberater','Software','Digitalisierung','KMU','Rechnung'] },
  { url:'https://news.google.com/rss/search?q=B2B+payments+invoice+automation+Europe+SME+2025&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Market Intelligence', market:'EU', topic:'market', label:'B2B Payments EU', maxItems:2 },

  // ── MARKET INTELLIGENCE GOOGLE NEWS ─────────────────────────────────
  { url:'https://news.google.com/rss/search?q=expert-comptable+logiciel+cabinet+numerique+France&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Market Intelligence', market:'FR', topic:'market', label:'Expert-Comptable Market', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=despacho+asesor+software+contabilidad+Espana+digital&hl=es&gl=ES&ceid=ES:es', source:'Google News ES', category:'Market Intelligence', market:'ES', topic:'market', label:'Despachos Market', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Steuerberater+Digitalisierung+Kanzlei+Software+Cloud&hl=de&gl=DE&ceid=DE:de', source:'Google News DE', category:'Market Intelligence', market:'DE', topic:'market', label:'Steuerberater Market', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=contabilista+certificado+software+Portugal+digital&hl=pt&gl=PT&ceid=PT:pt', source:'Google News PT', category:'Market Intelligence', market:'PT', topic:'market', label:'Portuguese Accountants', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=cloud+accounting+SME+Europe+adoption+growth+2025&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Market Intelligence', market:'EU', topic:'market', label:'EU Cloud Accounting', maxItems:2 },
];

// ── FETCH ─────────────────────────────────────────────────────────────────────
function fetchUrl(url, timeoutMs = 9000) {
  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WiSE-Intel-Hub/3.0; +https://github.com/lewisvines/wise-intel-hub)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-GB,en;q=0.9,fr;q=0.8,es;q=0.7,de;q=0.6',
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location, timeoutMs).then(resolve);
          return;
        }
        if (res.statusCode !== 200) { resolve(''); return; }
        const chunks = [];
        let size = 0;
        res.on('data', chunk => {
          chunks.push(chunk);
          size += chunk.length;
          if (size > 500000) { req.destroy(); resolve(Buffer.concat(chunks).toString('utf8')); }
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', () => resolve(''));
      });
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve(''); });
      req.on('error', () => resolve(''));
    } catch { resolve(''); }
  });
}

// ── XML PARSER ────────────────────────────────────────────────────────────────
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text',
  isArray: (name) => ['item', 'entry'].includes(name), allowBooleanAttributes: true,
});

function parseItems(xml) {
  if (!xml || xml.length < 100) return [];
  try {
    const doc = parser.parse(xml);
    return doc?.rss?.channel?.item || doc?.feed?.entry || doc?.channel?.item || doc?.['rdf:RDF']?.item || [];
  } catch { return []; }
}

function extractField(item, ...fields) {
  for (const f of fields) {
    const v = item[f];
    if (!v) continue;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'object') {
      if (v['#text']) return String(v['#text']).trim();
      if (v['@_href']) return v['@_href'];
      if (Array.isArray(v) && v[0]) {
        const f0 = v[0];
        if (typeof f0 === 'string') return f0.trim();
        if (f0['#text']) return String(f0['#text']).trim();
        if (f0['@_href']) return f0['@_href'];
      }
    }
  }
  return '';
}

function stripHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&nbsp;/g,' ')
    .replace(/\s+/g,' ').trim();
}

function parseDate(item) {
  const raw = extractField(item, 'pubDate','published','updated','dc:date','date');
  if (!raw) return new Date().toISOString().split('T')[0];
  try { const d = new Date(raw); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; } catch {}
  return new Date().toISOString().split('T')[0];
}

function itemMatchesKeywords(item, kws) {
  if (!kws || !kws.length) return true;
  const text = JSON.stringify(item).toLowerCase();
  return kws.some(k => text.includes(k.toLowerCase()));
}

const seen = new Set();
function isDuplicate(title) {
  const key = title.toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim().substring(0,80);
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}

// ── IMPLICATION ENGINE ────────────────────────────────────────────────────────
function implication(signal) {
  const { category, market, label='', title='', body='' } = signal;
  const t = (title+' '+body).toLowerCase();
  const l = label.toLowerCase();

  if (category === 'Regulatory') {
    if (market==='FR') return l.includes('dgfip') || t.includes('plateforme') ? 'DGFiP PA mandate September 1 2026 — 154 days. Any update affects GE practice activation urgency. Share with Isabelle Michaud immediately.' : 'France PA mandate September 2026 — regulatory news affects GE practice activation and compliance positioning.';
    if (market==='ES') return 'Verifactu Jan 2027 (corporate) / Jul 2027 (autónomos). Monitor for delays or spec changes affecting Active certification and Spain launch timing.';
    if (market==='DE') return 'Germany XRechnung/ZUGFeRD mandate January 2027 — critical for DATEV partnership positioning and Germany definition year deliverable.';
    if (market==='PT') return 'SAF-T Portugal 2027 — OCC engagement window. AT announcements affect Portugal proposition definition and H1 FY27 GTM.';
    return 'EU regulatory development — assess cross-market impact on pan-EU compliance proposition.';
  }

  if (category === 'Competitive') {
    if (l.includes('pennylane') || t.includes('pennylane')) {
      if (t.includes('spain') || t.includes('espagne') || t.includes('espana')) return '🚨 PENNYLANE SPAIN — H2 2026 confirmed. Sage must convert Despachos practices BEFORE they arrive. Activate Spain launch now.';
      if (t.includes('fund') || t.includes('raise') || t.includes('levée') || t.includes('série')) return '💰 Pennylane funding signal — $4.25B valuation. More capital = more commercial firepower vs Sage in France. Accelerate GE activation.';
      return '⚠ Pennylane is the #1 France threat. Any product launch, partnership or hiring news signals their next move.';
    }
    if (l.includes('cegid') || t.includes('cegid')) {
      if (t.includes('100') || t.includes('commercial') || t.includes('sales')) return '🚨 CEGID deploying 100 new salespeople in France Q2 2026. They are calling your GE practices right now. Immediate outreach critical.';
      return 'Cegid: €967M revenue, 100 new sales reps, EBP + Shine acquired. Any news signals France commercial acceleration.';
    }
    if (l.includes('holded') || t.includes('holded')) {
      if (t.includes('verifactu') || t.includes('certificad')) return 'Holded Verifactu certification — if they certify before Sage penetrates Despachos, their "already compliant" pitch arrives first. Monitor urgently.';
      return 'Holded goes direct to SMEs, bypassing your accountant channel. Affects Despachos window before Verifactu 2027.';
    }
    if (l.includes('datev') || t.includes('datev')) return 'DATEV: cooperative strategic partner. Work alongside, not against. Cloud/API news relevant to "management layer above DATEV compliance" positioning.';
    if (l.includes('qonto') || l.includes('regate') || t.includes('qonto') || t.includes('regate')) return 'Qonto owns Regate (PA-certified). Accounting + banking combo is a direct threat to French accountant channel. Monitor practice partnerships.';
    if (l.includes('xero') || t.includes('xero')) return 'Xero JAX AI is the UK benchmark for accountant-first AI — leading indicator of EU direction. Sets expectation bar for Sage Copilot.';
    if (t.includes('fund') || t.includes('series') || t.includes('raise')) return '💰 Competitor funding in EU accounting software. New capital signals accelerating competition — reassess WiSE GTM priority.';
    return 'Competitive signal in EU accounting software market — assess impact on WiSE positioning and accountant channel strategy.';
  }

  if (category === 'AI & Tech') {
    if (t.includes('autonom') || t.includes('agent') || t.includes('agentic')) return 'Autonomous AI agents in accounting — 3-year horizon. Sage compliance depth is the moat: DSN edge cases and Factur-X rejection patterns beat generic agents.';
    if (t.includes('copilot') || t.includes('assistant')) return 'AI assistant development — benchmark against Sage Copilot compliance-specific capabilities. Specificity beats generic AI in accountant conversations.';
    return 'AI development in accounting/fintech — assess if this shifts the competitive AI landscape or creates new Sage Copilot proof points.';
  }

  if (category === 'Sage News') return 'Sage Group news — monitor for product launches, acquisitions or positioning shifts affecting WiSE narrative or proof points.';

  if (category === 'Market Intelligence') {
    if (market==='FR') return 'French market intelligence — relevant to GE practice activation strategy and France PA mandate communications.';
    if (market==='ES') return 'Spanish market intelligence — relevant to Despachos outreach and Verifactu positioning. Affects GoProposal and Active adoption pace.';
    if (market==='DE') return 'German market intelligence — relevant to definition year strategy and DATEV positioning. Cloud adoption signals affect FY27 GTM.';
    if (market==='PT') return 'Portuguese market intelligence — OCC engagement and SAF-T positioning. Every Contabilista Certificado is a potential channel partner.';
    return 'EU market intelligence — assess relevance to WiSE positioning and accountant channel strategy.';
  }
  return 'Monitor and assess relevance to WiSE strategy across FR, ES, DE and PT.';
}

function urgency(signal) {
  const t = (signal.title+' '+signal.body).toLowerCase();
  const l = (signal.label||'').toLowerCase();
  if (l.includes('pennylane') && (t.includes('spain') || t.includes('fund') || t.includes('launch'))) return 'CRITICAL';
  if (l.includes('cegid') && (t.includes('commercial') || t.includes('100') || t.includes('sales'))) return 'CRITICAL';
  if (signal.category==='Regulatory' && (t.includes('delay') || t.includes('update') || t.includes('report'))) return 'HIGH';
  if (l.includes('pennylane') || l.includes('cegid') || l.includes('holded')) return 'HIGH';
  if (signal.category==='Regulatory') return 'HIGH';
  return 'NORMAL';
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 WiSE Intel Hub — Daily Signal Fetch v3`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📡 ${FEEDS.length} sources\n`);

  const allSignals = [];
  let ok = 0;

  for (const feed of FEEDS) {
    process.stdout.write(`  ${feed.label||feed.source}...`);
    try {
      const xml = await fetchUrl(feed.url);
      const items = parseItems(xml);
      if (!items.length) { process.stdout.write(` ⚠\n`); continue; }
      let added = 0;
      const limit = feed.maxItems || 3;
      for (const item of items.slice(0, limit+8)) {
        if (added >= limit) break;
        if (!itemMatchesKeywords(item, feed.keywords)) continue;
        const title = stripHtml(extractField(item,'title'));
        if (!title || title.length < 10) continue;
        if (isDuplicate(title)) continue;
        const body = stripHtml(extractField(item,'description','content:encoded','content','summary','subtitle')) || 'See source for full details.';
        let link = extractField(item,'link','guid','id','@_href','feedburner:origLink');
        if (typeof link!=='string' || !link.startsWith('http')) link = feed.url;
        const s = {
          title: title.substring(0,160), category: feed.category, market: feed.market,
          topic: feed.topic, source: feed.label||feed.source, date: parseDate(item),
          body: body.substring(0,300), link: link.substring(0,300), implication:'', urgency:'NORMAL'
        };
        s.implication = implication({...s, label: feed.label||''});
        s.urgency = urgency(s);
        allSignals.push(s);
        added++;
      }
      process.stdout.write(` ✅ ${added}\n`);
      ok++;
    } catch (e) { process.stdout.write(` ❌ ${e.message}\n`); }
    await new Promise(r => setTimeout(r, 200));
  }

  const uRank = {CRITICAL:0, HIGH:1, MEDIUM:2, NORMAL:3};
  const cRank = {Regulatory:0, Competitive:1, 'AI & Tech':2, 'Market Intelligence':3, 'Sage News':4};
  allSignals.sort((a,b) => {
    const u = (uRank[a.urgency]??3)-(uRank[b.urgency]??3);
    if (u!==0) return u;
    const d = b.date.localeCompare(a.date);
    if (d!==0) return d;
    return (cRank[a.category]??5)-(cRank[b.category]??5);
  });

  const final = allSignals.slice(0, 80);
  const byCat = {}, byMkt = {};
  final.forEach(s => { byCat[s.category]=(byCat[s.category]||0)+1; byMkt[s.market]=(byMkt[s.market]||0)+1; });
  const criticals = final.filter(s=>s.urgency==='CRITICAL').length;

  console.log(`\n📊 ${ok}/${FEEDS.length} sources OK | ${allSignals.length} signals → ${final.length} after dedup`);
  console.log(`   🚨 Critical: ${criticals}`);
  console.log(`   By category:`, byCat);
  console.log(`   By market:`, byMkt);

  fs.writeFileSync('signals.json', JSON.stringify(final, null, 2), 'utf8');
  console.log(`\n✅ signals.json written — ${final.length} signals, ${fs.statSync('signals.json').size} bytes\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
