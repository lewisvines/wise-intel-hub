/**
 * WiSE Intel Hub — Daily Signal Fetcher
 * Fetches 40+ RSS feeds across competitors, regulatory, market intelligence and AI
 * Runs free on GitHub Actions — zero API cost, zero Make operations
 *
 * Sources covered:
 * COMPETITIVE: Pennylane, Cegid, Holded, DATEV, Qonto/Regate, Xero, MyUnisoft, Lexoffice, SevDesk
 * REGULATORY:  DGFiP FR, AEAT ES, BMF DE, OCC PT, EU eInvoicing directive
 * MARKET:      Expert-comptable FR, Despachos ES, Steuerberater DE, AccountingWEB, Les Echos, Expansion
 * AI:          TechCrunch AI, VentureBeat, AI in accounting EU, Google AI announcements
 * SAGE:        Sage global blog, Sage FR, Sage ES, Sage developer, Sage community
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

// ── SOURCE REGISTRY ─────────────────────────────────────────────────────────
const FEEDS = [

  // ── COMPETITIVE INTELLIGENCE ─────────────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=Pennylane+accounting+software+France+Europe&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Competitive', market: 'FR', topic: 'competitor',
    label: 'Pennylane', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=Pennylane+fintech+levee+fonds+expansion&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News FR', category: 'Competitive', market: 'FR', topic: 'competitor',
    label: 'Pennylane FR', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=Cegid+EBP+Shine+comptabilite+acquisition&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Competitive', market: 'EU', topic: 'competitor',
    label: 'Cegid', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=Holded+software+Spain+Visma+accounting&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Competitive', market: 'ES', topic: 'competitor',
    label: 'Holded', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=DATEV+cloud+Germany+Steuerberater+software&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Competitive', market: 'DE', topic: 'competitor',
    label: 'DATEV', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=Qonto+Regate+France+fintech+comptabilite&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News FR', category: 'Competitive', market: 'FR', topic: 'competitor',
    label: 'Qonto/Regate', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=Xero+accounting+Europe+accountant+2025&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Competitive', market: 'EU', topic: 'competitor',
    label: 'Xero', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=Lexoffice+SevDesk+Germany+cloud+Buchhaltung&hl=de&gl=DE&ceid=DE:de',
    source: 'Google News DE', category: 'Competitive', market: 'DE', topic: 'competitor',
    label: 'Lexoffice/SevDesk', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=MyUnisoft+Conciliator+France+comptable&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News FR', category: 'Competitive', market: 'FR', topic: 'competitor',
    label: 'MyUnisoft/Conciliator', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=accounting+software+startup+funding+Europe+fintech&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Competitive', market: 'EU', topic: 'competitor',
    label: 'EU Fintech Funding', maxItems: 3
  },

  // ── REGULATORY INTELLIGENCE ───────────────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=facturation+electronique+France+DGFiP+plateforme+agreee&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News FR', category: 'Regulatory', market: 'FR', topic: 'regulatory',
    label: 'FR e-invoicing DGFiP', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=Verifactu+facturacion+electronica+Espana+2027&hl=es&gl=ES&ceid=ES:es',
    source: 'Google News ES', category: 'Regulatory', market: 'ES', topic: 'regulatory',
    label: 'Verifactu Spain', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=XRechnung+ZUGFeRD+E-Rechnung+Deutschland+Pflicht&hl=de&gl=DE&ceid=DE:de',
    source: 'Google News DE', category: 'Regulatory', market: 'DE', topic: 'regulatory',
    label: 'XRechnung Germany', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=SAF-T+Portugal+fatura+eletrónica+AT&hl=pt&gl=PT&ceid=PT:pt',
    source: 'Google News PT', category: 'Regulatory', market: 'PT', topic: 'regulatory',
    label: 'SAF-T Portugal', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=EU+eInvoicing+directive+European+mandate+2025+2026&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Regulatory', market: 'EU', topic: 'regulatory',
    label: 'EU eInvoicing Directive', maxItems: 2
  },

  // ── MARKET INTELLIGENCE ───────────────────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=expert+comptable+logiciel+cabinet+France&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News FR', category: 'Market Intelligence', market: 'FR', topic: 'market',
    label: 'Expert-Comptable Market', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=asesor+fiscal+software+despacho+contable+Espana&hl=es&gl=ES&ceid=ES:es',
    source: 'Google News ES', category: 'Market Intelligence', market: 'ES', topic: 'market',
    label: 'Spanish Accounting Market', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=Steuerberater+Software+Digitalisierung+Kanzlei&hl=de&gl=DE&ceid=DE:de',
    source: 'Google News DE', category: 'Market Intelligence', market: 'DE', topic: 'market',
    label: 'German Accounting Market', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=cloud+accounting+SME+Europe+growth+adoption&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Market Intelligence', market: 'EU', topic: 'market',
    label: 'EU Cloud Accounting', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=small+business+accounting+software+Europe+2025&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Market Intelligence', market: 'EU', topic: 'market',
    label: 'EU SME Market', maxItems: 2
  },

  // ── AI & TECH ─────────────────────────────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=AI+accounting+automation+artificial+intelligence+accountant&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'AI & Tech', market: 'EU', topic: 'ai',
    label: 'AI in Accounting', maxItems: 4
  },
  {
    url: 'https://news.google.com/rss/search?q=intelligence+artificielle+comptabilite+expert-comptable+France&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News FR', category: 'AI & Tech', market: 'FR', topic: 'ai',
    label: 'IA Comptabilité FR', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=generative+AI+finance+accounting+copilot+Europe&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'AI & Tech', market: 'EU', topic: 'ai',
    label: 'Generative AI Finance', maxItems: 3
  },
  {
    url: 'https://feeds.feedburner.com/TechCrunch/',
    source: 'TechCrunch', category: 'AI & Tech', market: 'EU', topic: 'ai',
    label: 'TechCrunch', maxItems: 2,
    keywords: ['accounting', 'fintech', 'ai finance', 'accounting software']
  },
  {
    url: 'https://venturebeat.com/feed/',
    source: 'VentureBeat', category: 'AI & Tech', market: 'EU', topic: 'ai',
    label: 'VentureBeat', maxItems: 2,
    keywords: ['accounting', 'fintech', 'AI finance', 'bookkeeping']
  },

  // ── SAGE NEWS ─────────────────────────────────────────────────────────────
  {
    url: 'https://news.google.com/rss/search?q=Sage+Group+accounting+software+news&hl=en&gl=GB&ceid=GB:en',
    source: 'Google News', category: 'Sage News', market: 'EU', topic: 'sage',
    label: 'Sage Global', maxItems: 3
  },
  {
    url: 'https://news.google.com/rss/search?q=Sage+comptabilite+France+expert-comptable&hl=fr&gl=FR&ceid=FR:fr',
    source: 'Google News FR', category: 'Sage News', market: 'FR', topic: 'sage',
    label: 'Sage France', maxItems: 2
  },
  {
    url: 'https://news.google.com/rss/search?q=Sage+contabilidad+Espana+despacho&hl=es&gl=ES&ceid=ES:es',
    source: 'Google News ES', category: 'Sage News', market: 'ES', topic: 'sage',
    label: 'Sage Spain', maxItems: 2
  },

  // ── DIRECT BLOG FEEDS ─────────────────────────────────────────────────────
  {
    url: 'https://www.accountingweb.co.uk/feed',
    source: 'AccountingWEB', category: 'Market Intelligence', market: 'EU', topic: 'market',
    label: 'AccountingWEB UK', maxItems: 3
  },
  {
    url: 'https://www.accountingtoday.com/feed',
    source: 'Accounting Today', category: 'Market Intelligence', market: 'EU', topic: 'market',
    label: 'Accounting Today', maxItems: 2
  },
];

// ── FETCH UTILITY ────────────────────────────────────────────────────────────
function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WiSE-Intel-Hub/2.0; RSS Reader)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en,fr,es,de',
      }
    };
    const req = protocol.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        resolve(''); // graceful failure
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', () => resolve(''));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(''); });
    req.on('error', () => resolve(''));
  });
}

// ── RSS/ATOM PARSER ──────────────────────────────────────────────────────────
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['item', 'entry'].includes(name)
});

function parseItems(xmlText) {
  if (!xmlText || xmlText.length < 50) return [];
  try {
    const doc = parser.parse(xmlText);
    // RSS 2.0
    if (doc?.rss?.channel?.item) return doc.rss.channel.item.slice(0, 5);
    // Atom
    if (doc?.feed?.entry) return doc.feed.entry.slice(0, 5);
    // Some feeds nest differently
    if (doc?.channel?.item) return doc.channel.item.slice(0, 5);
    return [];
  } catch {
    return [];
  }
}

function extractField(item, ...fields) {
  for (const f of fields) {
    const val = item[f];
    if (!val) continue;
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
      if (val['#text']) return String(val['#text']).trim();
      if (val['@_href']) return val['@_href'];
      const str = JSON.stringify(val);
      if (str.length < 500) return str;
    }
  }
  return '';
}

function stripHtml(str) {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 300);
}

function parseDate(item) {
  const raw = extractField(item, 'pubDate', 'published', 'updated', 'dc:date');
  if (!raw) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return new Date().toISOString().split('T')[0];
}

function itemMatchesKeywords(item, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const text = JSON.stringify(item).toLowerCase();
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

// ── DEDUPLICATION ────────────────────────────────────────────────────────────
const seen = new Set();
function isDuplicate(title) {
  const key = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}

// ── IMPLICATION GENERATOR ────────────────────────────────────────────────────
function generateImplication(signal) {
  const { category, market, label = '', title = '' } = signal;
  const t = title.toLowerCase();
  const l = label.toLowerCase();

  if (category === 'Regulatory') {
    if (market === 'FR') return 'France PA mandate September 2026 — any regulatory news here affects your September deadline and GE practice activation window.';
    if (market === 'ES') return 'Verifactu January 2027 — monitor for enforcement updates, delay announcements, or specification changes that affect Active certification.';
    if (market === 'DE') return 'Germany e-invoice issue mandate January 2027 — track XRechnung/ZUGFeRD spec updates for DATEV compatibility planning.';
    if (market === 'PT') return 'SAF-T Portugal 2027 — OCC engagement window. Any AT (Tax Authority) updates affect the proposition definition timeline.';
    return 'EU regulatory development — assess impact on the pan-EU compliance proposition and mandate timeline.';
  }

  if (category === 'Competitive') {
    if (l.includes('pennylane')) return 'Pennylane is your #1 threat in France and arriving Spain H2 2026. Any funding, product launch or hiring news signals acceleration — activate GE practices before they arrive.';
    if (l.includes('cegid')) return 'Cegid has 100 new French salespeople deploying Q2 2026. Any Cegid news means their commercial team is likely already calling your GE practices.';
    if (l.includes('holded')) return 'Holded is your primary Spain competitor — direct to SME, bypassing the accountant channel. News here affects your Despachos pitch window before Verifactu 2027.';
    if (l.includes('datev')) return 'DATEV is a cooperative and strategic partner, not a competitor. Frame Sage Active as the cloud management layer above DATEV compliance — work alongside, not against.';
    if (l.includes('qonto') || l.includes('regate')) return 'Qonto owns Regate (PA-certified). Their banking + accounting play is a direct threat to the French accountant channel. Monitor for product launches and accountant partnership moves.';
    if (l.includes('xero')) return 'Xero JAX AI is the benchmark for accountant-first AI capability in the UK — a leading indicator of where the EU market will move. Watch feature releases closely.';
    if (l.includes('lexoffice') || l.includes('sevdesk')) return 'German cloud challenger. Monitor market share data and DATEV partnership moves — relevant for the Germany definition year strategy.';
    if (l.includes('funding') || t.includes('fund') || t.includes('raise') || t.includes('series')) return 'Competitor funding signals accelerating investment in the EU accounting software market. Assess impact on Sage\'s competitive position and timeline to launch.';
    return 'Competitive development in the EU accounting software market — assess impact on WiSE GTM timing and accountant messaging.';
  }

  if (category === 'AI & Tech') {
    if (t.includes('copilot') || t.includes('co-pilot')) return 'Copilot/AI assistant developments — benchmark against Sage Copilot\'s compliance-specific capabilities (DSN, Factur-X, PA validation). Generic AI is losing to specialist AI.';
    if (t.includes('automation') || t.includes('automat')) return 'Accounting automation news — relevant to the AutoEntry + AKAO positioning and the "AI does the checking" accountant message.';
    return 'AI development in accounting/fintech — assess whether this changes the competitive AI narrative or creates a new proof point for Sage Copilot.';
  }

  if (category === 'Sage News') {
    return 'Sage Group news — monitor for product launches, partnership announcements, or market positioning that affects the WiSE narrative or creates new proof points.';
  }

  if (category === 'Market Intelligence') {
    if (market === 'FR') return 'French market intelligence — relevant to GE practice activation strategy and France PA mandate communications. Expert-comptable community sentiment matters for adoption.';
    if (market === 'ES') return 'Spanish market intelligence — relevant to Despachos outreach strategy and Verifactu positioning. Accountant community news affects GoProposal and Active launch timing.';
    if (market === 'DE') return 'German market intelligence — relevant to the definition year strategy and DATEV partnership framing. Cloud adoption signals affect the FY27 GTM plan.';
    return 'EU market intelligence — assess relevance to WiSE positioning, accountant channel strategy, and mandate timeline planning.';
  }

  return 'Monitor and assess relevance to WiSE strategy across FR, ES, DE and PT.';
}

// ── MAIN EXECUTION ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 WiSE Intel Hub — Daily Signal Fetch`);
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📡 Processing ${FEEDS.length} sources...\n`);

  const allSignals = [];
  let successCount = 0;
  let errorCount = 0;

  for (const feed of FEEDS) {
    process.stdout.write(`  Fetching: ${feed.label || feed.source}...`);
    try {
      const xml = await fetchUrl(feed.url);
      const items = parseItems(xml);

      if (items.length === 0) {
        process.stdout.write(` ⚠ no items\n`);
        errorCount++;
        continue;
      }

      let added = 0;
      const limit = feed.maxItems || 3;

      for (const item of items.slice(0, limit + 5)) { // fetch a few extra to filter
        if (added >= limit) break;

        // Apply keyword filter if specified
        if (!itemMatchesKeywords(item, feed.keywords)) continue;

        const title = stripHtml(extractField(item, 'title'));
        if (!title || title.length < 10) continue;
        if (isDuplicate(title)) continue;

        const body = stripHtml(extractField(item,
          'description', 'content:encoded', 'content', 'summary', 'subtitle'
        )) || 'See source for full details.';

        const link = extractField(item, 'link', 'guid', 'id', '@_href') || feed.url;
        const date = parseDate(item);

        const signal = {
          title: title.substring(0, 150),
          category: feed.category,
          market: feed.market,
          topic: feed.topic,
          source: feed.label || feed.source,
          date,
          body: body.substring(0, 280),
          link: typeof link === 'string' ? link.substring(0, 300) : feed.url,
          implication: ''
        };

        // Generate implication
        signal.implication = generateImplication({ ...signal, label: feed.label || '' });

        allSignals.push(signal);
        added++;
      }

      process.stdout.write(` ✅ ${added} signals\n`);
      successCount++;

    } catch (err) {
      process.stdout.write(` ❌ ${err.message}\n`);
      errorCount++;
    }

    // Small delay to be respectful to servers
    await new Promise(r => setTimeout(r, 300));
  }

  // Sort: most recent first, then by category priority
  const categoryOrder = { 'Regulatory': 0, 'Competitive': 1, 'AI & Tech': 2, 'Market Intelligence': 3, 'Sage News': 4 };
  allSignals.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return (categoryOrder[a.category] ?? 5) - (categoryOrder[b.category] ?? 5);
  });

  // Cap at 60 signals maximum (most recent and relevant)
  const finalSignals = allSignals.slice(0, 60);

  console.log(`\n📊 Results:`);
  console.log(`   Sources successful: ${successCount}/${FEEDS.length}`);
  console.log(`   Total signals: ${allSignals.length} → trimmed to ${finalSignals.length}`);
  console.log(`   Categories: ${[...new Set(finalSignals.map(s => s.category))].join(', ')}`);
  console.log(`   Markets: ${[...new Set(finalSignals.map(s => s.market))].join(', ')}`);

  // Write signals.json
  fs.writeFileSync('signals.json', JSON.stringify(finalSignals, null, 2), 'utf8');
  console.log(`\n✅ signals.json written — ${finalSignals.length} signals, ${fs.statSync('signals.json').size} bytes\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
