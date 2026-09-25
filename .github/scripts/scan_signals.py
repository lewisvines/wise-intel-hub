#!/usr/bin/env python3
"""
WiSE Intel Hub — Daily Signal Scanner v5
New in v5:
  8. Embedded Finance scan — wallets, IBANs, BaaS, spend cards across WiSE competitors
  9. API/MCP Pricing (competitors) — accounting software API/developer tier changes
  10. API/MCP Pricing (major AI players) — Anthropic, OpenAI, Microsoft, Google, Mistral pricing
  11. Embedded Services — payroll, insurance, lending, tax filing bundled into accounting platforms
  12. M&A and funding — acquisitions and rounds reshaping the competitive map
  13. Regulatory expansion — CSRD, DAC8, EU AI Act, beyond e-invoicing
  14. Competitor pricing changes — tier restructures, freemium limit changes, accountant discounts
  15. Partner/integration ecosystem — key integrations that create platform lock-in
  16. AI agent launches — autonomous accounting agents that shift the category narrative
"""

import os, json, re, datetime, time, urllib.request, urllib.parse, urllib.error
from email.utils import parsedate_to_datetime

SIGNALS_FILE = "signals.json"
MAX_NEW_PER_MARKET = 3
MAX_TOTAL_SIGNALS = 60
SIGNAL_ARCHIVE_DAYS = 90
SIGNAL_EXPIRY_DAYS = 180
GEMINI_KEY = os.environ["GEMINI_API_KEY"]

MODEL_CHAIN = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]
MODEL = MODEL_CHAIN[0]

def gemini_url(model=None):
    m = model or MODEL
    return f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEMINI_KEY}"

GEMINI_URL = gemini_url()
IS_MONDAY = datetime.date.today().weekday() == 0

SAGE_CONTEXT = """Sage WiSE (Winning in Small Europe Through Accountants) PMM intelligence.
Products: Sage for Accountants (SfA), Sage Active (cloud SMB, PA-certified FR, Verifactu-certified ES), AutoEntry+AKAO (PA document capture), GoProposal, Sage Prevision, Sage Active MCP server (API/developer EAP).
Competitors: Pennylane (FR primary, ES H2 2026, DE live — EUR 115M ARR, USD 4.25B, 6k+ firms, has embedded French IBAN and banking), Cegid+Shine+EBP (FR/ES/PT/DE — 100 new FR sales reps Q2 2026), Holded/Visma (ES, 900k users, now has embedded Spanish IBAN/wallet), DATEV (DE partner not competitor), MyUnisoft/Conciliator/Regate/Qonto (FR), Contasol/Delsol (ES free tier), Xero JAX (AI benchmark), Dext (AE competitor).
Deadlines: France PA mandate Sept 1 2026 (7.9M businesses, EUR 15/invoice fine), Spain Verifactu Jan 2027 corporate/Jul 2027 self-employed (EUR 50k fine), Germany XRechnung Jan 2028, Portugal SAF-T Jan 2027.
Strategic risks: Holded and Pennylane both now have embedded banking in their markets — Sage Active has no banking product in FR or ES. Sage Active MCP server in EAP — need to track competitor API/MCP moves."""

MARKET_PROMPTS = {
    "FR": {
        "label": "France",
        "search_terms": "Pennylane France accountant 2026, Cegid EBP expert-comptable, facture electronique PA DGFiP septembre 2026, MyUnisoft Conciliator, AutoEntry France, Sage Active France, Pennylane IBAN banking France",
        "focus": "France PA mandate Sept 2026, Pennylane/Cegid moves against GE practices, document capture market, expert-comptable channel, embedded banking by accounting platforms"
    },
    "ES": {
        "label": "Spain",
        "search_terms": "Pennylane Spain asesorias 2026, Holded Verifactu wallet Spain, Sage Active Spain accountant, Verifactu AEAT 2027, Contasol Delsol Spain, Holded cuenta empresa IBAN",
        "focus": "Spain Verifactu Jan 2027, Pennylane Spain entry H2 2026, Holded wallet and banking moves, Despachos channel, embedded finance in Spanish accounting software"
    },
    "DE": {
        "label": "Germany",
        "search_terms": "DATEV cloud accounting 2026, XRechnung e-invoicing Germany, Lexoffice Haufe Germany, Cegid SevDesk Germany, Steuerberater software, DATEV API developer pricing",
        "focus": "Germany XRechnung Jan 2028, DATEV partnership, cloud layer above DATEV, Lexoffice moves, Cegid SevDesk, API/developer ecosystem for accountants"
    },
    "PT": {
        "label": "Portugal",
        "search_terms": "Cegid Primavera Portugal 2026, SAF-T Portugal 2027, OCC contabilista, PHC Software Portugal, e-invoicing Portugal, embedded services accounting Portugal",
        "focus": "Portugal SAF-T Jan 2027, Cegid/Primavera dominance, OCC accountant channel, PHC moves, embedded services bundling"
    }
}

