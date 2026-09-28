#!/usr/bin/env python3
"""
WiSE Daily Intelligence Digest
Runs on every signals.json commit. Picks new/critical signals from
the last 48 hours, formats a clean HTML email, sends via SendGrid.
"""

import json, os, datetime, urllib.request, re

GEMINI_KEY = os.environ["GEMINI_API_KEY"]
SENDGRID_KEY = os.environ["SENDGRID_API_KEY"]
TO_EMAIL = os.environ["DIGEST_TO_EMAIL"]
FROM_EMAIL = "wise-intel@lewisvines.github.io"
FROM_NAME = "WiSE Intel Hub"

TODAY = datetime.date.today()
TODAY_STR = TODAY.strftime("%-d %B %Y")
DAY_STR = TODAY.strftime("%A")

# ── Load signals ─────────────────────────────────────────────────────────────

with open("signals.json") as f:
    data = json.load(f)

meta = data.get("meta", {})
signals = data.get("signals", [])
active = [s for s in signals if not s.get("archived")]

# Pick signals from the last 48 hours that are new (critical or high)
def parse_iso(d):
    try: return datetime.date.fromisoformat(d)
    except: return None

cutoff = TODAY - datetime.timedelta(days=2)
new_signals = [
    s for s in active
    if parse_iso(s.get("accessed_at","") or s.get("published_at","") or "") and
       parse_iso(s.get("accessed_at","") or s.get("published_at","")) >= cutoff and
       s.get("priority") in ("critical","high")
]

# If nothing in 48h, take top 5 critical/high active signals
if not new_signals:
    new_signals = [s for s in active if s.get("priority") in ("critical","high")][:5]
    context = "no new signals in the past 48 hours — showing top active signals"
else:
    new_signals = new_signals[:8]
    context = f"{len(new_signals)} new signal(s) in the past 48 hours"

print(f"Signals to digest: {len(new_signals)} ({context})")

# ── Build editorial summary via Gemini ───────────────────────────────────────

signal_lines = "\n".join([
    f"[{s.get('market','EU')}] [{s.get('priority','').upper()}] [{s.get('category','')}] {s.get('title','')} | {s.get('implication','')[:120]}"
    for s in new_signals
])

SAGE_CONTEXT = """You are the WiSE Intel Hub, the automated intelligence system for Lewis Vines, 
Senior PMM at Sage Group leading the Winning in Small Europe Through Accountants programme.
Products: Sage for Accountants (SfA), Sage Active (PA-certified FR, Verifactu-certified ES), AutoEntry+AKAO, GoProposal, Sage Prevision.
Key competitors: Pennylane (FR primary threat, $4.25B), Cegid+Shine+Silae (FR/ES/PT/DE), Holded/Visma (ES), DATEV (DE partner).
Key deadlines: France PA mandate LIVE Sept 1 2026, Spain Verifactu Jan 2027, Germany XRechnung Jan 2028, Portugal SAF-T Jan 2027."""

prompt = f"""{SAGE_CONTEXT}

Write a 3-sentence "So what for Sage today" editorial summary based on these signals. 
Be direct, PMM-voice, name specific companies and deadlines. No fluff. No bullet points. 
End with the single most important action Lewis should take or escalate today.

Signals:
{signal_lines}

Return only the 3 sentences. No preamble."""

payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300}
}
req = urllib.request.Request(
    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={GEMINI_KEY}",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req, timeout=30) as r:
        resp = json.loads(r.read())
    summary = "".join(p.get("text","") for p in resp["candidates"][0]["content"]["parts"]).strip()
except Exception as e:
    summary = f"Signal scanner ran successfully. {len(new_signals)} signals flagged for review."

print(f"Summary: {summary[:100]}...")

# ── Build HTML email ──────────────────────────────────────────────────────────

PRIO_COLOR = {"critical": "#dc2626", "high": "#d97706", "watch": "#6b7280"}
CAT_EMOJI = {
    "Competitive": "🏁", "Regulatory": "⚖️", "AI & Tech": "🤖",
    "AI Agents": "🤖", "Embedded Finance": "🏦", "API/MCP Pricing": "💻",
    "Embedded Services": "📦", "M&A": "🔀", "Pricing": "💰",
    "Hiring": "👥", "Brand": "📢", "RSS-Fallback": "📰"
}
MARKET_FLAG = {"FR": "🇫🇷", "ES": "🇪🇸", "DE": "🇩🇪", "PT": "🇵🇹", "EU": "🇪🇺"}

def signal_row(s):
    prio = s.get("priority","watch")
    color = PRIO_COLOR.get(prio, "#6b7280")
    cat = s.get("category","")
    emoji = CAT_EMOJI.get(cat, "•")
    flag = MARKET_FLAG.get(s.get("market","EU"), "🌍")
    src_url = s.get("source_url","")
    src_link = f'<a href="{src_url}" style="color:#00b050;font-size:11px;text-decoration:none;">Source →</a>' if src_url else ""
    return f"""
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="font-size:18px;flex-shrink:0;">{emoji}</span>
          <div style="flex:1;">
            <div style="margin-bottom:4px;">
              <span style="background:{color};color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;letter-spacing:0.5px;text-transform:uppercase;">{prio}</span>
              <span style="color:#6b7280;font-size:11px;margin-left:8px;">{flag} {cat} · {s.get("published_at","") or s.get("date","")}</span>
            </div>
            <div style="font-size:14px;font-weight:600;color:#111;line-height:1.4;margin-bottom:6px;">{s.get("title","")}</div>
            <div style="font-size:12px;color:#444;line-height:1.6;margin-bottom:6px;">{s.get("body","")[:200]}{"…" if len(s.get("body",""))>200 else ""}</div>
            <div style="background:#f0faf4;border-left:3px solid #00b050;padding:8px 12px;font-size:12px;color:#166534;line-height:1.5;">
              <strong>WiSE implication:</strong> {s.get("implication","")[:200]}{"…" if len(s.get("implication",""))>200 else ""}
            </div>
            <div style="margin-top:6px;">{src_link}</div>
          </div>
        </div>
      </td>
    </tr>"""

signal_rows = "\n".join(signal_row(s) for s in new_signals)

scan_status = meta.get("scan_status", {})
markets_scanned = ", ".join(scan_status.get("markets_scanned", [])[:4]) or "FR, ES, DE, PT"
signals_added = scan_status.get("signals_added", 0)
scanner_ver = meta.get("scanner_version", "v5")

HTML = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:24px 32px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="color:#00b050;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">WiSE Intel Hub · {scanner_ver}</div>
                <div style="color:#fff;font-size:20px;font-weight:700;">Daily Intelligence Digest</div>
                <div style="color:#888;font-size:12px;margin-top:2px;">{DAY_STR}, {TODAY_STR}</div>
              </div>
              <div style="text-align:right;">
                <div style="color:#00b050;font-size:24px;font-weight:700;">{len(new_signals)}</div>
                <div style="color:#888;font-size:10px;">signals today</div>
              </div>
            </div>
          </td>
        </tr>
        <!-- Summary -->
        <tr>
          <td style="padding:24px 32px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">So what for Sage today</div>
            <div style="font-size:14px;color:#111;line-height:1.7;">{summary}</div>
          </td>
        </tr>
        <!-- Signals -->
        <tr>
          <td style="padding:0 32px;">
            <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:1px;text-transform:uppercase;padding:20px 0 4px;">Signal feed</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              {signal_rows}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <div style="font-size:11px;color:#9ca3af;line-height:1.6;">
              Scanner {scanner_ver} · Markets scanned: {markets_scanned} · {signals_added} new signal(s) this run<br>
              <a href="https://lewisvines.github.io/wise-intel-hub/" style="color:#00b050;text-decoration:none;">Open WiSE Intel Hub →</a>
              &nbsp;|&nbsp; Signals are AI-verified with source URLs and exact publication dates. Always confirm critical signals before escalating.
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

# ── Send via SendGrid ─────────────────────────────────────────────────────────

subject = f"WiSE Intel · {TODAY_STR} · {len(new_signals)} signal{'s' if len(new_signals)!=1 else ''} · {new_signals[0].get('market','EU') if new_signals else 'EU'}"

email_payload = {
    "personalizations": [{"to": [{"email": TO_EMAIL}]}],
    "from": {"email": FROM_EMAIL, "name": FROM_NAME},
    "subject": subject,
    "content": [{"type": "text/html", "value": HTML}]
}

req = urllib.request.Request(
    "https://api.sendgrid.com/v3/mail/send",
    data=json.dumps(email_payload).encode(),
    headers={
        "Authorization": f"Bearer {SENDGRID_KEY}",
        "Content-Type": "application/json"
    }, method="POST")

with urllib.request.urlopen(req, timeout=30) as r:
    status = r.getcode()
print(f"SendGrid response: {status} {'OK' if status == 202 else 'ERROR'}")
print(f"Email sent to: {TO_EMAIL}")
print(f"Subject: {subject}")
