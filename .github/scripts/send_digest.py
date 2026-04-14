#!/usr/bin/env python3
"""
WiSE Intel Hub — Weekly Email Digest
Runs Mondays after the main scan. Sends formatted digest to NOTIFY_EMAIL.
Uses Python smtplib with a free Gmail SMTP relay via GitHub Actions.
If NOTIFY_EMAIL not set, skips silently.
"""

import os, json, datetime, smtplib, urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SIGNALS_FILE = "signals.json"
NOTIFY_EMAIL = os.environ.get("NOTIFY_EMAIL", "")
IS_MONDAY = datetime.date.today().weekday() == 0

def load_signals():
    if not os.path.exists(SIGNALS_FILE):
        return {}
    with open(SIGNALS_FILE) as f:
        return json.load(f)

def format_digest(data):
    meta = data.get("meta", {})
    signals = data.get("signals", [])
    today = datetime.date.today().strftime("%A %d %B %Y")

    status = meta.get("scan_status", {})
    markets_scanned = ", ".join(status.get("markets_scanned", []))
    signals_added = status.get("signals_added", 0)
    ifyrne = meta.get("ifyrne", "No summary available.")

    criticals = [s for s in signals if s.get("priority") == "critical" and not s.get("archived")][:5]
    highs = [s for s in signals if s.get("priority") == "high" and not s.get("archived")][:3]

    # Mandate countdowns
    from datetime import date
    fr_days = (date(2026, 9, 1) - date.today()).days
    es_days = (date(2027, 1, 1) - date.today()).days
    de_days = (date(2028, 1, 1) - date.today()).days
    pt_days = (date(2028, 1, 1) - date.today()).days

    def signal_block(sigs):
        lines = []
        for s in sigs:
            lines.append(f"[{s.get('market','EU')} · {s.get('category','')}] {s.get('title','')}")
            lines.append(f"{s.get('implication','')}")
            lines.append(f"Source: {s.get('source','')}")
            lines.append("")
        return "\n".join(lines)

    text = f"""WiSE INTEL HUB — WEEKLY DIGEST
{today}
lewisvines.github.io/wise-intel-hub/dev.html
{"=" * 50}

IF YOU READ NOTHING ELSE
{ifyrne}

{"=" * 50}
MANDATE COUNTDOWN
🇫🇷 France PA Mandate (Sept 1 2026): {fr_days} days
🇪🇸 Spain Verifactu (Jan 1 2027): {es_days} days
🇩🇪 Germany XRechnung (Jan 1 2028): {de_days} days
🇵🇹 Portugal SAF-T (Jan 1 2028): {pt_days} days

{"=" * 50}
THIS WEEK\'S SCAN
Markets scanned: {markets_scanned or "none"}
New signals added: {signals_added}
Active signals: {meta.get("signal_count", 0)}

{"=" * 50}
CRITICAL SIGNALS
{signal_block(criticals) if criticals else "No critical signals this week."}
{"=" * 50}
HIGH PRIORITY SIGNALS
{signal_block(highs) if highs else "No high priority signals this week."}
{"=" * 50}
WiSE Intel Hub: lewisvines.github.io/wise-intel-hub/dev.html
Internal only — Sage Group PMM
"""
    return text

def send_email(body):
    if not NOTIFY_EMAIL:
        print("NOTIFY_EMAIL not set — skipping email")
        return

    # Use SendGrid free tier API (100 emails/day free, no SMTP credentials needed)
    SENDGRID_KEY = os.environ.get("SENDGRID_API_KEY", "")
    if not SENDGRID_KEY:
        print("SENDGRID_API_KEY not set — skipping email (add secret to enable)")
        return

    today = datetime.date.today().strftime("%d %B %Y")
    payload = json.dumps({
        "personalizations": [{"to": [{"email": NOTIFY_EMAIL}]}],
        "from": {"email": "wise-bot@lewisvines.github.io", "name": "WiSE Intel Hub"},
        "subject": f"WiSE Weekly Intel Digest — {today}",
        "content": [{"type": "text/plain", "value": body}]
    }).encode()

    req = urllib.request.Request(
        "https://api.sendgrid.com/v3/mail/send",
        data=payload,
        headers={"Authorization": f"Bearer {SENDGRID_KEY}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"✅ Digest sent to {NOTIFY_EMAIL} — HTTP {r.status}")
    except urllib.error.HTTPError as e:
        print(f"Email error {e.code}: {e.read().decode()[:200]}")

def main():
    if not IS_MONDAY:
        print("Not Monday — digest skipped")
        return

    print(f"=== WiSE Weekly Digest — {datetime.date.today()} ===")
    data = load_signals()
    body = format_digest(data)
    print(body[:500])
    send_email(body)

if __name__ == "__main__":
    main()