JSON_SCHEMA = """Return ONLY valid JSON, no markdown, no explanation:
{
  "signals": [
    {
      "id": "unique-slug-max-40-chars",
      "category": "Competitive|Regulatory|AI & Tech|Pricing|Hiring|Brand|Embedded Finance|API/MCP Pricing|Embedded Services|M&A|AI Agents",
      "market": "MARKET_CODE",
      "date": "2026-04-22",
      "published_at": "2026-04-22",
      "accessed_at": "YYYY-MM-DD",
      "priority": "critical|high|watch",
      "title": "Precise headline under 120 chars",
      "body": "2-3 sentences of factual detail with numbers, dates, names.",
      "implication": "Specific action or risk for Sage WiSE strategy.",
      "source": "Human-readable source title and organisation",
      "source_url": "https://direct-page-containing-the-evidence",
      "source_type": "primary|secondary|internal",
      "evidence_status": "verified|corroborated|pending",
      "confidence": "high|medium|watch"
    }
  ],
  "scan_summary": "1 sentence summary of market intensity today"
}
Rules: Only new signals (past 48h). Empty array if nothing new. Never fabricate. Max 3 signals.
Use exact ISO dates. Link to the specific evidence page, not a search result or homepage.
Critical and high signals require a direct HTTPS source URL and verified or corroborated evidence.
Prefer primary regulators, company announcements, filings and official product or pricing pages."""

# ── QUALITY GUARDRAILS ──────────────────────────────────────────────────────

VALID_CATEGORIES = {
    "Competitive", "Regulatory", "AI & Tech", "Pricing", "Hiring", "Brand",
    "Embedded Finance", "API/MCP Pricing", "Embedded Services", "M&A", "AI Agents", "RSS-Fallback"
}

def validate_signal(sig, existing_titles):
    errors = []
    for field in ["id", "title", "body", "implication", "priority", "category", "market"]:
        if not sig.get(field, "").strip():
            errors.append(f"missing {field}")
    if not sig.get("source", "").strip():
        errors.append("no source")
    source_url = sig.get("source_url", "").strip()
    if not re.match(r"^https://[^\s]+$", source_url):
        errors.append("no direct HTTPS source_url")
    published_at = sig.get("published_at", sig.get("date", "")).strip()
    try:
        datetime.date.fromisoformat(published_at)
    except (TypeError, ValueError):
        errors.append("published_at is not an exact ISO date")
    accessed_at = sig.get("accessed_at", "").strip()
    try:
        datetime.date.fromisoformat(accessed_at)
    except (TypeError, ValueError):
        errors.append("accessed_at is not an exact ISO date")
    if sig.get("source_type") not in ("primary", "secondary", "internal"):
        errors.append("invalid source_type")
    if sig.get("evidence_status") not in ("verified", "corroborated", "pending"):
        errors.append("invalid evidence_status")
    if sig.get("confidence") not in ("high", "medium", "watch"):
        errors.append("invalid confidence")
    if sig.get("priority") in ("critical", "high") and sig.get("evidence_status") == "pending":
        errors.append("critical/high evidence is still pending")
    if published_at:
        sig["date"] = published_at
    impl = sig.get("implication", "").lower()
    generic_phrases = ["monitor closely", "keep an eye", "worth watching", "may impact", "could affect"]
    if any(p in impl for p in generic_phrases) and len(impl) < 80:
        errors.append("implication too generic")
    if len(sig.get("body", "")) < 50:
        errors.append("body too short")
    new_words = set(re.sub(r"[^a-z0-9]", " ", sig.get("title","").lower()).split())
    for existing_title in existing_titles:
        existing_words = set(re.sub(r"[^a-z0-9]", " ", existing_title.lower()).split())
        if len(new_words) > 3:
            overlap = len(new_words & existing_words) / len(new_words)
            if overlap > 0.65:
                errors.append(f"semantic duplicate of: {existing_title[:50]}")
                break
    if errors:
        print(f"  Filtered: {sig.get('title','')[:60]} - {', '.join(errors)}")
        return False
    if sig.get("category") == "Regulatory":
        sig["calendar_tag"] = True
    return True

# ── SIGNAL EXPIRY ───────────────────────────────────────────────────────────

