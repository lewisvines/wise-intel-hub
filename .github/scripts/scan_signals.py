#!/usr/bin/env python3
"""
WiSE Intel Hub — Daily Signal Scanner
Runs at 8am UTC via GitHub Actions.
Uses Claude to scan for new competitive, regulatory, AI and pricing signals
across FR, ES, DE, PT markets. Merges new signals into signals.json,
preserving existing ones. Deduplicates by id.
"""

import os, json, re, datetime, hashlib, anthropic

SIGNALS_FILE = "signals.json"
MAX_NEW_SIGNALS = 8   # Cap per daily run to keep quality high
MAX_TOTAL_SIGNALS = 40  # Rolling window — oldest signals drop off

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SCAN_PROMPT = """You are the Market Intelligence agent for the WiSE Intel Hub — Sage Group's competitive intelligence platform for the European accountant software market.

Your task: scan for the most strategically significant market signals from the past 24 hours relevant to Sage's Winning in Small Europe Through Accountants (WiSE) programme across France, Spain, Germany and Portugal.

CONTEXT — what matters to Sage:
- Sage competes for accounting practices (firms of expert-comptables in FR, asesorías in ES, Steuerberater in DE, contabilistas in PT)
- Primary competitors: Pennylane (FR + expanding EU), Cegid (FR/ES/PT/DE), Holded/Visma (ES), DATEV (DE strategic partner), Dext/AutoEntry rivals, Xero, QuickBooks
- Products: Sage for Accountants (SfA), Sage Active (cloud SMB), AutoEntry/AKAO (PA-certified document capture), GoProposal, Sage Prévision (forecasting)
- Critical deadlines: France PA e-invoicing mandate Sept 1 2026, Spain Verifactu Jan 2027, Germany XRechnung Jan 2028, Portugal SAF-T Jan 2027
- Strategic risks: Pennylane expanding to Spain H2 2026, Cegid 100 new sales reps targeting GE practices from Q2 2026, GE-Active sync still unresolved

SEARCH FOR signals in these categories:
1. Competitive: funding rounds, product launches, pricing changes, hiring surges, partnership announcements by Pennylane, Cegid, Holded, Dext, MyUnisoft, Conciliator, Xero, Regate/Qonto
2. Regulatory: e-invoicing mandate updates in FR/ES/DE/PT, DGFiP announcements, AEAT updates, KoSIT/XRechnung changes, OCC Portugal news
3. AI & Tech: AI features launched by any accounting software competitor, agentic AI in accounting, Copilot-class features, document AI
4. Pricing: competitor pricing changes, new tier structures, bundle announcements in EU accounting software
5. Hiring: significant hiring signals (country managers, compliance engineers, sales teams) at competitors that indicate market entry or acceleration
6. Brand: major competitor brand/messaging moves, analyst reports, press coverage that shifts perception

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:
{
  "signals": [
    {
      "id": "unique-slug-max-40-chars",
      "category": "Competitive|Regulatory|AI & Tech|Pricing|Hiring|Brand",
      "market": "FR|ES|DE|PT|EU",
      "date": "Apr 2026",
      "priority": "critical|high|watch",
      "title": "Precise headline under 120 chars — what happened, who did it",
      "body": "2-3 sentences of factual detail. Include numbers, dates, company names. No fluff.",
      "implication": "1-2 sentences on what this means specifically for Sage's WiSE strategy and what action it implies.",
      "source": "Source name and date"
    }
  ],
  "scan_summary": "1 sentence summary of overall market intensity today"
}

Rules:
- Only include signals that are genuinely NEW (past 24-48 hours) or significantly updated
- If nothing significant happened today, return fewer signals or an empty array — do not fabricate
- priority=critical: requires immediate PMM or commercial response
- priority=high: important for weekly planning
- priority=watch: track but no immediate action
- All implication text must reference Sage's WiSE strategy specifically, not generic advice
- Never include internal Sage data or speculation presented as fact
- Maximum {max_signals} signals

Today's date: {today}
"""

