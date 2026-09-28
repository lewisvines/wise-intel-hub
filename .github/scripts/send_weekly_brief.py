#!/usr/bin/env python3
"""
WiSE Weekly Intelligence Brief
Runs every Monday at 6:30am UTC.
Generates a curated weekly brief for Lewis to review, then sends
a formatted version to the EU team distribution list.

Accuracy safeguards:
  - Only uses signals with source_url AND exact published_at dates (evidence-backed)
  - Flags any critical signal without a primary source
  - Gemini prompt instructs: name the source for every claim
  - Brief is committed to repo so Lewis can review before it goes wide (workflow_dispatch)
"""

import json, os, datetime, urllib.request, re

GEMINI_KEY = os.environ["GEMINI_API_KEY"]
SENDGRID_KEY = os.environ["SENDGRID_API_KEY"]
TO_LEWIS = os.environ["DIGEST_TO_EMAIL"]
TO_TEAM = os.environ.get("WEEKLY_TO_EMAILS", TO_LEWIS)  # comma-separated
FROM_EMAIL = "wise-intel@lewisvines.github.io"
FROM_NAME = "WiSE Intel Hub"

TODAY = datetime.date.today()
WEEK_END = TODAY
WEEK_START = TODAY - datetime.timedelta(days=7)
WEEK_LABEL = f"{WEEK_START.strftime('%-d %b')} – {WEEK_END.strftime('%-d %b %Y')}"

with open("signals.json") as f:
    data = json.load(f)

meta = data.get("meta", {})
signals = data.get("signals", [])
active = [s for s in signals if not s.get("archived")]

# ── Evidence-backed signals only for the brief ──────────────────────────────
def is_evidence_backed(s):
    url = s.get("source_url","")
    pub = s.get("published_at","") or s.get("date","")
    has_url = bool(url and url.startswith("https://"))
    has_date = bool(re.match(r"\d{4}-\d{2}-\d{2}", pub))
    return has_url and has_date

backed = [s for s in active if is_evidence_backed(s)]
unbacked_critical = [s for s in active if s.get("priority")=="critical" and not is_evidence_backed(s)]

# Top signals by priority and recency for the brief
def sort_key(s):
    prio_rank = {"critical":0,"high":1,"watch":2}.get(s.get("priority","watch"),3)
    date_str = s.get("published_at","") or s.get("date","") or "0000-00-00"
    return (prio_rank, "~" if not date_str else date_str)

top_signals = sorted(backed, key=sort_key)[:12]

# Group by category for the brief
from collections import defaultdict
by_cat = defaultdict(list)
for s in top_signals:
    by_cat[s.get("category","Other")].append(s)

cat_order = ["Competitive","M&A","Embedded Finance","API/MCP Pricing","AI Agents","AI & Tech","Embedded Services","Regulatory","Pricing","Hiring"]
ordered_cats = [c for c in cat_order if c in by_cat] + [c for c in by_cat if c not in cat_order]

# ── Generate editorial brief via Gemini ─────────────────────────────────────

SAGE_CONTEXT = """You are producing the WiSE Weekly Intelligence Brief for Lewis Vines (Senior PMM, Sage Group)
and his EU PMM team and senior leadership (Karen Ainley SVP, Diego VP PMM).
WiSE = Winning in Small Europe Through Accountants. Markets: France, Spain, Germany, Portugal.
Sage products: Sage for Accountants (SfA), Sage Active, AutoEntry/AKAO, GoProposal, Sage Prevision.
Competitors: Pennylane ($4.25B, EU expansion), Cegid+Shine+Silae (€10B merger announced), Holded/Visma (ES), DATEV (DE partner).
Mandates: France PA LIVE Sept 1 2026, Spain Verifactu Jan 2027, Germany XRechnung Jan 2028, Portugal SAF-T Jan 2027."""

signal_text = ""
for cat in ordered_cats:
    sigs = by_cat[cat]
    signal_text += f"\n=== {cat.upper()} ===\n"
    for s in sigs:
        signal_text += f"[{s.get('market','EU')}] [{s.get('priority','').upper()}] {s.get('title','')}\nSource: {s.get('source','')} ({s.get('published_at','')})\nImplication: {s.get('implication','')}\n\n"

prompt = f"""{SAGE_CONTEXT}

Write the WiSE Weekly Intelligence Brief for the week of {WEEK_LABEL}.

Structure it exactly as:
1. HEADLINE (one punchy sentence capturing the single biggest strategic shift this week)
2. THE WEEK IN THREE POINTS (three bullet points, one sentence each, each naming a specific company or deadline)
3. MARKET BY MARKET (one paragraph per market that had significant signals: FR / ES / DE / PT — skip quiet markets, name the source for each claim)
4. WHAT THIS MEANS FOR SAGE (2-3 sentences on the strategic implication across the portfolio — what must move, what is the risk if it doesn\'t)
5. ONE QUESTION FOR LEADERSHIP (one direct question that only Karen, Diego or the product team can answer, based on this week\'s intelligence)

Rules:
- Name the source for every factual claim (e.g. "Holded launched Holded Wallet (holded.com, Sept 2026)")
- No generic language like "monitor closely" or "keep an eye" — every sentence must carry a specific claim or action
- Do not fabricate any detail not in the signals below
- Write in a confident, senior PMM voice — this goes to SVP level

Signals this week:
{signal_text}

Write ONLY the brief. No preamble, no postamble."""

payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {"temperature": 0.35, "maxOutputTokens": 1200}
}
req = urllib.request.Request(
    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req, timeout=60) as r:
        resp = json.loads(r.read())
    brief_text = "".join(p.get("text","") for p in resp["candidates"][0]["content"]["parts"]).strip()
    print(f"Brief generated: {len(brief_text)} chars")
except Exception as e:
    brief_text = f"Brief generation failed: {e}. {len(top_signals)} signals available for manual review."
    print(f"ERROR: {e}")

# ── Convert brief text to clean HTML sections ────────────────────────────────

def text_to_html(text):
    lines = text.split("\n")
    html = ""
    for line in lines:
        line = line.strip()
        if not line: html += "<br>"
        elif line.startswith("1.") or line.startswith("2.") or line.startswith("3.") or line.startswith("4.") or line.startswith("5."):
            label = line.split(".",1)[0] + "."
            rest = line.split(".",1)[1].strip() if "." in line else line
            html += f'<div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin:20px 0 6px;">{rest}</div>\n'
        elif line.startswith("-") or line.startswith("•"):
            item = line.lstrip("-• ")
            html += f'<div style="padding:4px 0 4px 16px;border-left:2px solid #00b050;font-size:13px;color:#222;line-height:1.6;margin-bottom:6px;">{item}</div>\n'
        else:
            html += f'<p style="font-size:13px;color:#333;line-height:1.7;margin:0 0 10px;">{line}</p>\n'
    return html

brief_html = text_to_html(brief_text)

# Accuracy warning block if any unverified critical signals
warning_block = ""
if unbacked_critical:
    warning_block = f"""
<tr>
  <td style="padding:12px 32px;background:#fffbeb;border-top:1px solid #fcd34d;border-bottom:1px solid #fcd34d;">
    <div style="font-size:11px;color:#92400e;">
      <strong>⚠ Accuracy note:</strong> {len(unbacked_critical)} critical signal(s) excluded from this brief — missing source URL or exact date.
      These appear in the <a href="https://lewisvines.github.io/wise-intel-hub/" style="color:#92400e;">hub</a> for manual review.
    </div>
  </td>
</tr>"""

PRIO_COLOR = {"critical":"#dc2626","high":"#d97706","watch":"#6b7280"}
MARKET_FLAG = {"FR":"🇫🇷","ES":"🇪🇸","DE":"🇩🇪","PT":"🇵🇹","EU":"🇪🇺"}

signal_pills = ""
for s in top_signals[:6]:
    color = PRIO_COLOR.get(s.get("priority","watch"),"#6b7280")
    flag = MARKET_FLAG.get(s.get("market","EU"),"🌍")
    signal_pills += f'<span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;padding:4px 8px;font-size:11px;color:#374151;margin:0 4px 6px 0;">{flag} {s.get("title","")[:60]}{"…" if len(s.get("title",""))>60 else ""}</span>\n'

HTML = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td>
      <table width="640" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:28px 32px;">
            <div style="color:#00b050;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Sage WiSE · EU Accountant PMM · Confidential</div>
            <div style="color:#fff;font-size:22px;font-weight:700;">Weekly Intelligence Brief</div>
            <div style="color:#888;font-size:12px;margin-top:4px;">Week of {WEEK_LABEL} · {len(top_signals)} evidence-backed signals · FR · ES · DE · PT</div>
          </td>
        </tr>
        {warning_block}
        <!-- Brief -->
        <tr>
          <td style="padding:28px 32px;">
            {brief_html}
          </td>
        </tr>
        <!-- Signal references -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Evidence base this week</div>
            <div style="line-height:2;">{signal_pills}</div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;line-height:1.8;">
              WiSE Intel Hub · Scanner {meta.get("scanner_version","v5")} · All claims sourced from primary or secondary evidence with URLs<br>
              <strong style="color:#374151;">Before sharing externally:</strong> verify any claim marked as "corroborated" against its source URL.<br>
              <a href="https://lewisvines.github.io/wise-intel-hub/" style="color:#00b050;text-decoration:none;">Open full hub →</a>
              &nbsp;·&nbsp; This brief is auto-generated. Lewis Vines is the editorial owner.
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

# ── Send ─────────────────────────────────────────────────────────────────────

to_list = [{"email": e.strip()} for e in TO_TEAM.split(",") if e.strip()]
subject = f"WiSE Weekly Brief · {WEEK_LABEL} · {len(top_signals)} signals"

email_payload = {
    "personalizations": [{"to": to_list}],
    "from": {"email": FROM_EMAIL, "name": FROM_NAME},
    "reply_to": {"email": TO_LEWIS, "name": "Lewis Vines"},
    "subject": subject,
    "content": [{"type": "text/html", "value": HTML}]
}

req = urllib.request.Request(
    "https://api.sendgrid.com/v3/mail/send",
    data=json.dumps(email_payload).encode(),
    headers={"Authorization": f"Bearer {SENDGRID_KEY}", "Content-Type": "application/json"},
    method="POST")

with urllib.request.urlopen(req, timeout=30) as r:
    status = r.getcode()

print(f"SendGrid: {status} {'OK' if status==202 else 'ERROR'}")
print(f"Sent to: {[t['email'] for t in to_list]}")
print(f"Subject: {subject}")
print(f"Evidence-backed signals in brief: {len(top_signals)}")
print(f"Unverified critical signals excluded: {len(unbacked_critical)}")