def apply_expiry(signals):
    today = datetime.date.today()
    active, archived, removed = [], [], []
    for sig in signals:
        date_str = sig.get("published_at", sig.get("date", ""))
        sig_date = None
        for fmt in ["%b %Y", "%B %Y", "%Y-%m-%d"]:
            try:
                parsed = datetime.datetime.strptime(date_str, fmt)
                sig_date = parsed.date() if fmt == "%Y-%m-%d" else parsed.date().replace(day=1)
                break
            except:
                continue
        if not sig_date:
            active.append(sig)
            continue
        age_days = (today - sig_date).days
        if age_days >= SIGNAL_EXPIRY_DAYS:
            removed.append(sig.get("title", "")[:60])
        elif age_days >= SIGNAL_ARCHIVE_DAYS:
            sig["archived"] = True
            archived.append(sig)
        else:
            sig.pop("archived", None)
            active.append(sig)
    if archived:
        print(f"  Archived {len(archived)} signals (90-180 days old)")
    if removed:
        print(f"  Removed {len(removed)} expired signals (180+ days)")
        for t in removed:
            print(f"    - {t}")
    return active + archived

# ── PENNYLANE DEEP DIVE ─────────────────────────────────────────────────────

PENNYLANE_PROMPT = f"""{SAGE_CONTEXT}

TASK: Deep-dive search on Pennylane specifically.
Search for: Pennylane product updates, new features, pricing changes, API/developer announcements, banking/wallet/IBAN features, job postings (country managers for ES/DE/PT/BE/PL), partnership announcements, ComptAssistant AI updates, any EU market expansion news.
Search terms: Pennylane accountant France Spain Germany 2026, Pennylane funding product launch, Pennylane ComptAssistant AI, Pennylane API developer pricing, Pennylane banking IBAN wallet

{JSON_SCHEMA.replace("MARKET_CODE", "FR")}
Focus market on whichever market the signal relates to. Max 2 signals."""

# ── EMBEDDED FINANCE SCAN (NEW v5) ─────────────────────────────────────────

EMBEDDED_FINANCE_PROMPT = f"""{SAGE_CONTEXT}

TASK: Scan for embedded finance moves by accounting software competitors across France, Spain, Germany and Portugal in the past 48 hours.
Embedded finance includes: business bank accounts/IBANs bundled with accounting software, spend cards, expense management integration, BaaS (Banking as a Service), payments, lending, insurance bundled into accounting/ERP platforms.
Key competitors to watch: Pennylane (has French IBAN), Holded (has Spanish IBAN wallet), Cegid+Shine (has banking via Shine acquisition), Regate, Qonto, MyUnisoft, Lexoffice, SevDesk, any new entrant.
Search terms: accounting software IBAN wallet Spain France 2026, embedded banking accounting Europe, Holded wallet cuenta empresa, Pennylane banking compte, Cegid Shine banking, expense cards accounting platform Europe, BaaS accounting software SME Europe

{JSON_SCHEMA.replace("MARKET_CODE", "EU")}
Use the specific market code (FR/ES/DE/PT) or EU if cross-market. Max 3 signals. Category must be "Embedded Finance"."""

# ── API/MCP PRICING SCAN — COMPETITORS (NEW v5) ────────────────────────────

API_MCP_COMPETITORS_PROMPT = f"""{SAGE_CONTEXT}

TASK: Scan for API and MCP (Model Context Protocol) pricing, launch or positioning changes by accounting software competitors in Europe in the past 48 hours.
This includes: Pennylane API pricing tiers or developer programme changes, Cegid API or partner integration pricing, Holded API announcements, any accounting software launching MCP servers, developer ecosystems or agent platforms, API rate limits or usage-based pricing models for accounting platforms in FR/ES/DE/PT.
Also watch: any accounting platform integrating with Claude, ChatGPT, Copilot or other AI via API/MCP and announcing pricing for this.
Search terms: Pennylane API developer pricing 2026, Cegid API integration pricing, accounting software MCP server Europe, Holded API developer, accounting platform AI integration pricing Europe, Sage Active API MCP accountant

{JSON_SCHEMA.replace("MARKET_CODE", "EU")}
Use the specific market code (FR/ES/DE/PT) or EU if cross-market. Max 2 signals. Category must be "API/MCP Pricing"."""

# ── API/MCP PRICING SCAN — MAJOR AI PLAYERS (NEW v5) ───────────────────────

