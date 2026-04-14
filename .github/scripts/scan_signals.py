#!/usr/bin/env python3
"""
WiSE Intel Hub — Daily Signal Scanner v3
- Model: gemini-2.0-flash-lite (higher free tier quota)
- 4 focused market scans: FR → ES → DE → PT (priority order)
- Compressed prompts: full WiSE context, 40% fewer tokens
- Pre-flight quota check before each call
- Retry with backoff on 429
- Graceful degradation: if quota exhausted mid-run, keeps signals from markets already scanned
"""

import os, json, re, datetime, time, urllib.request, urllib.error

SIGNALS_FILE = "signals.json"
MAX_NEW_SIGNALS_PER_MARKET = 3
MAX_TOTAL_SIGNALS = 40
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
MODEL = "gemini-2.0-flash-lite"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={GEMINI_KEY}"

# ── MARKET SCAN PROMPTS ─────────────────────────────────────────────────────
# Full WiSE context preserved, restructured for token efficiency
# Priority order: FR → ES → DE → PT

SAGE_CONTEXT = """Sage WiSE (Winning in Small Europe Through Accountants) PMM intelligence.
Products: Sage for Accountants (SfA), Sage Active (cloud SMB, PA-certified FR, Verifactu-certified ES), AutoEntry+AKAO (PA document capture), GoProposal, Sage Prevision.
Competitors: Pennylane (FR primary, ES H2 2026, DE live — €115M ARR, $4.25B, 6k+ firms), Cegid+Shine+EBP (FR/ES/PT/DE — 100 new FR sales reps Q2 2026), Holded/Visma (ES, 80k customers), DATEV (DE partner not competitor), MyUnisoft/Conciliator/Regate/Qonto (FR), Contasol/Delsol (ES free tier), Xero JAX (AI benchmark), Dext (AE competitor).
Deadlines: France PA mandate Sept 1 2026 (7.9M businesses, €15/invoice fine), Spain Verifactu Jan 2027 corporate/Jul 2027 self-employed (€50k fine), Germany XRechnung Jan 2028, Portugal SAF-T Jan 2027.
Risks: GE-Active sync unresolved, PA registration stalled, Pennylane arriving ES before SfA Spain launch, Cegid 100 reps targeting GE practices."""

MARKET_PROMPTS = {
    "FR": {
        "market": "FR",
        "label": "France",
        "search_terms": "Pennylane France accountant 2026, Cegid EBP expert-comptable, facture electronique PA DGFiP septembre 2026, MyUnisoft Conciliator, AutoEntry France, Sage Active France accountant",
        "focus": "France e-invoicing PA mandate Sept 2026, Pennylane/Cegid moves against GE practices, document capture market, expert-comptable channel"
    },
    "ES": {
        "market": "ES",
        "label": "Spain",
        "search_terms": "Pennylane Spain asesorias 2026, Holded Verifactu Spain, Sage Active Spain accountant, Verifactu AEAT 2027, Contasol Delsol Spain accounting software",
        "focus": "Spain Verifactu Jan 2027, Pennylane Spain entry H2 2026, Holded competitive moves, Despachos channel, autónomo segment"
    },
    "DE": {
        "market": "DE",
        "label": "Germany",
        "search_terms": "DATEV cloud accounting Germany 2026, XRechnung e-invoicing Germany, Lexoffice Haufe Germany SMB, Cegid SevDesk Germany, accounting software Steuerberater",
        "focus": "Germany XRechnung mandate Jan 2028, DATEV partnership opportunity, cloud layer above DATEV, Lexoffice competitive moves, Cegid SevDesk integration"
    },
    "PT": {
        "market": "PT",
        "label": "Portugal",
        "search_terms": "Cegid Primavera Portugal 2026, SAF-T Portugal 2027, OCC contabilista certificado, PHC Software Portugal, e-invoicing Portugal accountant",
        "focus": "Portugal SAF-T Jan 2027, Cegid/Primavera dominance, OCC accountant channel, PHC competitive moves, mandatory accountant law"
    }
}

JSON_SCHEMA = """Return ONLY valid JSON, no markdown:
{
  "signals": [
    {
      "id": "slug-max-40-chars",
      "category": "Competitive|Regulatory|AI & Tech|Pricing|Hiring|Brand",
      "market": "MARKET_CODE",
      "date": "Apr 2026",
      "priority": "critical|high|watch",
      "title": "Precise headline under 120 chars — what happened, who did it",
      "body": "2-3 sentences of factual detail with numbers, dates, company names.",
      "implication": "What this means for Sage WiSE strategy and what action it implies.",
      "source": "Source name and date"
    }
  ],
  "scan_summary": "1 sentence summary of market intensity for this market today"
}
Rules: Only genuinely new signals (past 48h). Return empty array if nothing new. Never fabricate. Max 3 signals. priority=critical means immediate PMM action required."""

