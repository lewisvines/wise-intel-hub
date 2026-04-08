"""
WiSE Intel Hub — Automated Signal Updater
Runs daily via GitHub Actions. Searches for fresh intelligence across
6 signal categories, then rewrites the signals section of dev.html.
"""

import anthropic
import datetime
import re
import os
import sys

# ── Configuration ─────────────────────────────────────────────────────────────

SIGNAL_CATEGORIES = [
    ("Competitive", ["Pennylane", "Cegid", "Holded", "Xero", "MyUnisoft", "Conciliator", "Lexoffice", "DATEV"]),
    ("Regulatory",  ["France PA mandate e-invoicing 2026", "Spain Verifactu 2027", "Germany XRechnung", "Portugal SAF-T"]),
    ("AI & Tech",   ["accounting AI copilot 2026", "Xero JAX AI", "Pennylane ComptAssistant"]),
    ("Hiring",      ["Pennylane hiring Spain 2026", "Cegid hiring France", "Holded engineering jobs"]),
    ("Pricing",     ["Holded pricing 2026", "Sage Active pricing Spain France"]),
    ("Brand",       ["Pennylane brand positioning accountants 2026"]),
]

HTML_FILE = "dev.html"
TODAY = datetime.date.today()
TODAY_STR = TODAY.strftime("%B %d, %Y")
DATE_SHORT = TODAY.strftime("%b %Y")

# ── Claude client ─────────────────────────────────────────────────────────────

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def search_and_summarise(category: str, topics: list[str]) -> list[dict]:
    """Ask Claude (with web search) for the latest signals in a category."""
    topics_str = ", ".join(topics)
    prompt = f"""You are a senior competitive intelligence analyst for Sage Group's European PMM team.
Search the web for the latest news (last 7 days) on these topics: {topics_str}.

Focus on: funding rounds, product launches, hiring announcements, regulatory updates, pricing changes, 
M&A activity, market positioning, and any news relevant to the French, Spanish, German or Portuguese 
SMB accounting software market.

Return ONLY a JSON array of signal objects. Each object must have:
- "category": "{category}"
- "tag": one of [Competitive, Regulatory, AI & Tech, Hiring, Pricing, Brand]
- "subtag": company or country name (e.g. "Pennylane", "France", "Germany")
- "date": short date like "Apr 2026"
- "title": bold headline under 20 words
- "body": 3-5 sentences of factual detail with source references
- "implication": 2-3 sentences on what this means for Sage's strategy
- "source": source name and date

Return 1-3 signals maximum. If there is genuinely no new news in the last 7 days for this category, 
return an empty array []. Do not fabricate signals. Only include verified, sourced information.

Return ONLY valid JSON. No markdown, no preamble."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        messages=[{"role": "user", "content": prompt}]
    )

    # Extract text content from response
    text = ""
    for block in response.content:
        if block.type == "text":
            text += block.text

    # Parse JSON
    try:
        # Strip any markdown fences if present
        text = re.sub(r"```json\s*|\s*```", "", text).strip()
        import json
        signals = json.loads(text)
        return signals if isinstance(signals, list) else []
    except Exception as e:
        print(f"  Warning: could not parse JSON for {category}: {e}", file=sys.stderr)
        return []


def signal_to_html(sig: dict, idx: int) -> str:
    """Convert a signal dict to HTML card markup."""
    cat = sig.get("tag", "Competitive").lower().replace(" & ", "-").replace(" ", "-")
    tag_class_map = {
        "competitive": "t-red",
        "regulatory": "t-teal",
        "ai-tech": "t-purple",
        "hiring": "t-orange",
        "pricing": "t-amber",
        "brand": "t-pink",
    }
    tag_class = tag_class_map.get(cat, "t-red")
    tag_label = sig.get("tag", "Competitive")
    subtag = sig.get("subtag", "")
    date = sig.get("date", DATE_SHORT)
    title = sig.get("title", "")
    body = sig.get("body", "")
    implication = sig.get("implication", "")
    source = sig.get("source", "")

    return f"""
    <div class="signal-card" data-c="{cat}">
      <div class="sc-top"><div class="sc-tags"><span class="tag {tag_class}">{tag_label}</span><span class="tag t-grey">{subtag}</span></div><span class="sc-date">{date}</span></div>
      <div class="sc-title"><strong>{title}</strong></div>
      <div class="sc-body">{body}</div>
      <div class="sc-implication"><div class="sc-impl-label">Strategic implication</div><div class="sc-impl-body">{implication}</div></div>
      <div class="sc-source">Source: {source}</div>
    </div>"""


def update_html(new_signals_html: str, signal_count: int):
    """Splice new signals and metadata into dev.html."""
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        html = f.read()

    # Update date
    html = re.sub(r"Updated: \w+ \d+, \d{4}", f"Updated: {TODAY_STR}", html)

    # Update signal count in stat cell
    html = re.sub(
        r'(<div class="stat-n">)\d+(</div><div class="stat-l">Signals this week)',
        rf'\g<1>{signal_count}\g<2>',
        html
    )

    # Update subtitle
    html = re.sub(
        r'(<div class="page-subtitle">)\d+ signals this week[^<]*(<\/div>)',
        rf'\g<1>{signal_count} signals this week · Signal intensity: CRITICAL · Auto-updated {TODAY_STR}\g<2>',
        html
    )

    # Replace the signal-list content (between opening div and first competitor section)
    # Find the signal-list div and replace its contents
    pattern = r'(<div class="signal-stack reveal" id="signal-list">)(.*?)(</div>\s*\n\s*</div>\s*\n<!-- ══════ COMPETITORS)'
    replacement = rf'\g<1>{new_signals_html}\n\n  </div>\n</div>\n<!-- ══════ COMPETITORS'
    html = re.sub(pattern, replacement, html, flags=re.DOTALL)

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"✓ Updated {HTML_FILE} with {signal_count} signals for {TODAY_STR}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"WiSE Signal Updater — {TODAY_STR}")
    print("=" * 50)

    all_signals_html = ""
    total = 0

    for category, topics in SIGNAL_CATEGORIES:
        print(f"  Searching: {category}...")
        signals = search_and_summarise(category, topics)
        print(f"  → {len(signals)} signal(s) found")
        for sig in signals:
            all_signals_html += signal_to_html(sig, total)
            total += 1

    if total == 0:
        print("No new signals found. Skipping HTML update.")
        return

    update_html(all_signals_html, total)
    print(f"\nDone. {total} signals written.")


if __name__ == "__main__":
    main()