API_MCP_MAJOR_PLAYERS_PROMPT = f"""{SAGE_CONTEXT}

TASK: Scan for API and MCP pricing, model releases or positioning changes by major AI platform providers that will affect how accounting software vendors (including Sage) build, price and position AI-powered accountant tools.
This includes: Anthropic Claude API pricing changes or new model tiers, OpenAI GPT API pricing or accounting-specific agent launches, Microsoft Copilot for accounting/ERP pricing, Google Gemini API pricing for business applications, Mistral AI European accounting partnerships or pricing, any AI provider launching accounting-specific agent frameworks or MCP servers.
Why it matters: Sage Active has an MCP server in EAP. Competitors who find cheaper or more performant AI will price AI features more aggressively. AI pricing shifts determine the economics of AI-powered accountant workflows.
Search terms: Anthropic Claude API pricing 2026, OpenAI GPT pricing accounting, Microsoft Copilot accounting ERP pricing, Mistral AI Europe accounting, AI agent pricing accounting software, MCP server accounting finance 2026, Gemini API business pricing

{JSON_SCHEMA.replace("MARKET_CODE", "EU")}
Category must be "API/MCP Pricing". Max 2 signals."""

# ── EMBEDDED SERVICES SCAN (NEW v5) ────────────────────────────────────────

EMBEDDED_SERVICES_PROMPT = f"""{SAGE_CONTEXT}

TASK: Scan for embedded services launches or announcements by accounting software competitors in France, Spain, Germany and Portugal in the past 48 hours.
Embedded services includes: payroll bundled into accounting platforms, business insurance integrated into accounting software, invoice financing or lending offered within accounting tools, tax filing automation as a service, business formation/incorporation services, HR services embedded in accounting/ERP, pension/benefits integrated into payroll+accounting stacks.
Key competitors: Pennylane, Cegid, Holded, Regate, Qonto, Factorial, PayFit, Silae, any platform adding services beyond core accounting.
Search terms: accounting software payroll embedded France Spain 2026, insurance integrated accounting platform Europe, invoice financing accounting software SME, tax filing automation accountant platform, HR payroll accounting bundle Europe, Pennylane services, Holded servicios embedded

{JSON_SCHEMA.replace("MARKET_CODE", "EU")}
Category must be "Embedded Services". Max 2 signals."""

# ── M&A SCAN (NEW v5) ───────────────────────────────────────────────────────

MA_PROMPT = f"""{SAGE_CONTEXT}

TASK: Scan for M&A activity (acquisitions, mergers, funding rounds) in the European accounting software and fintech space that could reshape the competitive landscape for Sage WiSE in the past 48 hours.
Focus on: any acquisition of French, Spanish, German or Portuguese accounting software companies, major funding rounds for competitors (>EUR 5M), PE or VC backing for accounting software roll-ups, fintech acquisitions by accounting platforms, any company acquiring document capture, payroll, or advisory software in these markets.
Key players to watch being acquired or acquiring: Pennylane, Cegid, Holded, Regate, Qonto, MyUnisoft, Conciliator, Factorial, Silae, PayFit, any regional accounting software.
Search terms: accounting software acquisition France Spain Germany Portugal 2026, fintech merger accounting Europe, PE roll-up accounting software SME, Cegid acquisition 2026, Pennylane acquisition, startup funding accounting Europe 2026

{JSON_SCHEMA.replace("MARKET_CODE", "EU")}
Category must be "M&A". Max 2 signals."""

# ── AI AGENTS SCAN (NEW v5) ─────────────────────────────────────────────────

AI_AGENTS_PROMPT = f"""{SAGE_CONTEXT}

TASK: Scan for autonomous AI agent launches or announcements in the European accounting and tax software space in the past 48 hours.
AI agents include: autonomous reconciliation agents, tax preparation agents that file without human intervention, invoice processing agents, advisory agents that proactively surface insights to accountants, agentic workflows triggered by accounting events, AI that takes actions in accounting software on behalf of users.
This is strategically critical: Sage Active has Copilot, and the MCP server EAP enables agentic workflows. Whoever lands a credible autonomous agent story with French or Spanish accountants first wins the AI narrative.
Search terms: AI agent accounting France Spain 2026, autonomous accounting agent Europe, agentic workflow accountant software, Pennylane AI agent, Cegid AI autonomous, accounting copilot agent France, MCP accounting agent Europe, LLM accounting automation 2026

{JSON_SCHEMA.replace("MARKET_CODE", "EU")}
Category must be "AI Agents". Max 2 signals."""

# ── IFYRNE GENERATION ───────────────────────────────────────────────────────

