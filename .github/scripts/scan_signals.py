#!/usr/bin/env python3
"""
WiSE Intel Hub — Daily Signal Scanner v4
Improvements:
  1. Signal quality guardrails (source check, implication validation, semantic dedup)
  2. Scan status written to signals.json meta (visible on hub dashboard)
  3. Signal expiry: 90d → archived status, 180d → removed
  4. Monday-only IFYRNE auto-generation (synthesises week signals in PMM voice)
  5. Pennylane deep-dive scan (daily, on top of 4 market scans)
  6. Regulatory signals auto-tagged for calendar view
  7. Email digest via GitHub Actions (called separately in workflow)
"""

import os, json, re, datetime, time, urllib.request, urllib.error

SIGNALS_FILE = "signals.json"
MAX_NEW_PER_MARKET = 3
MAX_TOTAL_SIGNALS = 40
SIGNAL_ARCHIVE_DAYS = 90
SIGNAL_EXPIRY_DAYS = 180
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
MODEL = "gemini-2.0-flash-lite"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_KEY}"
IS_MONDAY = datetime.date.today().weekday() == 0

SAGE_CONTEXT = """Sage WiSE (Winning in Small Europe Through Accountants) PMM intelligence.
Products: Sage for Accountants (SfA), Sage Active (cloud SMB, PA-certified FR, Verifactu-certified ES), AutoEntry+AKAO (PA document capture), GoProposal, Sage Prevision.
Competitors: Pennylane (FR primary, ES H2 2026, DE live — €115M ARR, $4.25B, 6k+ firms), Cegid+Shine+EBP (FR/ES/PT/DE — 100 new FR sales reps Q2 2026), Holded/Visma (ES, 80k customers), DATEV (DE partner not competitor), MyUnisoft/Conciliator/Regate/Qonto (FR), Contasol/Delsol (ES free tier), Xero JAX (AI benchmark), Dext (AE competitor).
Deadlines: France PA mandate Sept 1 2026 (7.9M businesses, €15/invoice fine), Spain Verifactu Jan 2027 corporate/Jul 2027 self-employed (€50k fine), Germany XRechnung Jan 2028, Portugal SAF-T Jan 2027.
Risks: GE-Active sync unresolved, PA registration stalled, Pennylane arriving ES before SfA Spain launch, Cegid 100 reps targeting GE practices."""

MARKET_PROMPTS = {
    "FR": {
        "label": "France",
        "search_terms": "Pennylane France accountant 2026, Cegid EBP expert-comptable, facture electronique PA DGFiP septembre 2026, MyUnisoft Conciliator, AutoEntry France, Sage Active France",
        "focus": "France PA mandate Sept 2026, Pennylane/Cegid moves against GE practices, document capture market, expert-comptable channel"
    },
    "ES": {
        "label": "Spain",
        "search_terms": "Pennylane Spain asesorias 2026, Holded Verifactu Spain, Sage Active Spain accountant, Verifactu AEAT 2027, Contasol Delsol Spain",
        "focus": "Spain Verifactu Jan 2027, Pennylane Spain entry H2 2026, Holded moves, Despachos channel, autónomo segment"
    },
    "DE": {
        "label": "Germany",
        "search_terms": "DATEV cloud accounting 2026, XRechnung e-invoicing Germany, Lexoffice Haufe Germany, Cegid SevDesk Germany, Steuerberater software",
        "focus": "Germany XRechnung Jan 2028, DATEV partnership, cloud layer above DATEV, Lexoffice moves, Cegid SevDesk"
    },
    "PT": {
        "label": "Portugal",
        "search_terms": "Cegid Primavera Portugal 2026, SAF-T Portugal 2027, OCC contabilista, PHC Software Portugal, e-invoicing Portugal",
        "focus": "Portugal SAF-T Jan 2027, Cegid/Primavera dominance, OCC accountant channel, PHC moves"
    }
}

JSON_SCHEMA = """Return ONLY valid JSON, no markdown, no explanation:
{
  "signals": [
    {
      "id": "unique-slug-max-40-chars",
      "category": "Competitive|Regulatory|AI & Tech|Pricing|Hiring|Brand",
      "market": "MARKET_CODE",
      "date": "Apr 2026",
      "priority": "critical|high|watch",
      "title": "Precise headline under 120 chars",
      "body": "2-3 sentences of factual detail with numbers, dates, names.",
      "implication": "Specific action or risk for Sage WiSE strategy.",
      "source": "Source name and date"
    }
  ],
  "scan_summary": "1 sentence summary of market intensity today"
}
Rules: Only new signals (past 48h). Empty array if nothing new. Never fabricate. Max 3 signals."""

# ── QUALITY GUARDRAILS ──────────────────────────────────────────────────────

