#!/usr/bin/env python3
"""
WiSE Intel Hub — Daily Signal Scanner (Gemini Edition)
Runs at 8am UTC via GitHub Actions. Free tier. No cost.
Uses Gemini 2.0 Flash with Google Search grounding to find
real, current market signals across FR/ES/DE/PT markets.
"""

import os, json, re, datetime, hashlib, urllib.request, urllib.error

SIGNALS_FILE = "signals.json"
MAX_NEW_SIGNALS = 8
MAX_TOTAL_SIGNALS = 40
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}"

SCAN_PROMPT = """You are the Market Intelligence agent for the WiSE Intel Hub — Sage Group's competitive intelligence platform for the European accountant software market.

Your task: use Google Search to find the most strategically significant market signals from the past 24-48 hours relevant to Sage's Winning in Small Europe Through Accountants (WiSE) programme across France, Spain, Germany and Portugal.

CONTEXT — what matters to Sage:
- Sage competes for accounting practices (expert-comptables FR, asesorias ES, Steuerberater DE, contabilistas PT)
- Primary competitors: Pennylane, Cegid, Holded/Visma, DATEV, Dext, Xero, QuickBooks, MyUnisoft, Conciliator, Regate/Qonto, Contasol
- Products: Sage for Accountants (SfA), Sage Active (cloud SMB), AutoEntry/AKAO (PA-certified), GoProposal, Sage Prevision
- Critical deadlines: France PA e-invoicing mandate Sept 1 2026, Spain Verifactu Jan 2027, Germany XRechnung Jan 2028, Portugal SAF-T Jan 2027
- Key risks: Pennylane expanding to Spain H2 2026, Cegid 100 new reps targeting GE practices Q2 2026

SEARCH FOR signals in these categories:
1. Competitive: funding, product launches, pricing changes, new hires, partnerships by Pennylane, Cegid, Holded, Dext, MyUnisoft, Xero
2. Regulatory: e-invoicing mandate updates FR/ES/DE/PT, DGFiP, AEAT, KoSIT announcements
3. AI & Tech: AI features launched by any accounting software competitor, agentic AI, Copilot features
4. Pricing: competitor pricing changes, new bundles in EU accounting software
5. Hiring: significant hiring at competitors indicating market entry or acceleration
6. Brand: major competitor positioning moves, analyst reports, press coverage

Search for recent news on: Pennylane accountant France Spain 2026, Cegid EBP accountant, Holded Verifactu Spain, e-invoicing France September 2026, Sage Active accountant Europe, accounting software EU competitive

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "signals": [
    {
      "id": "unique-slug-max-40-chars",
      "category": "Competitive",
      "market": "FR",
      "date": "Apr 2026",
      "priority": "critical",
      "title": "Precise headline under 120 chars",
      "body": "2-3 sentences of factual detail with numbers and dates.",
      "implication": "What this means specifically for Sage WiSE strategy and what action it implies.",
      "source": "Source name and date"
    }
  ],
  "scan_summary": "1 sentence summary of overall market intensity today"
}

Rules:
- Only include signals that are genuinely new (past 48 hours) or significantly updated
- If nothing significant found, return fewer signals or empty array — never fabricate
- priority=critical: requires immediate PMM or commercial response
- priority=high: important for weekly planning  
- priority=watch: track but no immediate action
- All implications must reference Sage WiSE strategy specifically
- Maximum 8 signals
- Return ONLY the JSON object, nothing else
"""

def call_gemini(prompt):
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 4000,
        }
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(GEMINI_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

def extract_json(text):
    # Try direct parse first
    text = text.strip()
    if text.startswith("{"):
        try:
            return json.loads(text)
        except:
            pass
    # Find JSON block
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass
    return None

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

def scan_for_signals():
    today = datetime.date.today().strftime("%B %d, %Y")
    prompt = SCAN_PROMPT + f"\n\nToday\'s date: {today}"
    print(f"Scanning with Gemini 2.0 Flash + Google Search — {today}")

    try:
        response = call_gemini(prompt)
        # Extract text from response
        candidates = response.get("candidates", [])
        if not candidates:
            print("No candidates in response")
            return [], "No response from Gemini"

        text = ""
        for part in candidates[0].get("content", {}).get("parts", []):
            if "text" in part:
                text += part["text"]

        print(f"Response length: {len(text)} chars")

        parsed = extract_json(text)
        if not parsed:
            print(f"Could not parse JSON. Response preview: {text[:500]}")
            return [], "Parse error"

        signals = parsed.get("signals", [])
        summary = parsed.get("scan_summary", "")
        print(f"Found {len(signals)} new signals")
        return signals, summary

    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Gemini API error {e.code}: {body[:400]}")
        return [], f"API error {e.code}"
    except Exception as e:
        print(f"Unexpected error: {e}")
        return [], str(e)

def merge_signals(existing_data, new_signals, scan_summary):
    existing_signals = existing_data.get("signals", [])
    existing_ids = {s["id"] for s in existing_signals}
    month_label = datetime.date.today().strftime("%b %Y")
    added = 0

    for sig in new_signals:
        if not sig.get("id"):
            sig["id"] = make_id(sig.get("title", "signal"))
        if sig["id"] in existing_ids:
            print(f"  Skip duplicate: {sig['id']}")
            continue
        if not sig.get("date"):
            sig["date"] = month_label
        existing_signals.insert(0, sig)
        existing_ids.add(sig["id"])
        added += 1
        print(f"  + {sig['id']}")

    existing_signals = existing_signals[:MAX_TOTAL_SIGNALS]

    meta = existing_data.get("meta", {})
    meta["last_updated"] = datetime.date.today().isoformat()
    meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
    meta["last_scan_summary"] = scan_summary
    meta["signal_count"] = len(existing_signals)

    print(f"Total signals: {len(existing_signals)} (added {added})")
    return {**existing_data, "meta": meta, "signals": existing_signals}

def main():
    print("=== WiSE Signal Scanner (Gemini) ===")
    existing_data = load_existing()
    print(f"Existing signals: {len(existing_data.get('signals', []))}")

    new_signals, scan_summary = scan_for_signals()

    if not new_signals:
        print("No new signals — updating scan timestamp only")
        meta = existing_data.get("meta", {})
        meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
        meta["last_scan_summary"] = scan_summary or "No significant signals found today"
        existing_data["meta"] = meta
        save_signals(existing_data)
        return

    updated = merge_signals(existing_data, new_signals, scan_summary)
    save_signals(updated)
    print("=== Done ===")

if __name__ == "__main__":
    main()