def generate_ifyrne(recent_signals):
    if not IS_MONDAY:
        return None
    critical = [s for s in recent_signals if s.get("priority") == "critical" and not s.get("archived")][:6]
    if not critical:
        return None
    signal_summaries = "\n".join([
        f"- [{s.get('market','EU')}] {s.get('title','')} | {s.get('implication','')[:100]}"
        for s in critical
    ])
    prompt = f"""{SAGE_CONTEXT}

You are Lewis Vines, Senior PMM at Sage Group leading the WiSE programme. Write the "If You Read Nothing Else" paragraph for this week's intelligence hub — a 4-5 sentence editorial summary written in a direct, senior PMM voice. No bullet points. No fluff. Every sentence must carry strategic weight. Reference specific companies, deadlines, and actions. End with the single most important action Sage must take this week.

This week's critical signals:
{signal_summaries}

Write ONLY the paragraph. No title, no preamble."""
    response, error = call_gemini_raw(prompt)
    if error or not response:
        return None
    candidates = response.get("candidates", [])
    if not candidates:
        return None
    text = "".join(p.get("text","") for p in candidates[0].get("content",{}).get("parts",[])).strip()
    if len(text) > 100:
        print(f"  IFYRNE generated: {len(text)} chars")
        return text
    return None

# ── API CALLS ───────────────────────────────────────────────────────────────

def call_gemini_raw(prompt, use_search=True, retries=2):
    global MODEL
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2000}
    }
    if use_search:
        payload["tools"] = [{"google_search": {}}]
    data = json.dumps(payload).encode()
    for model_idx, model in enumerate(MODEL_CHAIN):
        url = gemini_url(model)
        for attempt in range(retries + 1):
            try:
                req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=120) as r:
                    if model != MODEL:
                        print(f"  promoted fallback {model}")
                        MODEL = model
                    return json.loads(r.read()), None
            except urllib.error.HTTPError as e:
                body = e.read().decode()[:200]
                if e.code == 429:
                    print(f"  429 on {model} - trying next model")
                    break
                elif e.code in (500, 502, 503, 504) and attempt < retries:
                    wait = 30 * (attempt + 1)
                    print(f"  HTTP {e.code} on {model} - waiting {wait}s")
                    time.sleep(wait)
                else:
                    return None, f"HTTP {e.code}: {body}"
            except Exception as e:
                return None, str(e)
    return None, "quota_exhausted"

def check_quota():
    global MODEL
    test = {"contents": [{"parts": [{"text": "ready"}]}], "generationConfig": {"temperature": 0, "maxOutputTokens": 3}}
    data = json.dumps(test).encode()
    for model in MODEL_CHAIN:
        url = gemini_url(model)
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                MODEL = model
                print(f"Pre-flight: {model} available")
                return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"Pre-flight: {model} quota exhausted")
                continue
            print(f"Pre-flight: {model} HTTP {e.code}")
            MODEL = model
            return True
        except Exception as e:
            print(f"Pre-flight: {model} {e}")
            continue
    print("Pre-flight: All models quota-exhausted - RSS fallback only")
    return False

def extract_json(text):
    text = text.strip()
    if text.startswith("{"):
        try: return json.loads(text)
        except: pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try: return json.loads(match.group())
        except: pass
    return None

def run_thematic_scan(name, prompt, existing_titles):
    """Run a thematic (non-market) scan and return validated signals."""
    print(f"\n-- {name} --")
    response, error = call_gemini_raw(prompt)
    if error == "quota_exhausted":
        print(f"  Quota exhausted")
        return [], "quota_exhausted", True
    if error or not response:
        print(f"  Error: {error}")
        return [], error, False
    candidates = response.get("candidates", [])
    if not candidates:
        return [], "no_candidates", False
    text = "".join(p.get("text","") for p in candidates[0].get("content",{}).get("parts",[]))
    parsed = extract_json(text)
    if not parsed:
        print(f"  Parse error - raw: {text[:200]}")
        return [], "parse_error", False
    raw = parsed.get("signals", [])
    validated = [s for s in raw if validate_signal(s, existing_titles)]
    print(f"  {len(raw)} found -> {len(validated)} passed quality check")
    for s in validated:
        print(f"    [{s.get('priority','').upper()}] {s.get('title','')[:70]}")
    return validated, parsed.get("scan_summary", ""), False