def validate_signal(sig, existing_titles):
    """Filter out low-quality, sourceless, or semantically duplicate signals."""
    errors = []

    # Must have required fields
    for field in ["id", "title", "body", "implication", "priority", "category", "market"]:
        if not sig.get(field, "").strip():
            errors.append(f"missing {field}")

    # Must have a source (no sourceless signals published)
    if not sig.get("source", "").strip():
        errors.append("no source")

    # Implication must be specific — reject generic phrases
    impl = sig.get("implication", "").lower()
    generic_phrases = ["monitor closely", "keep an eye", "worth watching", "may impact", "could affect"]
    if any(p in impl for p in generic_phrases) and len(impl) < 80:
        errors.append("implication too generic")

    # Body must have substance
    if len(sig.get("body", "")) < 50:
        errors.append("body too short")

    # Semantic dedup — reject if title is too similar to existing
    new_words = set(re.sub(r"[^a-z0-9]", " ", sig.get("title","").lower()).split())
    for existing_title in existing_titles:
        existing_words = set(re.sub(r"[^a-z0-9]", " ", existing_title.lower()).split())
        if len(new_words) > 3:
            overlap = len(new_words & existing_words) / len(new_words)
            if overlap > 0.65:
                errors.append(f"semantic duplicate of: {existing_title[:50]}")
                break

    if errors:
        print(f"  ⚠ Filtered: {sig.get('title','')[:60]} — {', '.join(errors)}")
        return False

    # Tag regulatory signals for calendar view
    if sig.get("category") == "Regulatory":
        sig["calendar_tag"] = True

    return True

# ── SIGNAL EXPIRY ───────────────────────────────────────────────────────────

def apply_expiry(signals):
    """Mark signals as archived after 90 days, remove after 180 days."""
    today = datetime.date.today()
    active, archived, removed = [], [], []

    for sig in signals:
        # Parse signal date
        date_str = sig.get("date", "")
        sig_date = None
        for fmt in ["%b %Y", "%B %Y", "%Y-%m-%d"]:
            try:
                parsed = datetime.datetime.strptime(date_str, fmt)
                sig_date = parsed.date().replace(day=1)
                break
            except:
                continue

        if not sig_date:
            active.append(sig)  # Can't parse date, keep it
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
        print(f"  Removed {len(removed)} expired signals (180+ days):")
        for t in removed:
            print(f"    - {t}")

    return active + archived  # Active first, archived at bottom

# ── PENNYLANE DEEP DIVE ─────────────────────────────────────────────────────

PENNYLANE_PROMPT = f"""{SAGE_CONTEXT}

TASK: Deep-dive search on Pennylane specifically — Sage's primary competitive threat.
Search for: Pennylane product updates, new features, pricing changes, job postings (especially country managers for ES/DE/PT/BE/PL), press coverage, accountant testimonials, partnership announcements, ComptAssistant AI updates, banking/payments features, any EU market expansion news.
Search terms: "Pennylane" site:techcrunch.com OR site:sifted.eu OR site:linkedin.com, Pennylane accountant France Spain Germany 2026, Pennylane funding product launch, Pennylane ComptAssistant AI

{JSON_SCHEMA.replace("MARKET_CODE", "FR")}
Focus market on whichever market the signal relates to. Max 2 signals."""

# ── IFYRNE GENERATION (MONDAYS ONLY) ───────────────────────────────────────

def generate_ifyrne(recent_signals):
    """Monday only: synthesise week's top signals into IFYRNE paragraph."""
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
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2000}
    }
    if use_search:
        payload["tools"] = [{"google_search": {}}]

    data = json.dumps(payload).encode()
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(GEMINI_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read()), None
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 429:
                if attempt < retries:
                    wait = 60 * (attempt + 1)
                    print(f"  Rate limited — waiting {wait}s (retry {attempt+1}/{retries})")
                    time.sleep(wait)
                else:
                    return None, "quota_exhausted"
            else:
                return None, f"HTTP {e.code}"
        except Exception as e:
            return None, str(e)
    return None, "max_retries"