def load_existing():
    if not os.path.exists(SIGNALS_FILE):
        return {}
    with open(SIGNALS_FILE) as f:
        return json.load(f)

def save_signals(data):
    with open(SIGNALS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def make_id(title):
    """Generate stable ID from title"""
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower())[:40].strip('-')
    return slug

def scan_for_signals():
    today = datetime.date.today().strftime("%B %d, %Y")
    prompt = SCAN_PROMPT.format(today=today, max_signals=MAX_NEW_SIGNALS)

    print(f"Scanning for signals — {today}")

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4000,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )

    # Extract text content from response (may include tool use blocks)
    text_parts = [b.text for b in response.content if hasattr(b, 'text') and b.text]
    raw = " ".join(text_parts).strip()

    # If response contains tool results, run again to get final synthesis
    has_tool_use = any(b.type == "tool_use" for b in response.content)
    if has_tool_use:
        print("Web search used — getting synthesis...")
        # Build follow-up with tool results
        messages = [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response.content}
        ]
        # Add tool results
        tool_results = []
        for b in response.content:
            if b.type == "tool_use":
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": b.id,
                    "content": "Search completed."
                })
        if tool_results:
            messages.append({"role": "user", "content": tool_results})

        final = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=4000,
            messages=messages
        )
        raw = " ".join(b.text for b in final.content if hasattr(b, 'text') and b.text).strip()

    # Parse JSON from response
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        print("No JSON found in response. Raw output:")
        print(raw[:500])
        return [], "No signals found today"

    try:
        parsed = json.loads(json_match.group())
        new_signals = parsed.get("signals", [])
        summary = parsed.get("scan_summary", "")
        print(f"Found {len(new_signals)} new signals")
        return new_signals, summary
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print("Raw:", raw[:300])
        return [], "Parse error"

def merge_signals(existing_data, new_signals, scan_summary):
    """Merge new signals into existing, deduplicate, maintain rolling window"""
    existing_signals = existing_data.get("signals", [])
    existing_ids = {s["id"] for s in existing_signals}

    # Add month/year to new signals if missing
    month_label = datetime.date.today().strftime("%b %Y")
    added = 0
    for sig in new_signals:
        if not sig.get("id"):
            sig["id"] = make_id(sig.get("title", "signal"))
        # Deduplicate
        if sig["id"] in existing_ids:
            print(f"  Skipping duplicate: {sig['id']}")
            continue
        if not sig.get("date"):
            sig["date"] = month_label
        existing_signals.insert(0, sig)  # newest first
        existing_ids.add(sig["id"])
        added += 1
        print(f"  + Added: {sig['id']}")

    # Rolling window — keep most recent MAX_TOTAL_SIGNALS
    existing_signals = existing_signals[:MAX_TOTAL_SIGNALS]

    # Update meta
    meta = existing_data.get("meta", {})
    meta["last_updated"] = datetime.date.today().isoformat()
    meta["signal_count"] = len([s for s in existing_signals if True])  # all signals
    meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
    meta["last_scan_summary"] = scan_summary

    print(f"Total signals after merge: {len(existing_signals)} (added {added})")

    return {**existing_data, "meta": meta, "signals": existing_signals}

def main():
    print("=== WiSE Signal Scanner ===")
    existing_data = load_existing()
    print(f"Existing signals: {len(existing_data.get('signals', []))}")

    new_signals, scan_summary = scan_for_signals()

    if not new_signals:
        print("No new signals today — signals.json unchanged")
        # Still update last_scan timestamp
        meta = existing_data.get("meta", {})
        meta["last_scan"] = datetime.datetime.utcnow().isoformat() + "Z"
        meta["last_scan_summary"] = scan_summary or "No significant signals found today"
        existing_data["meta"] = meta
        save_signals(existing_data)
        return

    updated_data = merge_signals(existing_data, new_signals, scan_summary)
    save_signals(updated_data)
    print(f"signals.json updated — {len(updated_data['signals'])} signals total")
    print("=== Done ===")

if __name__ == "__main__":
    main()
