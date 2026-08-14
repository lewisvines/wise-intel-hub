#!/usr/bin/env python3
"""One-way quality migration: archive pre-v3 signals until they are reverified."""

import datetime
import json
from pathlib import Path


FEED = Path(__file__).resolve().parents[1] / "signals.json"
QUALITY_VERSION = 3


def main() -> None:
    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    data = json.loads(FEED.read_text(encoding="utf-8"))
    quarantined = 0
    for signal in data.get("signals", []):
        if signal.get("quality_version") == QUALITY_VERSION:
            continue
        signal["archived"] = True
        signal.setdefault("archived_at", today)
        signal.setdefault("archive_reason", "legacy_unverified")
        signal["evidence_status"] = "legacy_unverified"
        quarantined += 1
    active = [signal for signal in data.get("signals", []) if not signal.get("archived")]
    data.setdefault("meta", {})["signal_count"] = len(active)
    data["meta"]["archived_count"] = len(data.get("signals", [])) - len(active)
    data["meta"]["last_updated"] = today
    data["meta"]["last_scan_summary"] = (
        f"Quality migration: {quarantined} legacy records archived pending direct-source and exact-date re-verification."
    )
    data["meta"]["intensity"] = "BASELINE"
    data["meta"]["intensity_reason"] = (
        "No active record yet meets the v3 evidence contract; do not rank market intensity until the first successful v3 scan."
    )
    data["meta"]["ifyrne"] = (
        "The legacy feed is quarantined. Use the first successful v3 scan, its source links and exact dates as the next current readout."
    )
    data["meta"]["ifyrne_updated"] = today
    data["meta"]["scan_status"] = {
        "date": today,
        "status": "partial",
        "markets_scanned": [],
        "markets_skipped": ["FR", "ES", "DE", "PT", "EU", "GB", "US"],
        "signals_added": 0,
        "quality_filtered": quarantined,
        "quality_version": QUALITY_VERSION,
        "coverage": {
            lane: {
                "status": "pending",
                "error": "awaiting_first_v3_scan",
                "found": 0,
                "accepted": 0,
                "filtered": 0,
                "lenses_checked": [],
                "lenses_missing": ["hiring", "marketing", "launches", "pricing", "messaging", "expansion_investment"],
            }
            for lane in ["FR", "ES", "DE", "PT", "EU", "GB", "US"]
        },
    }
    data["meta"]["legacy_quarantine"] = {
        "date": today,
        "records": quarantined,
        "policy": "Pre-v3 records are excluded from active intelligence until a direct source and exact dates are reverified.",
    }
    FEED.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Archived {quarantined} pre-v3 records; {len(active)} verified records remain active.")


if __name__ == "__main__":
    main()