def scan_market(market_key, existing_titles):
    m = MARKET_PROMPTS[market_key]
    print(f"\n-- {m['label']} ({market_key}) --")
    prompt = f"""{SAGE_CONTEXT}

TASK: Search for new market signals in the past 24-48 hours for {m['label']} ({market_key}).
Focus: {m['focus']}
Search terms: {m['search_terms']}

{JSON_SCHEMA.replace('MARKET_CODE', market_key)}"""
    response, error = call_gemini_raw(prompt)
    if error == "quota_exhausted":
        print(f"  Quota exhausted - stopping")
        return [], "quota_exhausted", True
    if error or not response:
        print(f"  Error: {error}")
        return [], error, False
    candidates = response.get("candidates", [])
    if not candidates:
        return [], "no_candidates", False
    text = "".join(p.get("text","") for p in candidates[0].get("content",{}).get("parts",[]))
    parsed = extract_json(text)
    if not parsed:
        print(f"  Parse error - raw: {text[:200]}")
        return [], "parse_error", False
    raw_signals = parsed.get("signals", [])
    validated = [s for s in raw_signals if validate_signal(s, existing_titles)]
    summary = parsed.get("scan_summary", "")
    print(f"  {len(raw_signals)} found -> {len(validated)} passed quality check")
    for s in validated:
        print(f"    [{s.get('priority','').upper()}] {s.get('title','')[:70]}")
    return validated, summary, False

# ── DATA MANAGEMENT ─────────────────────────────────────────────────────────

def load_existing():
    if not os.path.exists(SIGNALS_FILE):
        return {}
    with open(SIGNALS_FILE) as f:
        return json.load(f)

def save_signals(data):
    with open(SIGNALS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def make_id(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower())[:40].strip("-")

def merge_all(existing_data, all_new, summaries, new_ifyrne=None):
    existing = existing_data.get("signals", [])
    print("\nApplying signal expiry...")
    existing = apply_expiry(existing)
    existing_ids = {s["id"] for s in existing}
    existing_titles = [s["title"] for s in existing]
    added = 0
    for sig in all_new:
        if not sig.get("id"):
            sig["id"] = make_id(sig.get("title","signal"))
        if sig["id"] in existing_ids:
            continue
        if not sig.get("published_at"):
            sig["published_at"] = datetime.date.today().isoformat()
        if not sig.get("date"):
            sig["date"] = sig["published_at"]
        existing.insert(0, sig)
        existing_ids.add(sig["id"])
        existing_titles.insert(0, sig["title"])
        added += 1
    existing = existing[:MAX_TOTAL_SIGNALS]
    meta = existing_data.get("meta", {})
    meta["last_updated"] = datetime.date.today().isoformat()
    meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
    meta["signal_count"] = len([s for s in existing if not s.get("archived")])
    meta["archived_count"] = len([s for s in existing if s.get("archived")])
    monday = datetime.date.today() - datetime.timedelta(days=datetime.date.today().weekday())
    sunday = monday + datetime.timedelta(days=6)
    meta["week_label"] = f"Week of {monday.day} {monday.strftime('%b')} - {sunday.day} {sunday.strftime('%b %Y')}"
    meta["last_scan_summary"] = (
        f"Automated evidence scan completed: {added} new signal"
        f"{'s' if added != 1 else ''} passed source, date and quality checks."
    )
    meta["scan_status"] = {
        "date": datetime.date.today().isoformat(),
        "markets_scanned": [k for k, v in summaries.items() if v not in ("quota_exhausted","parse_error","no_candidates","")],
        "markets_skipped": [k for k, v in summaries.items() if v in ("quota_exhausted",)],
        "signals_added": added,
        "quality_filtered": 0,
        "summaries": {k: v for k, v in summaries.items() if v and v not in ("quota_exhausted","parse_error")}
    }
    meta["scanner_version"] = "v5"
    meta["scanner_categories"] = list(VALID_CATEGORIES)
    if new_ifyrne:
        meta["ifyrne"] = new_ifyrne
        meta["ifyrne_updated"] = datetime.date.today().isoformat()
        print(f"IFYRNE updated for week of {datetime.date.today()}")
    print(f"Merged {added} new signals. Active: {meta['signal_count']}, Archived: {meta['archived_count']}")
    return {**existing_data, "meta": meta, "signals": existing}

# ── RSS SAFETY-NET ───────────────────────────────────────────────────────────
import xml.etree.ElementTree as ET
import html as _html

RSS_QUERIES = {
    "FR": [
        "Pennylane comptable France",
        "Cegid EBP expert-comptable",
        "facture electronique DGFiP 2026",
        "Pennylane IBAN compte bancaire",
    ],
    "ES": [
        "Pennylane España asesorias",
        "Holded Visma Verifactu wallet",
        "Sage Active España contable",
        "embedded banking contabilidad España",
    ],
    "DE": [
        "Pennylane Germany accountant",
        "DATEV cloud 2026",
        "Lexoffice Germany SME",
        "DATEV API developer pricing",
    ],
    "PT": [
        "Cegid Primavera Portugal",
        "SAF-T Portugal 2027",
        "TOConline contabilista",
    ],
}

def _google_news_rss(query, market_hl):
    q = urllib.parse.quote(query)
    return f"https://news.google.com/rss/search?q={q}&hl={market_hl}&gl={market_hl.split('-')[-1] if '-' in market_hl else market_hl.upper()}&ceid={market_hl.split('-')[-1] if '-' in market_hl else market_hl.upper()}:{market_hl.split('-')[0]}"

def _bing_news_rss(query, market_cc):
    q = urllib.parse.quote(query)
    return f"https://www.bing.com/news/search?q={q}&format=rss&cc={market_cc}"

def _fetch_rss(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; WiSE-Hub/1.0)"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    RSS fetch error: {e}")
        return None

