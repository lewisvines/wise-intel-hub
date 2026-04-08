"""
WiSE Intel Hub — Automated Signal Updater
Runs twice daily (06:00 + 13:00 UTC) via GitHub Actions.
Searches 6 signal categories using Claude with web search,
rewrites the signals section of dev.html, updates date/count.
"""

import anthropic
import datetime
import re
import os
import sys
import json

# ── Configuration ─────────────────────────────────────────────────────────────

# All categories scanned on every run (twice daily).
# Hiring is included every run — not monthly — for same-day visibility.
SIGNAL_CATEGORIES = [
    {
        "label": "Competitive",
        "topics": ["Pennylane news 2026", "Cegid accounting news 2026",
                   "Holded Spain news 2026", "MyUnisoft France 2026",
                   "Conciliator accounting France 2026", "Lexoffice Germany 2026"],
    },
    {
        "label": "Regulatory",
        "topics": ["France PA e-invoicing mandate 2026", "Spain Verifactu 2026 2027",
                   "Germany XRechnung e-invoicing 2026", "Portugal SAF-T 2026 2027"],
    },
    {
        "label": "AI & Tech",
        "topics": ["accounting AI software 2026", "Xero JAX AI 2026",
                   "Pennylane ComptAssistant AI", "Sage Copilot AI 2026"],
    },
    {
        "label": "Hiring",
        "topics": ["Pennylane jobs hiring Spain Germany 2026",
                   "Cegid hiring France accountants 2026",
                   "Holded engineering jobs Spain 2026",
                   "Xero hiring Europe 2026"],
    },
    {
        "label": "Pricing",
        "topics": ["Holded pricing 2026", "Sage Active pricing Spain France 2026",
                   "Pennylane pricing accountants 2026"],
    },
    {
        "label": "Brand",
        "topics": ["Pennylane brand marketing accountants 2026",
                   "Cegid brand positioning SMB Europe 2026"],
    },
]

HTML_FILE = "dev.html"
TODAY     = datetime.datetime.utcnow()
TODAY_STR = TODAY.strftime("%B %d, %Y")
DATE_SHORT = TODAY.strftime("%b %Y")
RUN_TIME  = TODAY.strftime("%H:%M UTC")

# ── Claude client ─────────────────────────────────────────────────────────────

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

TAG_CLASS = {
    "Competitive": "t-red",
    "Regulatory":  "t-teal",
    "AI & Tech":   "t-purple",
    "Hiring":      "t-orange",
    "Pricing":     "t-amber",
    "Brand":       "t-pink",
}

def search_signals(category_label: str, topics: list[str]) -> list[dict]:
    """Use Claude with web search to find fresh signals for a category."""
    topics_str = ", ".join(topics)
    prompt = f"""You are a senior competitive intelligence analyst for Sage Group's European PMM team,
covering the accountant software market in France, Spain, Germany and Portugal.

Search the web for news published in the LAST 7 DAYS on these topics: {topics_str}

Focus on: funding rounds, product launches, regulatory updates, hiring announcements, pricing changes,
M&A activity, AI features, market positioning — anything relevant to the European SMB accounting market.

Return ONLY a JSON array. Each element must be an object with these exact keys:
  "tag":         one of [Competitive, Regulatory, AI & Tech, Hiring, Pricing, Brand]
  "subtag":      company or country (e.g. "Pennylane", "France", "Germany")
  "date":        short date string like "Apr 2026"
  "title":       bold headline, max 20 words, no trailing period
  "body":        3-5 sentences of factual detail with source references inline
  "implication": 2-3 sentences on what this means for Sage's European accountant strategy
  "source":      "Source Name, Month Year"

Rules:
- Return 0 to 3 signals maximum
- If there is NO genuinely new news in the last 7 days for these topics, return []
- NEVER fabricate signals — only include verified, sourced information
- Do not duplicate signals that are older than 7 days

Return ONLY valid JSON. No markdown fences, no explanation, no preamble."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": prompt}]
        )

        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text += block.text

        text = re.sub(r"```json\s*|\s*```", "", text).strip()
        if not text or text == "[]":
            return []
        signals = json.loads(text)
        return signals if isinstance(signals, list) else []

    except Exception as e:
        print(f"  Warning [{category_label}]: {e}", file=sys.stderr)
        return []


def signal_to_html(sig: dict) -> str:
    tag     = sig.get("tag", "Competitive")
    subtag  = sig.get("subtag", "")
    date    = sig.get("date", DATE_SHORT)
    title   = sig.get("title", "")
    body    = sig.get("body", "")
    impl    = sig.get("implication", "")
    source  = sig.get("source", "")
    tc      = TAG_CLASS.get(tag, "t-red")
    dc      = tag.lower().replace(" & ", "-").replace(" ", "-")

    return f"""
    <div class="signal-card" data-c="{dc}">
      <div class="sc-top"><div class="sc-tags"><span class="tag {tc}">{tag}</span><span class="tag t-grey">{subtag}</span></div><span class="sc-date">{date}</span></div>
      <div class="sc-title"><strong>{title}</strong></div>
      <div class="sc-body">{body}</div>
      <div class="sc-implication"><div class="sc-impl-label">Strategic implication</div><div class="sc-impl-body">{impl}</div></div>
      <div class="sc-source">Source: {source}</div>
    </div>"""


def update_html(new_signals_html: str, total: int):
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        html = f.read()

    # Date
    html = re.sub(
        r"Updated: [A-Za-z]+ \d{1,2}, \d{4}",
        f"Updated: {TODAY_STR}",
        html
    )

    # Stat cell count
    html = re.sub(
        r'(<div class="stat-n">)\d+(</div><div class="stat-l">Signals this week)',
        rf'\g<1>{total}\g<2>',
        html
    )

    # Page subtitle
    html = re.sub(
        r'(<div class="page-subtitle">)\d+ signals this week[^<]*(</div>)',
        rf'\g<1>{total} signals · Last updated {TODAY_STR} {RUN_TIME}\g<2>',
        html
    )

    # Replace signal list content
    pattern = r'(<div class="signal-stack reveal" id="signal-list">)(.*?)(</div>\s*\n\s*</div>\s*\n<!-- ══════ COMPETITORS)'
    replacement = rf'\g<1>{new_signals_html}\n\n  </div>\n</div>\n<!-- ══════ COMPETITORS'
    html, n = re.subn(pattern, replacement, html, flags=re.DOTALL)
    if n == 0:
        print("  Warning: signal-list pattern not matched — HTML structure may have changed", file=sys.stderr)

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✓ {HTML_FILE} updated — {total} signals, {TODAY_STR} {RUN_TIME}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"WiSE Signal Updater — {TODAY_STR} {RUN_TIME}")
    print("=" * 52)

    all_html = ""
    total    = 0

    for cat in SIGNAL_CATEGORIES:
        label  = cat["label"]
        topics = cat["topics"]
        print(f"  Scanning: {label}...")
        sigs = search_signals(label, topics)
        print(f"  → {len(sigs)} new signal(s)")
        for s in sigs:
            all_html += signal_to_html(s)
            total += 1

    if total == 0:
        print("\nNo new signals found. dev.html not modified.")
        return

    update_html(all_html, total)
    print(f"\nComplete. {total} signals written.")


if __name__ == "__main__":
    main()