def build_prompt(market_key):
    m = MARKET_PROMPTS[market_key]
    return f"""{SAGE_CONTEXT}

TASK: Search for new market signals in the past 24-48 hours for {m["label"]} ({m["market"]}).
Focus: {m["focus"]}
Search terms to use: {m["search_terms"]}

{JSON_SCHEMA.replace("MARKET_CODE", m["market"])}"""

# ── API CALLS ───────────────────────────────────────────────────────────────

def check_quota():
    """Quick lightweight call to verify API is available before heavy scans."""
    test_payload = {
        "contents": [{"parts": [{"text": "Reply with the single word: ready"}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 5}
    }
    data = json.dumps(test_payload).encode()
    req = urllib.request.Request(GEMINI_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print("Pre-flight check: ✅ API available")
            return True
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("Pre-flight check: ❌ Quota exhausted — skipping scan today")
            return False
        print(f"Pre-flight check: ⚠️ HTTP {e.code} — proceeding cautiously")
        return True
    except Exception as e:
        print(f"Pre-flight check: ⚠️ {e} — proceeding")
        return True

def call_gemini(prompt, retries=2):
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2000}
    }
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
                    return None, f"quota_exhausted"
            else:
                return None, f"HTTP {e.code}"
        except Exception as e:
            return None, str(e)
    return None, "max_retries"

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

# ── SIGNAL PROCESSING ───────────────────────────────────────────────────────

def scan_market(market_key):
    m = MARKET_PROMPTS[market_key]
    print(f"\n── Scanning {m['label']} ({market_key}) ──")
    prompt = build_prompt(market_key)
    response, error = call_gemini(prompt)

    if error == "quota_exhausted":
        print(f"  Quota exhausted — stopping after {market_key}")
        return [], "quota_exhausted", True  # signals, summary, stop_flag

    if error or not response:
        print(f"  Error: {error}")
        return [], error, False

    candidates = response.get("candidates", [])
    if not candidates:
        print(f"  No candidates returned")
        return [], "no_candidates", False

    text = "".join(part.get("text","") for part in candidates[0].get("content",{}).get("parts",[]))
    print(f"  Response: {len(text)} chars")

    parsed = extract_json(text)
    if not parsed:
        print(f"  Could not parse JSON from response")
        return [], "parse_error", False

    signals = parsed.get("signals", [])
    summary = parsed.get("scan_summary", "")
    print(f"  Found {len(signals)} new signals")
    for s in signals:
        print(f"    [{s.get('priority','').upper()}] {s.get('title','')[:70]}")
    return signals, summary, False

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

def merge_all(existing_data, all_new_signals, summaries):
    existing = existing_data.get("signals", [])
    existing_ids = {s["id"] for s in existing}
    month_label = datetime.date.today().strftime("%b %Y")
    added = 0

    for sig in all_new_signals:
        if not sig.get("id"):
            sig["id"] = make_id(sig.get("title", "signal"))
        if sig["id"] in existing_ids:
            continue
        if not sig.get("date"):
            sig["date"] = month_label
        existing.insert(0, sig)
        existing_ids.add(sig["id"])
        added += 1

    existing = existing[:MAX_TOTAL_SIGNALS]
    meta = existing_data.get("meta", {})
    meta["last_updated"] = datetime.date.today().isoformat()
    meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
    meta["last_scan_summary"] = " | ".join(f"{k}: {v}" for k,v in summaries.items() if v and v not in ("quota_exhausted","parse_error","no_candidates"))
    meta["signal_count"] = len(existing)
    print(f"\nMerged {added} new signals. Total: {len(existing)}")
    return {**existing_data, "meta": meta, "signals": existing}

# ── MAIN ────────────────────────────────────────────────────────────────────

def main():
    print(f"=== WiSE Signal Scanner v3 — {datetime.date.today()} ===")
    print(f"Model: {MODEL} | Markets: FR → ES → DE → PT")

    existing_data = load_existing()
    print(f"Existing signals: {len(existing_data.get('signals',[]))}")

    # Pre-flight quota check
    if not check_quota():
        meta = existing_data.get("meta", {})
        meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
        meta["last_scan_summary"] = "Quota exhausted — no scan today"
        existing_data["meta"] = meta
        save_signals(existing_data)
        return

    # Scan each market in priority order: FR → ES → DE → PT
    all_new_signals = []
    summaries = {}

    for market_key in ["FR", "ES", "DE", "PT"]:
        signals, summary, stop = scan_market(market_key)
        all_new_signals.extend(signals)
        summaries[market_key] = summary
        if stop:
            print(f"Quota hit after {market_key} — saving what we have")
            break
        # Brief pause between market calls to avoid rate limiting
        time.sleep(5)

    if not all_new_signals:
        print("No new signals found — updating scan timestamp")
        meta = existing_data.get("meta", {})
        meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
        meta["last_scan_summary"] = "No new signals found today"
        existing_data["meta"] = meta
        save_signals(existing_data)
        return

    updated = merge_all(existing_data, all_new_signals, summaries)
    save_signals(updated)
    print("=== Done ===")

if __name__ == "__main__":
    main()