def _parse_rss(xml_text, max_items=3):
    items = []
    try:
        root = ET.fromstring(xml_text)
        for item in root.findall(".//item")[:max_items]:
            title = item.findtext("title", "").strip()
            link = item.findtext("link", "").strip()
            pub = item.findtext("pubDate", "").strip()
            desc = item.findtext("description", "").strip()
            if title:
                items.append({
                    "title": _html.unescape(title),
                    "link": link,
                    "pub": pub,
                    "desc": _html.unescape(re.sub(r"<[^>]+>", " ", desc))[:300],
                })
    except Exception as e:
        print(f"    RSS parse error: {e}")
    return items

def rss_fallback_scan(existing_titles, max_per_market=1):
    hl_map = {"FR": ("fr", "FR"), "ES": ("es", "ES"), "DE": ("de", "DE"), "PT": ("pt-PT", "PT")}
    out = []
    for market, queries in RSS_QUERIES.items():
        hl, cc = hl_map[market]
        for q in queries[:1]:
            xml = _fetch_rss(_google_news_rss(q, hl))
            source_name = "Google News"
            if not xml:
                xml = _fetch_rss(_bing_news_rss(q, cc))
                source_name = "Bing News"
            if not xml:
                continue
            items = _parse_rss(xml, max_items=max_per_market)
            for it in items:
                if any(it["title"][:40].lower() in t.lower() for t in existing_titles):
                    continue
                try:
                    published_at = parsedate_to_datetime(it["pub"]).date().isoformat()
                except (TypeError, ValueError, OverflowError):
                    published_at = datetime.date.today().isoformat()
                out.append({
                    "id": make_id("rss-" + market + "-" + it["title"][:30]),
                    "category": "RSS-Fallback",
                    "market": market,
                    "date": published_at,
                    "published_at": published_at,
                    "accessed_at": datetime.date.today().isoformat(),
                    "priority": "watch",
                    "title": it["title"][:180],
                    "body": (it["desc"] or "Surfaced via RSS safety net.")[:400],
                    "implication": "Flagged by RSS fallback - requires human review for strategic relevance.",
                    "source": f"{source_name} RSS ({market})",
                    "source_url": it["link"],
                    "source_type": "secondary",
                    "evidence_status": "pending",
                    "confidence": "watch",
                })
            print(f"  [{market}] {source_name} RSS: {len(items)} items for '{q[:40]}'")
    print(f"  RSS fallback: {len(out)} signals prepared")
    return out

# ── MAIN ────────────────────────────────────────────────────────────────────

