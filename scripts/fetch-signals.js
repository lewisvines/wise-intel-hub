/**
 * WiSE Intel Hub — Comprehensive Daily Signal Fetcher v3
 * 
 * SOURCE COVERAGE (90+ sources):
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPETITOR DIRECT BLOGS   Pennylane EN/FR, Cegid FR/Global, Holded ES/EN,
 *                           Xero, QuickBooks, Lexoffice, SevDesk, Qonto, 
 *                           MyUnisoft, Sage Global/FR/Developer
 * 
 * TWITTER/X VIA NITTER      @PennylaneHQ @Cegid_fr @holded @Xero @Qonto
 *                           #facturationelectronique #Verifactu #XRechnung
 *                           #expertcomptable #accountingtech #fintech
 * 
 * PROFESSIONAL BODIES       OEC France, ICJCE Spain, StBdK Germany,
 *                           ICAEW UK, Accountancy Europe (EU)
 * 
 * OFFICIAL REGULATORY       DGFiP France, AEAT Spain, BMF Germany,
 *                           EU Commission Tax, EU Digital Strategy
 * 
 * SPECIALIST ACCOUNTING     AccountingWEB UK, Accountancy Age, Accounting Today,
 * PRESS                     Finyear FR, Journal du Net, Les Echos, Expansion ES,
 *                           Cinco Días, Handelsblatt DE
 * 
 * VC / STARTUP / FUNDING    Sifted EU, EU-Startups.com, Maddyness FR,
 *                           TechCrunch Enterprise, TechCrunch Funding,
 *                           VentureBeat AI
 * 
 * AI & AUTOMATION           MIT Tech Review, Wired Business, AI Business,
 *                           The New Stack
 * 
 * GOOGLE NEWS (40+ feeds)   Targeted FR/ES/DE/PT/EU/EN searches covering:
 *                           competitors, regulatory, market, AI, Sage
 * ─────────────────────────────────────────────────────────────────────────────
 * Cost: £0 | API keys: 0 | Runs daily via GitHub Actions free tier
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

// ── NITTER INSTANCES — Twitter/X RSS without API key ────────────────────────
const NITTER = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.net',
];
let nitterIdx = 0;
function nitterFeed(handle) {
  const base = NITTER[nitterIdx % NITTER.length];
  return `${base}/${handle.replace('@','')}/rss`;
}
function nitterTag(tag) {
  const base = NITTER[nitterIdx % NITTER.length];
  return `${base}/search/rss?q=%23${encodeURIComponent(tag.replace('#',''))}`;
}

// ── COMPLETE SOURCE REGISTRY ─────────────────────────────────────────────────
const FEEDS = [

  // ══ COMPETITOR DIRECT BLOGS ══════════════════════════════════════════════
  { url:'https://blog.pennylane.com/feed/',            source:'Pennylane Blog',      category:'Competitive',        market:'FR', topic:'competitor', label:'Pennylane (blog)',        maxItems:4 },
  { url:'https://www.cegid.com/fr/blog/feed/',         source:'Cegid Blog',          category:'Competitive',        market:'FR', topic:'competitor', label:'Cegid FR (blog)',         maxItems:3 },
  { url:'https://www.cegid.com/blog/feed/',            source:'Cegid Global Blog',   category:'Competitive',        market:'EU', topic:'competitor', label:'Cegid Global (blog)',      maxItems:2 },
  { url:'https://www.holded.com/es/blog/feed/',        source:'Holded Blog ES',       category:'Competitive',        market:'ES', topic:'competitor', label:'Holded ES (blog)',         maxItems:3 },
  { url:'https://www.holded.com/blog/feed/',           source:'Holded Blog EN',       category:'Competitive',        market:'ES', topic:'competitor', label:'Holded EN (blog)',         maxItems:2 },
  { url:'https://www.xero.com/blog/feed/',             source:'Xero Blog',            category:'Competitive',        market:'EU', topic:'competitor', label:'Xero (blog)',              maxItems:3, keywords:['accountant','europe','ai','compliance','invoice','partner','practice'] },
  { url:'https://quickbooks.intuit.com/blog/feed/',    source:'QuickBooks Blog',      category:'Competitive',        market:'EU', topic:'competitor', label:'QuickBooks (blog)',        maxItems:2, keywords:['accountant','europe','ai','invoice','automation'] },
  { url:'https://www.lexoffice.de/blog/feed/',         source:'Lexoffice Blog',       category:'Competitive',        market:'DE', topic:'competitor', label:'Lexoffice (blog)',         maxItems:3 },
  { url:'https://www.sevdesk.de/blog/feed/',           source:'SevDesk Blog',         category:'Competitive',        market:'DE', topic:'competitor', label:'SevDesk/Cegid DE (blog)', maxItems:2 },
  { url:'https://blog.qonto.com/fr/feed/',             source:'Qonto Blog FR',        category:'Competitive',        market:'FR', topic:'competitor', label:'Qonto (blog)',             maxItems:3, keywords:['comptabilit','expert','facture','regate','partenaire','cabinet'] },
  { url:'https://www.myunisoft.fr/blog/feed/',         source:'MyUnisoft Blog',       category:'Competitive',        market:'FR', topic:'competitor', label:'MyUnisoft (blog)',         maxItems:2 },
  { url:'https://www.sage.com/en-gb/blog/feed/',       source:'Sage Global Blog',     category:'Sage News',          market:'EU', topic:'sage',       label:'Sage Global (blog)',       maxItems:3 },
  { url:'https://www.sage.com/fr-fr/blog/feed/',       source:'Sage France Blog',     category:'Sage News',          market:'FR', topic:'sage',       label:'Sage France (blog)',       maxItems:3 },
  { url:'https://developer.sage.com/blog/feed/',       source:'Sage Developer Blog',  category:'Sage News',          market:'EU', topic:'sage',       label:'Sage Developer (blog)',    maxItems:2 },

  // ══ TWITTER/X VIA NITTER — free RSS for public accounts & hashtags ════════
  { url:nitterFeed('PennylaneHQ'),              source:'X/Twitter', category:'Competitive',       market:'FR', topic:'competitor', label:'@PennylaneHQ (X)',              maxItems:3 },
  { url:nitterFeed('Cegid_fr'),                 source:'X/Twitter', category:'Competitive',       market:'FR', topic:'competitor', label:'@Cegid_fr (X)',                 maxItems:2 },
  { url:nitterFeed('holded'),                   source:'X/Twitter', category:'Competitive',       market:'ES', topic:'competitor', label:'@holded (X)',                   maxItems:2 },
  { url:nitterFeed('Xero'),                     source:'X/Twitter', category:'Competitive',       market:'EU', topic:'competitor', label:'@Xero (X)',                     maxItems:2, keywords:['accountant','europe','ai','partner','invoice','compliance'] },
  { url:nitterFeed('Qonto'),                    source:'X/Twitter', category:'Competitive',       market:'FR', topic:'competitor', label:'@Qonto (X)',                    maxItems:2 },
  { url:nitterFeed('datev'),                    source:'X/Twitter', category:'Competitive',       market:'DE', topic:'competitor', label:'@datev (X)',                    maxItems:2 },
  { url:nitterTag('facturationelectronique'),   source:'X/Twitter', category:'Regulatory',        market:'FR', topic:'regulatory', label:'#facturationelectronique (X)',  maxItems:3 },
  { url:nitterTag('Verifactu'),                 source:'X/Twitter', category:'Regulatory',        market:'ES', topic:'regulatory', label:'#Verifactu (X)',               maxItems:3 },
  { url:nitterTag('XRechnung'),                 source:'X/Twitter', category:'Regulatory',        market:'DE', topic:'regulatory', label:'#XRechnung (X)',               maxItems:2 },
  { url:nitterTag('eInvoicing'),                source:'X/Twitter', category:'Regulatory',        market:'EU', topic:'regulatory', label:'#eInvoicing (X)',              maxItems:2 },
  { url:nitterTag('expertcomptable'),           source:'X/Twitter', category:'Market Intelligence',market:'FR', topic:'market',    label:'#expertcomptable (X)',         maxItems:2 },
  { url:nitterTag('accountingtech'),            source:'X/Twitter', category:'AI & Tech',         market:'EU', topic:'ai',        label:'#accountingtech (X)',          maxItems:2 },
  { url:nitterTag('fintech'),                   source:'X/Twitter', category:'Market Intelligence',market:'EU', topic:'market',    label:'#fintech EU (X)',              maxItems:2, keywords:['europe','france','spain','germany','accounting','invoice','comptab','fiscal'] },
  { url:nitterTag('accountingai'),              source:'X/Twitter', category:'AI & Tech',         market:'EU', topic:'ai',        label:'#accountingai (X)',            maxItems:2 },

  // ══ PROFESSIONAL ACCOUNTING BODIES — authoritative sources ════════════════
  { url:'https://www.experts-comptables.fr/rss.xml',                        source:'OEC France',         category:'Market Intelligence', market:'FR', topic:'market',    label:'OEC France (official)',     maxItems:3 },
  { url:'https://www.icjce.es/rss.xml',                                     source:'ICJCE Spain',         category:'Market Intelligence', market:'ES', topic:'market',    label:'ICJCE Spain (official)',    maxItems:2 },
  { url:'https://www.stbdk.de/rss.xml',                                     source:'StBdK Germany',       category:'Market Intelligence', market:'DE', topic:'market',    label:'StBdK Germany (official)',  maxItems:2 },
  { url:'https://www.icaew.com/rss/all-news',                               source:'ICAEW',               category:'Market Intelligence', market:'EU', topic:'market',    label:'ICAEW (UK benchmark)',      maxItems:2, keywords:['technology','ai','digital','automation','invoice','compliance','mtd','cloud'] },
  { url:'https://www.accountancyeurope.eu/feed/',                           source:'Accountancy Europe',  category:'Market Intelligence', market:'EU', topic:'market',    label:'Accountancy Europe (EU body)', maxItems:3 },

  // ══ OFFICIAL REGULATORY FEEDS ════════════════════════════════════════════
  { url:'https://www.impots.gouv.fr/rss/actualites.xml',                    source:'DGFiP',               category:'Regulatory', market:'FR', topic:'regulatory', label:'DGFiP (official)',           maxItems:3 },
  { url:'https://www.agenciatributaria.es/AEAT.internet/RSS/RSS_NovedadesAEAT.xml', source:'AEAT Spain', category:'Regulatory', market:'ES', topic:'regulatory', label:'AEAT Spain (official)',      maxItems:3 },
  { url:'https://www.bundesfinanzministerium.de/SiteGlobals/Functions/RSSFeed/DE/RSSNewsfeed/RSS_Aktuelle_Meldungen.xml', source:'BMF Germany', category:'Regulatory', market:'DE', topic:'regulatory', label:'BMF Germany (official)', maxItems:2, keywords:['rechnung','steuer','digital','umsatzsteuer','e-rechnung','elektronisch'] },
  { url:'https://ec.europa.eu/taxation_customs/news/rss_en.xml',            source:'EU Commission Tax',   category:'Regulatory', market:'EU', topic:'regulatory', label:'EU Commission Tax (official)', maxItems:3 },
  { url:'https://digital-strategy.ec.europa.eu/en/rss.xml',                source:'EU Digital Strategy', category:'Regulatory', market:'EU', topic:'regulatory', label:'EU Digital Policy',           maxItems:2, keywords:['invoice','einvoice','digital','sme','business','finance','vida','vat'] },

  // ══ SPECIALIST ACCOUNTING PRESS ══════════════════════════════════════════
  { url:'https://www.accountingweb.co.uk/feed',     source:'AccountingWEB',   category:'Market Intelligence', market:'EU', topic:'market', label:'AccountingWEB UK',      maxItems:3, keywords:['technology','software','ai','automation','digital','mtd','cloud','practice','invoice'] },
  { url:'https://www.accountancyage.com/feed/',     source:'Accountancy Age', category:'Market Intelligence', market:'EU', topic:'market', label:'Accountancy Age',       maxItems:3, keywords:['technology','software','ai','automation','europe','cloud','practice','firm','invoice'] },
  { url:'https://www.accountingtoday.com/feed',     source:'Accounting Today',category:'Market Intelligence', market:'EU', topic:'market', label:'Accounting Today',      maxItems:2, keywords:['technology','ai','cloud','europe','automation','invoice','software'] },
  { url:'https://www.finyear.com/rss.xml',          source:'Finyear FR',      category:'Market Intelligence', market:'FR', topic:'market', label:'Finyear (FR)',           maxItems:3 },
  { url:'https://www.lesechos.fr/rss/rss_finance.xml', source:'Les Echos',   category:'Market Intelligence', market:'FR', topic:'market', label:'Les Echos (FR)',         maxItems:2, keywords:['logiciel','comptabilit','fintech','num','start-up','entreprise','facturation'] },
  { url:'https://www.journaldunet.com/rss/jdnleadership.xml', source:'Journal du Net', category:'Market Intelligence', market:'FR', topic:'market', label:'Journal du Net FR', maxItems:2, keywords:['comptabilit','logiciel','entreprise','fintech','facture','fiscalit'] },
  { url:'https://www.expansion.com/rss/economia.xml', source:'Expansion ES',  category:'Market Intelligence', market:'ES', topic:'market', label:'Expansion (ES)',        maxItems:2, keywords:['contabilidad','software','asesor','digital','impuesto','factura','pyme','despacho'] },
  { url:'https://cincodias.elpais.com/rss/cincodias.xml', source:'Cinco Días', category:'Market Intelligence', market:'ES', topic:'market', label:'Cinco Días (ES)',       maxItems:2, keywords:['contabilidad','asesor','software','pyme','digital','factura','fiscal'] },
  { url:'https://www.handelsblatt.com/contentexport/feed/themen/digitalisierung', source:'Handelsblatt DE', category:'Market Intelligence', market:'DE', topic:'market', label:'Handelsblatt Digital (DE)', maxItems:2, keywords:['steuer','buchhaltung','software','fintech','rechnung','kanzlei','digitalisierung'] },

  // ══ VC / STARTUP / FUNDING — detect competitor raises early ══════════════
  { url:'https://sifted.eu/feed/',                         source:'Sifted EU',            category:'Competitive', market:'EU', topic:'competitor', label:'Sifted EU (startup)',       maxItems:3, keywords:['accounting','fintech','b2b','saas','invoice','finance','comptab','fiscal','bookkeep'] },
  { url:'https://eu-startups.com/feed/',                   source:'EU-Startups',          category:'Competitive', market:'EU', topic:'competitor', label:'EU-Startups.com',           maxItems:3, keywords:['accounting','fintech','b2b saas','invoice','payroll','bookkeeping','tax','erp'] },
  { url:'https://www.maddyness.com/feed/',                 source:'Maddyness FR',         category:'Competitive', market:'FR', topic:'competitor', label:'Maddyness (FR tech)',        maxItems:2, keywords:['comptabilit','fintech','b2b','facturation','gestion','logiciel','expert','levee'] },
  { url:'https://techcrunch.com/category/enterprise/feed/', source:'TechCrunch Enterprise', category:'Competitive', market:'EU', topic:'competitor', label:'TechCrunch Enterprise',  maxItems:2, keywords:['accounting','bookkeeping','invoice','payroll','fintech','b2b','saas','europe','erp'] },
  { url:'https://techcrunch.com/category/fundings-exits/feed/', source:'TechCrunch Funding', category:'Competitive', market:'EU', topic:'competitor', label:'TechCrunch Funding',   maxItems:2, keywords:['accounting','fintech','invoice','tax','bookkeeping','europe','payroll','erp','b2b'] },
  { url:'https://venturebeat.com/category/ai/feed/',       source:'VentureBeat AI',       category:'AI & Tech',   market:'EU', topic:'ai',         label:'VentureBeat AI',            maxItems:2, keywords:['accounting','finance','enterprise','invoice','automation','erp','b2b','audit'] },

  // ══ AI & AUTOMATION — track what is coming ════════════════════════════════
  { url:'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml', source:'MIT Tech Review', category:'AI & Tech', market:'EU', topic:'ai', label:'MIT AI Research', maxItems:2, keywords:['finance','accounting','enterprise','automation','agent','reasoning','audit','erp'] },
  { url:'https://www.wired.com/feed/category/business/latest/rss',        source:'Wired Business',  category:'AI & Tech', market:'EU', topic:'ai', label:'Wired Business',  maxItems:2, keywords:['ai','accounting','finance','automation','invoice','enterprise','saas','europe'] },
  { url:'https://aibusiness.com/rss.xml',                                  source:'AI Business',     category:'AI & Tech', market:'EU', topic:'ai', label:'AI Business',     maxItems:3, keywords:['finance','accounting','enterprise','automation','agent','copilot','erp','audit','invoice'] },

  // ══ GOOGLE NEWS — 40+ targeted searches ══════════════════════════════════

  // Competitors
  { url:'https://news.google.com/rss/search?q=Pennylane+accounting+France+Europe&hl=en&gl=GB&ceid=GB:en',            source:'Google News',    category:'Competitive',        market:'FR', topic:'competitor', label:'Pennylane EN (GNews)',    maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Pennylane+levee+fonds+expansion+Europe&hl=fr&gl=FR&ceid=FR:fr',        source:'Google News FR', category:'Competitive',        market:'FR', topic:'competitor', label:'Pennylane FR (GNews)',    maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Cegid+EBP+Shine+Ageras+comptabilite&hl=fr&gl=FR&ceid=FR:fr',           source:'Google News FR', category:'Competitive',        market:'FR', topic:'competitor', label:'Cegid FR (GNews)',        maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Holded+Visma+software+contabilidad+Spain&hl=en&gl=GB&ceid=GB:en',      source:'Google News',    category:'Competitive',        market:'ES', topic:'competitor', label:'Holded (GNews)',          maxItems:2 },
  { url:'https://news.google.com/rss/search?q=DATEV+cloud+Steuerberater+software&hl=en&gl=GB&ceid=GB:en',            source:'Google News',    category:'Competitive',        market:'DE', topic:'competitor', label:'DATEV (GNews)',           maxItems:2 },
  { url:'https://news.google.com/rss/search?q=accounting+software+fintech+funding+Europe+2025+2026&hl=en&gl=GB&ceid=GB:en', source:'Google News', category:'Competitive',   market:'EU', topic:'competitor', label:'EU Fintech Funding (GNews)', maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Xero+JAX+AI+accounting+Europe&hl=en&gl=GB&ceid=GB:en',                 source:'Google News',    category:'Competitive',        market:'EU', topic:'competitor', label:'Xero AI (GNews)',         maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Qonto+Regate+France+fintech+comptabilite&hl=fr&gl=FR&ceid=FR:fr',      source:'Google News FR', category:'Competitive',        market:'FR', topic:'competitor', label:'Qonto/Regate (GNews)',    maxItems:2 },
  { url:'https://news.google.com/rss/search?q=MyUnisoft+ACD+Conciliator+France+comptable&hl=fr&gl=FR&ceid=FR:fr',    source:'Google News FR', category:'Competitive',        market:'FR', topic:'competitor', label:'FR challengers (GNews)', maxItems:2 },

  // Regulatory
  { url:'https://news.google.com/rss/search?q=facturation+electronique+France+DGFiP+plateforme+2026&hl=fr&gl=FR&ceid=FR:fr', source:'Google News FR', category:'Regulatory', market:'FR', topic:'regulatory', label:'FR PA Mandate (GNews)',  maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Verifactu+SIF+AEAT+facturacion+electronica+2027&hl=es&gl=ES&ceid=ES:es',       source:'Google News ES', category:'Regulatory', market:'ES', topic:'regulatory', label:'Verifactu (GNews)',      maxItems:3 },
  { url:'https://news.google.com/rss/search?q=XRechnung+ZUGFeRD+E-Rechnung+Pflicht+Deutschland&hl=de&gl=DE&ceid=DE:de',     source:'Google News DE', category:'Regulatory', market:'DE', topic:'regulatory', label:'XRechnung (GNews)',      maxItems:2 },
  { url:'https://news.google.com/rss/search?q=SAF-T+fatura+eletronica+Portugal+AT+2027&hl=pt&gl=PT&ceid=PT:pt',              source:'Google News PT', category:'Regulatory', market:'PT', topic:'regulatory', label:'SAF-T Portugal (GNews)', maxItems:2 },
  { url:'https://news.google.com/rss/search?q=EU+eInvoicing+ViDA+VAT+digital+mandate+European&hl=en&gl=GB&ceid=GB:en',      source:'Google News',    category:'Regulatory', market:'EU', topic:'regulatory', label:'EU ViDA (GNews)',        maxItems:2 },

  // Market intelligence by country
  { url:'https://news.google.com/rss/search?q=expert+comptable+cabinet+logiciel+numerique+France&hl=fr&gl=FR&ceid=FR:fr',     source:'Google News FR', category:'Market Intelligence', market:'FR', topic:'market', label:'Expert-Comptable (GNews)',  maxItems:3 },
  { url:'https://news.google.com/rss/search?q=despacho+asesoria+software+gestion+Espana+2025&hl=es&gl=ES&ceid=ES:es',         source:'Google News ES', category:'Market Intelligence', market:'ES', topic:'market', label:'Despachos Spain (GNews)',   maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Steuerberater+Kanzlei+Software+Digitalisierung+2025&hl=de&gl=DE&ceid=DE:de',    source:'Google News DE', category:'Market Intelligence', market:'DE', topic:'market', label:'Steuerberater (GNews)',     maxItems:2 },
  { url:'https://news.google.com/rss/search?q=contabilista+certificado+software+gestao+Portugal&hl=pt&gl=PT&ceid=PT:pt',      source:'Google News PT', category:'Market Intelligence', market:'PT', topic:'market', label:'Portugal Accounting (GNews)',maxItems:2 },
  { url:'https://news.google.com/rss/search?q=cloud+accounting+SME+Europe+growth+adoption+2025&hl=en&gl=GB&ceid=GB:en',       source:'Google News',    category:'Market Intelligence', market:'EU', topic:'market', label:'EU Cloud Accounting (GNews)',maxItems:2 },

  // AI
  { url:'https://news.google.com/rss/search?q=AI+artificial+intelligence+accounting+accountant+automation+Europe&hl=en&gl=GB&ceid=GB:en', source:'Google News',    category:'AI & Tech', market:'EU', topic:'ai', label:'AI Accounting EU (GNews)',  maxItems:3 },
  { url:'https://news.google.com/rss/search?q=intelligence+artificielle+comptabilite+IA+expert+cabinet&hl=fr&gl=FR&ceid=FR:fr',           source:'Google News FR', category:'AI & Tech', market:'FR', topic:'ai', label:'IA Comptabilité FR (GNews)',maxItems:2 },
  { url:'https://news.google.com/rss/search?q=inteligencia+artificial+contabilidad+asesor+automatizacion&hl=es&gl=ES&ceid=ES:es',         source:'Google News ES', category:'AI & Tech', market:'ES', topic:'ai', label:'IA Contabilidad ES (GNews)',maxItems:2 },
  { url:'https://news.google.com/rss/search?q=KI+Buchhaltung+Steuerberater+Automatisierung+Deutschland&hl=de&gl=DE&ceid=DE:de',           source:'Google News DE', category:'AI & Tech', market:'DE', topic:'ai', label:'KI Buchhaltung DE (GNews)', maxItems:2 },

  // Sage
  { url:'https://news.google.com/rss/search?q=Sage+Group+accounting+software+acquisition+Europe&hl=en&gl=GB&ceid=GB:en',   source:'Google News',    category:'Sage News', market:'EU', topic:'sage', label:'Sage News EN (GNews)',  maxItems:3 },
  { url:'https://news.google.com/rss/search?q=Sage+comptabilite+France+Active+expert+logiciel&hl=fr&gl=FR&ceid=FR:fr',     source:'Google News FR', category:'Sage News', market:'FR', topic:'sage', label:'Sage France (GNews)',   maxItems:2 },
  { url:'https://news.google.com/rss/search?q=Sage+contabilidad+Espana+despacho+Active&hl=es&gl=ES&ceid=ES:es',            source:'Google News ES', category:'Sage News', market:'ES', topic:'sage', label:'Sage Spain (GNews)',    maxItems:2 },
];

// ── FETCH ─────────────────────────────────────────────────────────────────────
function fetchUrl(url, timeoutMs = 9000) {
  return new Promise(resolve => {
    try {
      const proto = url.startsWith('https') ? https : http;
      const req = proto.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WiSE-Intel-Hub/3.0; +https://lewisvines.github.io/wise-intel-hub/)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en,fr,es,de,pt',
        },
        timeout: timeoutMs,
      }, res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
          fetchUrl(res.headers.location, timeoutMs).then(resolve);
          return;
        }
        if (res.statusCode !== 200) { resolve(''); return; }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', () => resolve(''));
      });
      req.on('timeout', () => { req.destroy(); resolve(''); });
      req.on('error', () => resolve(''));
    } catch { resolve(''); }
  });
}

// ── PARSER ───────────────────────────────────────────────────────────────────
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: name => ['item','entry'].includes(name),
  parseAttributeValue: false,
  trimValues: true,
});

function parseItems(xml) {
  if (!xml || xml.length < 80) return [];
  try {
    const doc = parser.parse(xml);
    const ch = doc?.rss?.channel || doc?.channel;
    if (ch?.item?.length) return ch.item.slice(0, 8);
    const feed = doc?.feed;
    if (feed?.entry?.length) return feed.entry.slice(0, 8);
    return [];
  } catch { return []; }
}

function getText(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v['#text']) return String(v['#text']).trim();
  if (v['@_href']) return v['@_href'];
  if (Array.isArray(v)) return getText(v[0]);
  return '';
}

function getField(item, ...keys) {
  for (const k of keys) { const v = getText(item[k]); if (v && v.length > 2) return v; }
  return '';
}

function clean(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&nbsp;/g,' ').replace(/&#\d+;/g,' ').replace(/&apos;/g,"'")
    .replace(/\s+/g,' ').trim();
}

function getDate(item) {
  const raw = getField(item,'pubDate','published','updated','dc:date','date');
  if (!raw) return new Date().toISOString().split('T')[0];
  try { const d=new Date(raw); if(!isNaN(d)) return d.toISOString().split('T')[0]; } catch {}
  return new Date().toISOString().split('T')[0];
}

function getLink(item, fallback) {
  for (const k of ['link','guid','id']) {
    const v = getText(item[k]);
    if (v && v.startsWith('http')) return v;
    if (item[k] && typeof item[k]==='object' && item[k]['@_href']) return item[k]['@_href'];
  }
  return fallback;
}

function matches(item, kws) {
  if (!kws || !kws.length) return true;
  const t = JSON.stringify(item).toLowerCase();
  return kws.some(k => t.includes(k.toLowerCase()));
}

// ── ENTITY + EVENT FINGERPRINTING ────────────────────────────────────────────
// Catches same-story duplicates across languages and phrasings.
// "Pennylane raises $200M" == "Pennylane lève 175 millions d'euros" = SAME STORY
// Works by extracting: entity + event_type + normalised_amount as a dedup key.

const seenFingerprints = new Set();
const seenEventKeys = new Set();

const ENTITIES = [
  'pennylane','cegid','holded','datev','qonto','regate','myunisoft','lexoffice',
  'sevdesk','xero','quickbooks','intuit','sage','visma','shine','ageras',
  'anthropic','openai','mistral',
  'verifactu','xrechnung','e-rechnung','e-rechnungspflicht','zugferd','vida','saf-t','factur-x',
  'dgfip','aeat','hacienda','bundesfinanzministerium','bmf',
  'facturation electronique','electronic invoicing','factura electronica',
];

const EVENT_PATTERNS = [
  // Acquisition BEFORE funding — "rachète pour un milliard" is acquisition, not funding
  { key:'acquisition',  test: t => /acqui[rs]|rach\u00e8te|rachet|\bbuys\b|merger|acquiert|takeover|met la main|s'empare|prend le contr|rachete|übernimmt/i.test(t) },
  { key:'funding',      test: t => /\brais(?:es?|ed|ing)?\b|secures?\s+[€$£\d]|secures?\s+\$|l[eè]ve\s+[\d€$£]|l[eè]ve\s+\d|\bseries\s+[abcde]\b|venture\s+capital|seed.fund|\bfunding\s+round\b|lev[eé]e\s+de\s+fonds|investissement/i.test(t) },
  { key:'launch',       test: t => /launch[es]|releases?|introduces?|announces?\s+new|unveil|lancement/i.test(t) },
  { key:'partnership',  test: t => /partners?\s+with|collaboration|partenariat|integrat/i.test(t) },
  { key:'mandate',      test: t => /mandate|pflicht|oblig|deadline|2026|2027|aplaza|retrasa|retard|report\u00e9|bereit|pr\u00eates|pr\u00e9parer|frist|einf\u00fchr|obligatoire|obligatorio|verpflicht/i.test(t) },
  { key:'expansion',    test: t => /expan[ds]|enters?\s+(?:spain|france|germany|europe)|new\s+market/i.test(t) },
];



// Maps regulatory entities to a normalised topic key
// so "verifactu" + "hacienda" + "factura electronica" all map to the same ES topic
const REGULATORY_TOPICS = [
  { key: 'ES_EINVOICE', terms: ['verifactu','hacienda','factura electronica','facturacion electronica','crea y crece','ticketbai','batuz','facturacion','spain invoice'] },
  { key: 'FR_EINVOICE', terms: ['facturation electronique','facturation electr','facture electronique','facture numerique','e-facturation','dgfip','plateforme agreee','ppf','piste','chorus','dematerialisation','dematerializ','france e-invoic','france mandatory','september 2026','sept 2026','french einvoic','french e-invoic'] },
  { key: 'DE_EINVOICE', terms: ['e-rechnung','xrechnung','zugferd','e-rechnungspflicht','rechnungspflicht','elektronische rechnung','germany e-invoic','deutschland'] },
  { key: 'PT_EINVOICE', terms: ['saf-t','fatura eletronica','fatura electronica','at portugal','sigef'] },
  // Catch-all for generic e-invoicing articles — classify by market context later
  { key: 'EU_EINVOICE', terms: ['b2b e-invoic','b2b einvoic','vida vat','vida directive','e-invoicing begins','mandatory e-invoic','einvoicing mandate'] },
];

// Normalise text for topic matching: strip accents, lowercase
function normaliseForTopics(text) {
  return text.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ýÿ]/g, 'y')
    .replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c').replace(/[æ]/g, 'ae')
    .replace(/[ß]/g, 'ss').replace(/[ø]/g, 'o').replace(/[-_]/g, ' ');
}

function getTopicKey(rawText) {
  const text = normaliseForTopics(rawText);
  for (const topic of REGULATORY_TOPICS) {
    if (topic.terms.some(t => text.includes(normaliseForTopics(t)))) return topic.key;
  }
  return null;
}

function normAmount(text) {
  const t = text.toLowerCase();
  // Match currency+number+unit in various formats including:
  // "$200M", "€175 million", "75m-report", "1.2 billion", "EUR200m"
  const matches = t.match(/(?:[€$£]|eur|usd|gbp)?\s*([\d,.]+)\s*(?:billions?|milliards?|mrd|millions?|mn|mio|b|m)(?:[^a-z]|$)/gi) || [];
  if (!matches.length) return '';
  const nums = matches.map(m => {
    const n = parseFloat(m.replace(/[^0-9.]/g, '')) || 0;
    return /billion|milliard|mrd/i.test(m) ? n * 1000 : n;
  }).filter(n => n > 0);
  if (!nums.length) return '';
  // Round to 200M bucket: $200M, €175M, €75M all → 200M (same funding story)
  const bucket = Math.max(1, Math.round(Math.max(...nums) / 200)) * 200;
  return bucket + 'M';
}

function extractEventKey(title, body) {
  // Normalise accents so "lève", "électronique" etc match entity/topic lists
  const text = normaliseForTopics(`${title} ${body}`);

  // Find entities present in the text
  const foundEntities = ENTITIES.filter(e => text.includes(normaliseForTopics(e)));

  let eventType = '';
  for (const { key, test } of EVENT_PATTERNS) {
    if (test(text)) { eventType = key; break; }
  }

  // For regulatory mandate stories, use topic key so all ES/FR/DE stories group together
  if (eventType === 'mandate' || !eventType) {
    const topicKey = getTopicKey(text);
    if (topicKey) {
      return `TOPIC::${topicKey}::mandate`;
    }
  }

  if (!foundEntities.length || !eventType) return null;

  const entity = foundEntities[0];

  // For partnerships/acquisitions, sort entities so order doesn't matter
  let entityKey = entity;
  if (foundEntities.length > 1 && (eventType === 'partnership' || eventType === 'acquisition')) {
    entityKey = foundEntities.slice(0, 2).sort().join('+');
  }

  const amt = (eventType === 'funding' || eventType === 'acquisition') ? normAmount(text) : '';
  return `${entityKey}::${eventType}::${amt}`;
}

function isDuplicateSignal(title, bodyText) {
  // Method 1: exact title fingerprint
  const fp = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
  if (seenFingerprints.has(fp)) return true;

  // Method 2: entity + event key
  const key = extractEventKey(title, bodyText);
  if (key && seenEventKeys.has(key)) return true;

  // Method 3: regulatory entity cap — max 1 signal per major regulatory term per run
  // Prevents 3 Verifactu delay stories or 2 E-Rechnungspflicht stories
  const REGULATORY_CAP_ENTITIES = [
    'verifactu','xrechnung','e-rechnung','e-rechnungspflicht',
    'facturation electronique','electronic invoicing',
    'zugferd','saf-t','vida',
  ];
  const combined = normaliseForTopics(`${title} ${bodyText}`);
  for (const regEnt of REGULATORY_CAP_ENTITIES) {
    if (combined.includes(regEnt)) {
      const capKey = 'REG_CAP::' + regEnt;
      if (seenEventKeys.has(capKey)) return true; // Already have one story on this topic
      seenEventKeys.add(capKey);
      break;
    }
  }

  seenFingerprints.add(fp);
  if (key) seenEventKeys.add(key);
  return false;
}

// ── IMPLICATIONS ENGINE ───────────────────────────────────────────────────────
function implication({ category, market, label='', title='', source='' }) {
  const t = (title+' '+source+' '+label).toLowerCase(); // include label in text search
  const l = (label+' '+title).toLowerCase(); // label + title for entity matching
  const isFunding = /rais[ei]|secures|leve|series|million|billion|milliard|funding/i.test(t);
  const isExpansion = /expan|enters|hiring|headcount|new.*market/i.test(t);
  const isProduct = /launch|feature|release|partner|integrat|copilot/i.test(t);
  const isAcquisition = /acqui|merger|rachete|buys|takeover|met la main/i.test(t);
  const isDelay = /delay|postpone|retrasa|aplaza|retard|verschoben/i.test(t);
  const isSpec = /spec|format|standard|xrechnung|zugferd|factur-x/i.test(t);
  const isPenalty = /penalt|sanction|fine|amende|multa/i.test(t);

  if (category==='Regulatory') {
    if (market==='FR') {
      if (isDelay) return 'France PA mandate Sept 1 2026 is fixed - delays elsewhere do not apply. Use this as a selling point: Sage is ready now, others are not. Accelerate GE practice PA registration.';
      if (isSpec) return 'Factur-X/UBL/CII format update. Verify Sage Active and AKAO stay compliant. Any change affects the AE processing pipeline - escalate to product.';
      if (isPenalty) return 'France penalty is EUR50 per non-compliant invoice. Frame Sage PA registration as risk elimination not a feature sale. Every GE practice needs this message now.';
      return 'France PA mandate Sept 1 2026 - 154 days remaining. Any DGFiP news affects GE practice activation window. Accelerate PA registration campaign.';
    }
    if (market==='ES') {
      if (isDelay) return 'Verifactu delayed but Pennylane arrives Spain H2 2026 regardless. Own the certified-first position before they land. Jan 2027 corporate deadline is firm.';
      if (isPenalty) return 'Verifactu penalty is EUR50k per year per taxpayer for non-compliant software. Use this compliance risk story in every Despachos conversation.';
      return 'Verifactu Jan 2027 corporate, Jul 2027 autonomos. Any AEAT signal affects Active certified-first positioning - use in Despachos conversion conversations.';
    }
    if (market==='DE') {
      if (isSpec) return 'XRechnung/ZUGFeRD spec update. Verify DATEV compatibility planning. Must-issue Jan 2027 - any spec change affects the DATEV cloud layer strategy.';
      return 'Germany XRechnung issue mandate Jan 2027. Commercial catalyst for FY27 GTM. Spec updates affect DATEV compatibility planning.';
    }
    if (market==='PT') return 'SAF-T Portugal 2027. Build OCC relationships now for H1 FY27 activation. Any AT announcement affects proposition definition.';
    return 'EU regulatory development. Assess impact across all four mandates - ViDA July 2030 is the overarching framework.';
  }

  if (category==='Competitive') {
    if (l.includes('pennylane')) {
      if (isFunding) return 'CRITICAL: Pennylane raised $200M/EUR175M Series E at $4.25B valuation. Declared offensive capital to acquire legacy accounting software - GE is the implied target. Activate every GE practice now before their commercial team arrives.';
      if (isExpansion) return 'CRITICAL: Pennylane expanding headcount or territory. Spain H2 2026 confirmed, Germany live since Nov 2025. Each market entry gives a 6-12 month window before they reach critical accountant mass.';
      if (isProduct) return 'HIGH: Pennylane product or AI update. They ship fast. Assess gap to Sage Copilot and update the battlecard immediately.';
      // Use title to determine story type
      if (/german|allemagne|berlin|expand|munich/i.test(t)) return 'CRITICAL: Pennylane Germany (Nov 2025 launch, 100 engineers). Already operational, signing German practices. DATEV integration is their moat-builder. Monitor their DE accountant firm count monthly.';
      if (/spain|espagne|espa|madrid|barcelona/i.test(t)) return 'CRITICAL: Pennylane confirmed Spain H2 2026. They are hiring a Spain country manager now. Despachos must be activated before their commercial team lands. The window is April-September 2026.';
      if (/invest|record|logiciel|software|marché|market/i.test(t)) return 'HIGH: French accounting software market seeing record investment. Pennylane is the primary beneficiary. Monitor category growth as a leading indicator of competitive intensity.';
      return 'CRITICAL: Pennylane EUR115M ARR, 6k+ firms, PA-certified, Spain H2 2026. Any news signals acceleration. Counter: GE practices are the moat — activate them before Pennylane arrives.';
    }
    if (l.includes('cegid')) {
      if (isAcquisition) return 'HIGH: Cegid acquisition - they grow through M&A. EBP 275k FR clients, Shine 400k SMBs plus banking, SevDesk in Germany. Shine gives them embedded French banking completing their platform gap.';
      if (isExpansion) return 'HIGH: Cegid deploying 100 sales reps targeting GE practices from Q2 2026. They will call every practice Sage has not yet converted. Activate GE communication now.';
      return 'HIGH: Cegid has 15k EU accountants and 1M+ SMBs. Their reps are calling your GE practices now. Every week of delay is a lost practice.';
    }
    if (l.includes('holded')) return 'SPAIN: Holded goes direct to SMEs bypassing accountants. Counter: Holded reaches your clients directly - we come through you. Payroll Modelo 303 is the functional win.';
    if (l.includes('datev')) return 'GERMANY: DATEV is cooperative - 2.8M businesses, EUR1.44B revenue. Complement not compete. Frame Active as the cloud layer above DATEV compliance.';
    if (l.includes('qonto')||l.includes('regate')) return 'FRANCE: Qonto owns Regate which is PA-certified. Monitor for feature parity with AE - any overlap threatens AutoEntry attach rate.';
    if (l.includes('xero')) return 'BENCHMARK: Xero JAX AI Anthropic partnership. No French PA cert, no Spanish Verifactu today. Monitor EU compliance feature adds monthly - if JAX gains EU compliance H2 2026 landscape changes.';
    if (l.includes('lexoffice')||l.includes('sevdesk')) return 'GERMANY: Cegid owns SevDesk since April 2025. Monitor for DATEV integration moves - that signals a serious attack on the German accountant base.';
    if (l.includes('sage')) return 'SAGE NEWS: Use positive Sage news in accountant conversations. Monitor for product or partnership announcements relevant to WiSE markets.';
    return 'MARKET SIGNAL: Competitor movement detected. Assess impact on FR/ES/DE/PT positioning and update the relevant battlecard.';
  }

  if (category==='AI & Tech') {
    if (t.includes('sage')) return 'SAGE AI: Sage Copilot development signal. Compliance-specific AI is the differentiator - not general LLM capability. Pennylane co-pilot and Xero JAX set the benchmark.';
    return 'AI WATCH: Accounting AI signal. Assess whether this changes accountant expectations for Sage Copilot. Outcome-led AI wins over feature lists.';
  }

  if (category==='Market Intelligence') return 'MARKET INTEL: European accounting software market signal. Feed into strategic planning and TAM/SAM analysis for FY27.';

  return 'Monitor and assess relevance to WiSE accountant strategy across FR/ES/DE/PT markets.';
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
// ── English Translation Layer ─────────────────────────────────────
// Translates French, Spanish, German, Portuguese titles/bodies to English
// Uses pattern-based substitution for common accounting/tech terms
// No API calls — pure regex + dictionary replacement

const TRANSLATIONS = {
  // French → English common terms
  fr: [
    [/facturation [ée]lectronique/gi, 'electronic invoicing'],
    [/facture [ée]lectronique/gi, 'electronic invoice'],
    [/investissements? records?/gi, 'record investment'],
    [/investissements?/gi, 'investment'],
    [/logiciels? comptables?/gi, 'accounting software'],
    [/logiciels?/gi, 'software'],
    [/ann[ée]e.cl[ée]/gi, 'key year'],
    [/num[ée]riques?/gi, 'digital'],
    [/d[ée]mat[ée]rialisation/gi, 'digitalisation'],
    [/pr[êe]tes?|pr[êe]ts?/gi, 'ready'],
    [/bient[ôo]t/gi, 'soon'],
    [/g[ée]n[ée]ralisation/gi, 'rollout'],
    [/renforce[r]?/gi, 'strengthens'],
    [/empreinte/gi, 'footprint'],
    [/avancer/gi, 'to advance'],
    [/march[ée]/gi, 'market'],
    [/fran[çc]ais[es]?/gi, 'French'],
    [/oblig[ée]s?/gi, 'mandatory'],
    [/plateforme agr[ée][ée]/gi, 'certified platform (PA)'],
    [/expert-comptable/gi, 'chartered accountant'],
    [/expert comptable/gi, 'chartered accountant'],
    [/cabinet comptable/gi, 'accounting firm'],
    [/logiciel de comptabilit[ée]/gi, 'accounting software'],
    [/comptabilit[ée]/gi, 'accounting'],
    [/num[ée]rique/gi, 'digital'],
    [/entreprise/gi, 'business'],
    [/levée de fonds/gi, 'funding round'],
    [/intelligence artificielle/gi, 'artificial intelligence'],
    [/partenaire/gi, 'partner'],
    [/lancement/gi, 'launch'],
    [/croissance/gi, 'growth'],
    [/acquisition/gi, 'acquisition'],
    [/conformit[ée]/gi, 'compliance'],
    [/fiscalit[ée]/gi, 'tax'],
    [/d[ée]claration/gi, 'declaration/filing'],
    [/plateforme/gi, 'platform'],
    [/march[ée]/gi, 'market'],
    [/financement/gi, 'funding'],
    [/obligation/gi, 'requirement/mandate'],
    [/mise en oeuvre/gi, 'implementation'],
    [/mise en œuvre/gi, 'implementation'],
    [/d[ée]ploiement/gi, 'deployment'],
    [/s[ée]rie [ABC]/gi, (m) => m.replace('série','Series')],
    [/million/gi, 'million'],
    [/milliard/gi, 'billion'],
    [/paiement/gi, 'payment'],
    [/int[ée]gration/gi, 'integration'],
    [/solution/gi, 'solution'],
    [/[éE]diteur/gi, 'software vendor'],
    [/automatisation/gi, 'automation'],
    [/abandon/gi, 'churn/cancellation'],
    [/cabinet/gi, 'firm'],
    [/investissements?/gi, 'investment'],
    [/logiciels? comptables?/gi, 'accounting software'],
    [/logiciels?/gi, 'software'],
    [/comptables?/gi, 'accounting'],
    [/PME/g, 'SMEs'],
    [/TPE/g, 'micro-businesses'],
    [/march\u00e9/gi, 'market'],
    [/partenariat/gi, 'partnership'],
    [/annonce/gi, 'announcement'],
  ],
  // Spanish → English  
  es: [
    [/facturaci[óo]n electr[óo]nica/gi, 'electronic invoicing'],
    [/asesor fiscal/gi, 'tax advisor'],
    [/despacho contable/gi, 'accounting firm'],
    [/contabilidad/gi, 'accounting'],
    [/software de gesti[óo]n/gi, 'management software'],
    [/autorizaci[óo]n/gi, 'authorisation'],
    [/inteligencia artificial/gi, 'artificial intelligence'],
    [/automatizaci[óo]n/gi, 'automation'],
    [/cumplimiento/gi, 'compliance'],
    [/obligatorio/gi, 'mandatory'],
    [/empresas/gi, 'businesses'],
    [/empresa/gi, 'company'],
    [/ronda de financiaci[óo]n/gi, 'funding round'],
    [/lanzamiento/gi, 'launch'],
    [/crecimiento/gi, 'growth'],
    [/mercado/gi, 'market'],
    [/adquisici[óo]n/gi, 'acquisition'],
    [/integraci[óo]n/gi, 'integration'],
    [/soluci[óo]n/gi, 'solution'],
    [/millones/gi, 'million'],
    [/millardos/gi, 'billion'],
    [/pago/gi, 'payment'],
    [/plataforma/gi, 'platform'],
    [/autónomo/gi, 'self-employed'],
    [/autonomo/gi, 'self-employed'],
    [/declaraci[óo]n/gi, 'tax filing'],
    [/impuesto/gi, 'tax'],
    [/novedades/gi, 'new features'],
    [/claves/gi, 'key points'],
    [/gesti\u00f3n/gi, 'management'],
    [/gestores?/gi, 'accountants'],
    [/profesionales/gi, 'professionals'],
  ],
  // German → English
  de: [
    [/[Ee]-[Rr]echnungspflicht/g, 'e-invoicing obligation'],
    [/[Ee]-[Rr]echnungsstellung/gi, 'electronic invoicing'],
    [/[Ee]-[Rr]echnung/g, 'e-invoice'],
    [/Elektronische Rechnung/gi, 'electronic invoice'],
    [/Steuerberater/gi, 'tax advisor'],
    [/Buchf[ü]hrung/gi, 'bookkeeping'],
    [/Buchhaltung/gi, 'accounting'],
    [/Rechnungsstellung/gi, 'invoicing'],
    [/Pflicht/gi, 'mandatory requirement'],
    [/Unternehmen/gi, 'companies'],
    [/Digitalisierung/gi, 'digitalisation'],
    [/k[ü]nstliche Intelligenz/gi, 'artificial intelligence'],
    [/Automatisierung/gi, 'automation'],
    [/Finanzierung/gi, 'funding'],
    [/[Ü]bernahme/gi, 'acquisition'],
    [/Kanzlei/gi, 'firm'],
    [/Wachstum/gi, 'growth'],
    [/Markt/gi, 'market'],
    [/Plattform/gi, 'platform'],
    [/Einhaltung/gi, 'compliance'],
    [/Millionen/gi, 'million'],
    [/Milliarden/gi, 'billion'],
    [/Zahlung/gi, 'payment'],
    [/Software/gi, 'software'],
    [/L[öo]sung/gi, 'solution'],
    [/Einf[ü]hrung/gi, 'implementation'],
    [/Steuer/gi, 'tax'],
  ],
  // Portuguese → English
  pt: [
    [/fatura eletr[ôo]nica/gi, 'electronic invoice'],
    [/contabilista/gi, 'accountant'],
    [/contabilidade/gi, 'accounting'],
    [/automa[çc][ãa]o/gi, 'automation'],
    [/conformidade/gi, 'compliance'],
    [/empresas/gi, 'companies'],
    [/crescimento/gi, 'growth'],
    [/mercado/gi, 'market'],
    [/pagamento/gi, 'payment'],
    [/plataforma/gi, 'platform'],
    [/solu[çc][ãa]o/gi, 'solution'],
    [/aquisi[çc][ãa]o/gi, 'acquisition'],
    [/milh[õo]es/gi, 'million'],
    [/integra[çc][ãa]o/gi, 'integration'],
    [/lan[çc]amento/gi, 'launch'],
    [/imposto/gi, 'tax'],
  ]
};

// Detect language from text content
function detectLanguage(text) {
  const t = text.toLowerCase();
  const frScore = (t.match(/(le|la|les|de|du|des|un|une|et|en|au|aux|pour|avec|sur|dans|par|que|qui|est|sont|avoir|être|faire|tout|mais|ou|donc|or|ni|car|facturation|comptabilité|entreprise|cabinet)/g)||[]).length;
  const esScore = (t.match(/(el|la|los|las|de|del|un|una|y|en|al|por|con|que|es|son|para|sobre|desde|hasta|entre|facturación|contabilidad|empresa|despacho|asesor)/g)||[]).length;
  const deScore = (t.match(/(der|die|das|den|dem|des|ein|eine|und|ist|sind|von|mit|bei|für|auf|an|in|zu|nach|aus|über|unter|Steuer|Buchhaltung|Unternehmen|Rechnung|Pflicht)/g)||[]).length;
  const ptScore = (t.match(/(o|a|os|as|de|do|da|dos|das|um|uma|e|em|ao|para|com|que|é|são|ser|ter|pela|pelo|contabilidade|fatura|empresa|imposto)/g)||[]).length;
  
  const max = Math.max(frScore, esScore, deScore, ptScore);
  if (max < 3) return 'en'; // Likely already English
  if (max === frScore) return 'fr';
  if (max === esScore) return 'es';
  if (max === deScore) return 'de';
  if (max === ptScore) return 'pt';
  return 'en';
}

function translateToEnglish(text, lang) {
  if (!text || lang === 'en') return text;
  const rules = TRANSLATIONS[lang] || [];
  let result = text;
  for (const [pattern, replacement] of rules) {
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

// ── Sage Employee Name Scrubber ───────────────────────────────────
// Removes all Sage internal personnel references from signal content
// Replaces with role-based language only
const SAGE_NAMES_TO_SCRUB = [
  // Format: [pattern, replacement]
  [/Karen Ainley/gi, 'Sage EU SVP'],
  [/Neal Watkins/gi, 'Sage EVP'],
  [/Jeremy Sulzmann/gi, 'Sage SVP PMM'],
  [/Lewis Vines/gi, 'Sage PMM Lead'],
  [/Anaïs Piquet/gi, 'Sage France PMM'],
  [/Anais Piquet/gi, 'Sage France PMM'],
  [/Zoraida Gil/gi, 'Sage Spain PMM'],
  [/Isabelle Michaud/gi, 'Sage France Commercial Lead'],
  [/Xavi Vila/gi, 'Sage Iberia Commercial Lead'],
  [/Séverine/gi, 'Sage France Product'],
  [/Severine/gi, 'Sage France Product'],
  [/Mark Leven/gi, 'Sage GE Product Manager'],
  [/Susanne Clark/gi, 'Sage Prévision Lead'],
  [/Cristina F/gi, 'Sage Enablement'],
  [/Phil(?=\s+(?:Sage|50|product))/gi, 'Sage 50 PM'],
  [/Pilar(?=\s+(?:Sage|50))/gi, 'Sage 50 Driver'],
  [/Diego(?=\s+(?:Sage|\())/gi, 'Sage Senior Leader'],
  [/Derk Bleeker/gi, 'Sage ELT Sponsor'],
  [/Oscar Macia/gi, 'Sage ELT Sponsor'],
  [/Anthony Nagun/gi, 'Sage Brand Lead'],
  [/Jonathan Brun/gi, 'Expert-Comptable Partner'],
  // Generic patterns for any missed names
  [/Lewisvines/gi, 'Sage PMM'],
  [/lewisvines@\S+/gi, 'sage-team@sage.com'],
];

function scrubSageNames(text) {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of SAGE_NAMES_TO_SCRUB) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function processSignalLanguage(signal) {
  // First scrub any Sage employee names
  signal.title = scrubSageNames(signal.title);
  signal.body = scrubSageNames(signal.body);
  signal.implication = scrubSageNames(signal.implication);
  
  const combinedText = `${signal.title} ${signal.body}`;
  const lang = detectLanguage(combinedText);
  
  if (lang === 'en') return signal; // Already English
  
  // Translate title and body
  signal.title = translateToEnglish(signal.title, lang);
  signal.body = translateToEnglish(signal.body, lang);
  
  // Add language indicator to source if not English
  const langLabels = { fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', pt: '🇵🇹' };
  if (langLabels[lang] && signal.source && !signal.source.includes(langLabels[lang])) {
    signal.source = `${langLabels[lang]} ${signal.source}`;
  }
  
  return signal;
}

// ── Criticality Scoring ───────────────────────────────────────────
// Scores each signal for WiSE strategic criticality
// Used for sorting: highest criticality first, then most recent

function criticalityScore(sig) {
  const text = `${sig.title} ${sig.body} ${sig.source} ${sig.implication}`.toLowerCase();
  let score = 0;

  // ── Category base scores ──────────────────────────────────────
  const catBase = {
    'Regulatory': 40,      // Mandate news is always high priority
    'Competitive': 35,     // Competitor moves are critical
    'AI & Tech': 20,       // AI signals important but less urgent
    'Market Intelligence': 15,
    'Sage News': 10,
  };
  score += catBase[sig.category] || 10;

  // ── Market urgency boost ──────────────────────────────────────
  const marketBoost = { 'FR': 15, 'ES': 12, 'DE': 8, 'PT': 6, 'EU': 10 };
  score += marketBoost[sig.market] || 5;

  // ── Critical keyword boosts ───────────────────────────────────
  // Competitor-specific
  if (text.includes('pennylane')) score += 20;
  if (text.includes('cegid')) score += 15;
  if (text.includes('holded')) score += 12;
  if (text.includes('datev')) score += 8;
  if (text.includes('regate') || text.includes('qonto')) score += 10;
  if (text.includes('xero')) score += 6;
  if (text.includes('lexoffice') || text.includes('sevdesk')) score += 6;

  // Regulatory triggers
  if (text.includes('dgfip') || text.includes('plateforme agr')) score += 18;
  if (text.includes('aeat') || text.includes('verifactu')) score += 15;
  if (text.includes('xrechnung') || text.includes('zugferd')) score += 12;
  if (text.includes('mandate') || text.includes('mandatory') || text.includes('obligation')) score += 12;
  if (text.includes('september 2026') || text.includes('sept 2026')) score += 20;
  if (text.includes('january 2027') || text.includes('jan 2027')) score += 15;
  if (text.includes('einvoic') || text.includes('e-invoic') || text.includes('electronic invoic')) score += 10;

  // High-impact events
  if (text.includes('funding') || text.includes('series') || text.includes('raise') || 
      text.includes('million') || text.includes('billion') || text.includes('levée')) score += 12;
  if (text.includes('acquisition') || text.includes('acquired') || text.includes('merger')) score += 10;
  if (text.includes('launch') || text.includes('lancement') || text.includes('launches')) score += 8;
  if (text.includes('expansion') || text.includes('expanding') || text.includes('entering')) score += 8;
  if (text.includes('spain') || text.includes('espagne') || text.includes('espana')) {
    if (sig.category === 'Competitive') score += 10; // Pennylane Spain arrival
  }
  if (text.includes('germany') || text.includes('deutschland') || text.includes('allemagne')) {
    if (sig.category === 'Competitive') score += 6;
  }

  // Sage-specific
  if (text.includes('sage') && text.includes('active')) score += 10;
  if (text.includes('autoentry') || text.includes('auto entry')) score += 6;
  if (text.includes('generation experts') || text.includes('génération experts')) score += 8;
  if (text.includes('despacho') || text.includes('despachos')) score += 8;

  // AI/accountant specifics
  if (text.includes('accountant-first') || text.includes('accountant first')) score += 6;
  if (text.includes('practice management')) score += 5;
  if (text.includes('ai copilot') || text.includes('copilot')) score += 6;

  return score;
}

async function main() {
  console.log(`\n🚀 WiSE Intel Hub — Comprehensive Signal Fetch v3`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📡 Processing ${FEEDS.length} sources\n`);

  const allSignals = [];
  let ok=0, fail=0;

  for (let i=0; i<FEEDS.length; i++) {
    const feed = FEEDS[i];
    const lbl = (feed.label || feed.source).slice(0,42).padEnd(42);
    process.stdout.write(`  [${String(i+1).padStart(2)}/${FEEDS.length}] ${lbl}`);

    const xml = await fetchUrl(feed.url, 10000);
    const items = parseItems(xml);

    if (!items.length) {
      process.stdout.write(` ⚠ no data\n`);
      fail++;
      // Try next Nitter instance if this was a Nitter feed
      if (feed.url.includes('nitter')) nitterIdx++;
      await new Promise(r=>setTimeout(r,200));
      continue;
    }

    let added = 0;
    for (const item of items) {
      if (added >= (feed.maxItems||3)) break;
      if (!matches(item, feed.keywords)) continue;
      const title = clean(getField(item,'title','dc:title')).slice(0,160);
      if (!title || title.length < 8) continue;
      const body = clean(getField(item,'description','content:encoded','content','summary','dc:description')).slice(0,300) || 'See source for details.';
      if (isDuplicateSignal(title, body)) continue;
      const link = getLink(item, feed.url).slice(0,400);
      const date = getDate(item);
      const sig = { title, category:feed.category, market:feed.market, topic:feed.topic,
                    source:feed.label||feed.source, date, body, link, implication:'' };
      sig.implication = implication({ ...sig, label:feed.label||'' });
      allSignals.push(sig);
      added++;
    }

    process.stdout.write(` ✅ +${added}\n`);
    if (added>0) ok++; else fail++;
    await new Promise(r=>setTimeout(r,200));
  }

  // Process: translate to English + score criticality
  allSignals.forEach(sig => {
    processSignalLanguage(sig);           // Translate non-English signals
    sig._criticality = criticalityScore(sig); // Score for sorting
  });

  // Sort: criticality first (highest = most important), then date (most recent)
  // This ensures the most strategically important AND most recent signals lead
  allSignals.sort((a, b) => {
    // Primary: criticality score descending (most critical first)
    const critDiff = b._criticality - a._criticality;
    if (Math.abs(critDiff) > 5) return critDiff; // Clear winner
    // Secondary: date descending (most recent first)
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    // Tertiary: criticality as tiebreaker
    return critDiff;
  });

  const final = allSignals.slice(0, 80);

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`📊 Sources: ${ok} ok / ${fail} failed / ${FEEDS.length} total`);
  console.log(`📰 Signals: ${allSignals.length} gathered → ${final.length} published`);
  console.log(`🌍 Markets: ${[...new Set(final.map(s=>s.market))].join(', ')}`);
  console.log(`🏷  Topics:  ${[...new Set(final.map(s=>s.category))].join(', ')}`);
  console.log(`${'─'.repeat(55)}\n`);

  // Clean internal scoring field before writing
  final.forEach(s => { delete s._criticality; });
  fs.writeFileSync('signals.json', JSON.stringify(final, null, 2), 'utf8');
  console.log(`✅ signals.json — ${final.length} signals, ${(fs.statSync('signals.json').size/1024).toFixed(1)}KB\n`);
}

main().catch(e=>{ console.error('Fatal:', e); process.exit(1); });