def check_quota():
    test = {"contents": [{"parts": [{"text": "ready"}]}], "generationConfig": {"temperature": 0, "maxOutputTokens": 3}}
    data = json.dumps(test).encode()
    req = urllib.request.Request(GEMINI_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print("Pre-flight: ✅ API available")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("Pre-flight: ❌ Quota exhausted — skipping scan")
            return False
        print(f"Pre-flight: ⚠️ HTTP {e.code} — proceeding")
        return True
    except Exception as e:
        print(f"Pre-flight: ⚠️ {e} — proceeding")
        return True

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

def scan_market(market_key, existing_titles):
    m = MARKET_PROMPTS[market_key]
    print(f"\n── {m['label']} ({market_key}) ──")
    prompt = f"""{SAGE_CONTEXT}

TASK: Search for new market signals in the past 24-48 hours for {m["label"]} ({market_key}).
Focus: {m["focus"]}
Search terms: {m["search_terms"]}

{JSON_SCHEMA.replace("MARKET_CODE", market_key)}"""

    response, error = call_gemini_raw(prompt)
    if error == "quota_exhausted":
        print(f"  Quota exhausted — stopping")
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
        print(f"  Parse error — raw: {text[:200]}")
        return [], "parse_error", False

    raw_signals = parsed.get("signals", [])
    # Apply quality guardrails
    validated = [s for s in raw_signals if validate_signal(s, existing_titles)]
    summary = parsed.get("scan_summary", "")
    print(f"  {len(raw_signals)} found → {len(validated)} passed quality check")
    for s in validated:
        print(f"    [{s.get('priority','').upper()}] {s.get('title','')[:70]}")
    return validated, summary, False

def scan_pennylane(existing_titles):
    print(f"\n── Pennylane Deep Dive ──")
    response, error = call_gemini_raw(PENNYLANE_PROMPT)
    if error:
        print(f"  {error}")
        return [], error
    if not response:
        return [], "no_response"
    candidates = response.get("candidates", [])
    if not candidates:
        return [], "no_candidates"
    text = "".join(p.get("text","") for p in candidates[0].get("content",{}).get("parts",[]))
    parsed = extract_json(text)
    if not parsed:
        return [], "parse_error"
    raw = parsed.get("signals", [])
    validated = [s for s in raw if validate_signal(s, existing_titles)]
    print(f"  {len(raw)} found → {len(validated)} passed quality check")
    return validated, parsed.get("scan_summary", "")

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

    # Apply expiry first
    print("\nApplying signal expiry...")
    existing = apply_expiry(existing)

    existing_ids = {s["id"] for s in existing}
    existing_titles = [s["title"] for s in existing]
    month = datetime.date.today().strftime("%b %Y")
    added = 0

    for sig in all_new:
        if not sig.get("id"):
            sig["id"] = make_id(sig.get("title","signal"))
        if sig["id"] in existing_ids:
            continue
        if not sig.get("date"):
            sig["date"] = month
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

    # Scan status for hub dashboard display
    meta["scan_status"] = {
        "date": datetime.date.today().isoformat(),
        "markets_scanned": [k for k, v in summaries.items() if v not in ("quota_exhausted","parse_error","no_candidates","")],
        "markets_skipped": [k for k, v in summaries.items() if v in ("quota_exhausted",)],
        "signals_added": added,
        "quality_filtered": sum(1 for v in summaries.values() if "filtered" in str(v)),
        "summaries": {k: v for k, v in summaries.items() if v and v not in ("quota_exhausted","parse_error")}
    }

    # Update IFYRNE on Mondays if generated
    if new_ifyrne:
        meta["ifyrne"] = new_ifyrne
        meta["ifyrne_updated"] = datetime.date.today().isoformat()
        print(f"IFYRNE updated for week of {datetime.date.today()}")

    print(f"Merged {added} new signals. Active: {meta['signal_count']}, Archived: {meta['archived_count']}")
    return {**existing_data, "meta": meta, "signals": existing}

# ── MAIN ────────────────────────────────────────────────────────────────────

def main():
    today = datetime.date.today()
    print(f"=== WiSE Signal Scanner v4 — {today} ===")
    print(f"Model: {MODEL} | Monday: {IS_MONDAY}")

    existing_data = load_existing()
    existing_signals = existing_data.get("signals", [])
    existing_titles = [s["title"] for s in existing_signals]
    print(f"Existing signals: {len(existing_signals)}")

    # Pre-flight quota check
    if not check_quota():
        meta = existing_data.get("meta", {})
        meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
        meta["scan_status"] = {"date": today.isoformat(), "markets_scanned": [], "markets_skipped": ["FR","ES","DE","PT"], "signals_added": 0, "error": "quota_exhausted_preflight"}
        existing_data["meta"] = meta
        save_signals(existing_data)
        return

    all_new = []
    summaries = {}

    # Market scans: FR → ES → DE → PT (priority order)
    for market_key in ["FR", "ES", "DE", "PT"]:
        signals, summary, stop = scan_market(market_key, existing_titles + [s["title"] for s in all_new])
        all_new.extend(signals)
        summaries[market_key] = summary
        if stop:
            # Mark remaining markets as skipped
            remaining = ["FR","ES","DE","PT"]
            remaining = remaining[remaining.index(market_key)+1:]
            for mk in remaining:
                summaries[mk] = "quota_exhausted"
            break
        time.sleep(5)

    # Pennylane deep dive (runs after market scans if quota allows)
    if "quota_exhausted" not in summaries.values():
        time.sleep(5)
        pl_signals, pl_summary = scan_pennylane(existing_titles + [s["title"] for s in all_new])
        all_new.extend(pl_signals)
        summaries["Pennylane"] = pl_summary

    # Monday IFYRNE generation
    new_ifyrne = None
    if IS_MONDAY and "quota_exhausted" not in summaries.values():
        time.sleep(5)
        print("\n── Monday IFYRNE Generation ──")
        recent = existing_signals[:12] + all_new
        new_ifyrne = generate_ifyrne(recent)

    # Merge and save
    updated = merge_all(existing_data, all_new, summaries, new_ifyrne)
    save_signals(updated)

    # Summary
    print("\n=== Scan Complete ===")
    print(f"Markets: {list(summaries.keys())}")
    print(f"New signals: {updated['meta']['scan_status']['signals_added']}")
    print(f"Active: {updated['meta']['signal_count']} | Archived: {updated['meta']['archived_count']}")

if __name__ == "__main__":
    main()