def main():
    today = datetime.date.today()
    print(f"=== WiSE Signal Scanner v5 - {today} ===")
    print(f"Model: {MODEL} | Monday: {IS_MONDAY}")
    print(f"New thematic scans: Embedded Finance, API/MCP Pricing (x2), Embedded Services, M&A, AI Agents")

    existing_data = load_existing()
    existing_signals = existing_data.get("signals", [])
    existing_titles = [s["title"] for s in existing_signals]
    print(f"Existing signals: {len(existing_signals)}")

    if not check_quota():
        print("\n-- RSS Safety-Net Scan --")
        rss_signals = rss_fallback_scan(existing_titles)
        meta = existing_data.get("meta", {})
        meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
        meta["last_scan_summary"] = f"Gemini quota exhausted - RSS fallback ({len(rss_signals)} signals)"
        meta["scan_status"] = {
            "date": today.isoformat(),
            "markets_scanned": [],
            "markets_skipped": ["FR","ES","DE","PT"],
            "signals_added": len(rss_signals),
            "source": "rss_fallback",
            "error": "quota_exhausted_preflight"
        }
        existing_data["meta"] = meta
        if rss_signals:
            merged = merge_all(existing_data, rss_signals, {k: "rss_fallback" for k in ["FR","ES","DE","PT"]}, None)
            save_signals(merged)
        else:
            save_signals(existing_data)
        return

    all_new = []
    summaries = {}
    quota_hit = False

    # 1. Market scans: FR -> ES -> DE -> PT
    for market_key in ["FR", "ES", "DE", "PT"]:
        signals, summary, stop = scan_market(market_key, existing_titles + [s["title"] for s in all_new])
        all_new.extend(signals)
        summaries[market_key] = summary
        if stop:
            quota_hit = True
            remaining = ["FR","ES","DE","PT"]
            remaining = remaining[remaining.index(market_key)+1:]
            for mk in remaining:
                summaries[mk] = "quota_exhausted"
            break
        time.sleep(5)

    # 2. Pennylane deep dive
    if not quota_hit:
        time.sleep(5)
        pl_sigs, pl_sum, pl_stop = run_thematic_scan("Pennylane Deep Dive", PENNYLANE_PROMPT, existing_titles + [s["title"] for s in all_new])
        all_new.extend(pl_sigs)
        summaries["Pennylane"] = pl_sum
        if pl_stop:
            quota_hit = True

    # 3. Embedded Finance scan
    if not quota_hit:
        time.sleep(5)
        ef_sigs, ef_sum, ef_stop = run_thematic_scan("Embedded Finance", EMBEDDED_FINANCE_PROMPT, existing_titles + [s["title"] for s in all_new])
        all_new.extend(ef_sigs)
        summaries["Embedded Finance"] = ef_sum
        if ef_stop:
            quota_hit = True

    # 4. API/MCP Pricing - Competitors
    if not quota_hit:
        time.sleep(5)
        api_comp_sigs, api_comp_sum, api_comp_stop = run_thematic_scan("API/MCP Pricing (Competitors)", API_MCP_COMPETITORS_PROMPT, existing_titles + [s["title"] for s in all_new])
        all_new.extend(api_comp_sigs)
        summaries["API/MCP Competitors"] = api_comp_sum
        if api_comp_stop:
            quota_hit = True

    # 5. API/MCP Pricing - Major AI Players
    if not quota_hit:
        time.sleep(5)
        api_ai_sigs, api_ai_sum, api_ai_stop = run_thematic_scan("API/MCP Pricing (Major AI Players)", API_MCP_MAJOR_PLAYERS_PROMPT, existing_titles + [s["title"] for s in all_new])
        all_new.extend(api_ai_sigs)
        summaries["API/MCP AI Players"] = api_ai_sum
        if api_ai_stop:
            quota_hit = True

    # 6. Embedded Services
    if not quota_hit:
        time.sleep(5)
        es_sigs, es_sum, es_stop = run_thematic_scan("Embedded Services", EMBEDDED_SERVICES_PROMPT, existing_titles + [s["title"] for s in all_new])
        all_new.extend(es_sigs)
        summaries["Embedded Services"] = es_sum
        if es_stop:
            quota_hit = True

    # 7. M&A
    if not quota_hit:
        time.sleep(5)
        ma_sigs, ma_sum, ma_stop = run_thematic_scan("M&A", MA_PROMPT, existing_titles + [s["title"] for s in all_new])
        all_new.extend(ma_sigs)
        summaries["M&A"] = ma_sum
        if ma_stop:
            quota_hit = True

    # 8. AI Agents
    if not quota_hit:
        time.sleep(5)
        ag_sigs, ag_sum, ag_stop = run_thematic_scan("AI Agents", AI_AGENTS_PROMPT, existing_titles + [s["title"] for s in all_new])
        all_new.extend(ag_sigs)
        summaries["AI Agents"] = ag_sum

    # 9. Monday IFYRNE
    new_ifyrne = None
    if IS_MONDAY and not quota_hit:
        time.sleep(5)
        print("\n-- Monday IFYRNE Generation --")
        recent = existing_signals[:12] + all_new
        new_ifyrne = generate_ifyrne(recent)

    updated = merge_all(existing_data, all_new, summaries, new_ifyrne)
    save_signals(updated)

    print("\n=== Scan Complete ===")
    print(f"Scans run: {list(summaries.keys())}")
    print(f"New signals: {updated['meta']['scan_status']['signals_added']}")
    print(f"Active: {updated['meta']['signal_count']} | Archived: {updated['meta']['archived_count']}")

if __name__ == "__main__":
    main()
