import copy
import datetime
import unittest
from unittest.mock import patch

import scan_signals as scanner


TODAY = datetime.date(2026, 8, 13)


def valid_signal():
    return {
        "category": "Competitive",
        "market": "EU",
        "entity": "Pennylane",
        "event_type": "Launch",
        "event_date": "2026-08-12",
        "date_basis": "published",
        "published_at": "2026-08-12",
        "priority": "high",
        "title": "Pennylane launches a new European accountant workflow",
        "body": "Pennylane launched an accountant workflow for European firms on 12 August 2026, adding automated review and approval steps for practice users.",
        "implication": "European practice buyers will expect comparable workflow automation, so Sage PMM should test the changed proof point in active competitor messaging.",
        "relevance_reason": "The product is offered to European accounting firms and changes the workflow benchmark in France, Spain and Germany.",
        "materiality_reason": "This is a newly available accountant workflow in multiple priority European markets, not a minor feature update.",
        "leading_indicator": "",
        "availability_status": "available",
        "affected_eu_markets": ["FR", "ES", "DE"],
        "eu_relevance": "direct",
        "source": "Pennylane product announcement",
        "source_url": "https://www.pennylane.com/news/european-accountant-workflow",
        "source_type": "primary",
        "corroborating_url": "",
    }


def source_result(url="https://www.pennylane.com/news/european-accountant-workflow"):
    return {
        "ok": True,
        "url": url,
        "status": 200,
        "content_type": "text/html",
        "text": "Pennylane launches a new European accountant workflow on 12 August 2026 for firms with automated review and approval steps. The product announcement describes the European launch, workflow design and availability for accounting practices.",
        "raw_text": "<time datetime='2026-08-12'>12 August 2026</time> Pennylane launches a new European accountant workflow for firms with automated review and approval steps.",
        "content_sha256": "a" * 64,
    }


class SignalQualityTests(unittest.TestCase):
    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_valid_primary_eu_signal_is_promoted(self, _inspect):
        signal = valid_signal()
        self.assertTrue(scanner.validate_signal(signal, [], "EU", TODAY))
        self.assertEqual(signal["quality_version"], 3)
        self.assertEqual(signal["evidence_status"], "verified")
        self.assertEqual(signal["accessed_at"], "2026-08-13")

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_uk_signal_without_read_across_is_rejected(self, _inspect):
        signal = valid_signal()
        signal.update({"market": "GB", "eu_relevance": "direct"})
        self.assertFalse(scanner.validate_signal(signal, [], "GB", TODAY))

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_uk_signal_with_specific_read_across_is_promoted(self, _inspect):
        signal = valid_signal()
        signal.update({"market": "GB", "eu_relevance": "read_across"})
        self.assertTrue(scanner.validate_signal(signal, [], "GB", TODAY))

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_stale_signal_is_rejected(self, _inspect):
        signal = valid_signal()
        signal["event_date"] = "2026-08-01"
        signal["published_at"] = "2026-08-01"
        self.assertFalse(scanner.validate_signal(signal, [], "EU", TODAY))

    @patch.object(scanner, "inspect_source", return_value={**source_result(), "text": "Pennylane launch in 2026", "raw_text": "Pennylane launch in 2026"})
    def test_exact_publication_date_must_appear_on_source(self, _inspect):
        self.assertFalse(scanner.validate_signal(valid_signal(), [], "EU", TODAY))

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_high_secondary_claim_needs_independent_corroboration(self, _inspect):
        signal = valid_signal()
        signal["source_type"] = "secondary"
        self.assertFalse(scanner.validate_signal(signal, [], "EU", TODAY))

    def test_high_secondary_claim_with_independent_corroboration_is_promoted(self):
        signal = valid_signal()
        signal.update({
            "source_type": "secondary",
            "source_url": "https://accountingnews.example/report/pennylane-workflow",
            "corroborating_url": "https://industrybody.example/updates/pennylane-workflow",
        })
        primary = source_result(signal["source_url"])
        corroborating = source_result(signal["corroborating_url"])
        with patch.object(scanner, "inspect_source", side_effect=[primary, corroborating]):
            self.assertTrue(scanner.validate_signal(signal, [], "EU", TODAY))
        self.assertEqual(signal["evidence_status"], "corroborated")

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_semantic_duplicate_is_rejected(self, _inspect):
        signal = valid_signal()
        self.assertFalse(scanner.validate_signal(
            signal, ["Pennylane launches new accountant workflow across Europe"], "EU", TODAY
        ))

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_unsupported_number_is_rejected(self, _inspect):
        signal = valid_signal()
        signal["body"] += " The release claims 500,000 firms are already using it."
        self.assertFalse(scanner.validate_signal(signal, [], "EU", TODAY))

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_hiring_signal_requires_scope_and_labelled_inference(self, _inspect):
        signal = valid_signal()
        signal.update({"category": "Hiring", "event_type": "Hiring", "availability_status": "", "leading_indicator": "Expansion is likely"})
        self.assertFalse(scanner.validate_signal(signal, [], "EU", TODAY))

    @patch.object(scanner, "inspect_source", return_value=source_result())
    def test_pricing_current_page_without_baseline_is_rejected(self, _inspect):
        signal = valid_signal()
        signal.update({
            "category": "Pricing", "event_type": "Pricing", "availability_status": "",
            "previous_state": "EUR 20 per month", "current_state": "EUR 24 per month",
            "price_change_percent": 20,
            "pricing_change_kind": "",
            "pricing_context": {"market": "FR", "currency": "EUR", "billing_period": "monthly", "tax_basis": "exclusive"},
        })
        self.assertFalse(scanner.validate_signal(signal, [], "EU", TODAY))

    def test_material_pricing_change_with_dated_baseline_is_promoted(self):
        signal = valid_signal()
        signal.update({
            "category": "Pricing",
            "event_type": "Pricing",
            "event_date": "2026-08-13",
            "date_basis": "observed_change",
            "published_at": "",
            "title": "Pennylane raises its French monthly entry price by 20 percent",
            "body": "Pennylane's French monthly entry price is now EUR 24, compared with EUR 20 on the dated historical pricing page.",
            "source_url": "https://www.pennylane.com/fr/pricing/current",
            "baseline_url": "https://www.pennylane.com/fr/pricing/2026-07-01",
            "baseline_date": "2026-07-01",
            "previous_state": "French monthly entry price was EUR 20",
            "current_state": "French monthly entry price is EUR 24",
            "price_change_percent": 20,
            "pricing_change_kind": "",
            "pricing_context": {"market": "FR", "currency": "EUR", "billing_period": "monthly", "tax_basis": "exclusive"},
            "availability_status": "",
        })
        baseline = {
            **source_result(signal["baseline_url"]),
            "text": "Pennylane French monthly entry price EUR 20 for accounting firms. The plan is billed monthly in France and the displayed price excludes tax. This dated page records the package and its included workflow.",
            "raw_text": "Pennylane French monthly entry price EUR 20 for accounting firms. The plan is billed monthly in France and the displayed price excludes tax. This dated page records the package and its included workflow.",
            "content_sha256": "b" * 64,
        }
        current = {
            **source_result(signal["source_url"]),
            "text": "Pennylane French monthly entry price EUR 24 for accounting firms. The plan is billed monthly in France and the displayed price excludes tax. This page describes the current package and its included workflow.",
            "raw_text": "Pennylane French monthly entry price EUR 24 for accounting firms. The plan is billed monthly in France and the displayed price excludes tax. This page describes the current package and its included workflow.",
            "content_sha256": "c" * 64,
        }
        with patch.object(scanner, "inspect_source", side_effect=[baseline, current]):
            self.assertTrue(scanner.validate_signal(signal, [], "EU", TODAY))
        self.assertNotIn("published_at", signal)
        self.assertEqual(signal["baseline_content_sha256"], "b" * 64)

    def test_grounding_redirect_is_not_a_direct_source(self):
        valid, _ = scanner.is_direct_source_url(
            "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc"
        )
        self.assertFalse(valid)

    def test_watch_index_is_allowed_only_for_monitoring_not_signal_evidence(self):
        self.assertFalse(scanner.is_direct_source_url("https://jobs.holded.com/")[0])
        self.assertTrue(scanner.is_direct_source_url("https://jobs.holded.com/", allow_index=True)[0])

    @patch.object(scanner, "inspect_source", return_value={**source_result(), "content_type": "application/pdf", "text": "", "raw_text": ""})
    def test_unparsed_pdf_is_not_decisive_evidence(self, _inspect):
        self.assertFalse(scanner.validate_signal(valid_signal(), [], "EU", TODAY))

    def test_verified_signal_supersedes_equivalent_legacy_lead(self):
        legacy = {
            "id": "legacy-pennylane-workflow",
            "title": "Pennylane launches new accountant workflow across Europe",
            "date": "2026-08-12",
        }
        signal = valid_signal()
        signal["id"] = "pennylane-launches-a-new-european-accountant-workflow"
        signal["quality_version"] = 3
        coverage = {lane: {"status": "complete", "filtered": 0} for lane in scanner.SCAN_LANES}
        result = scanner.merge_results({"meta": {}, "signals": [legacy]}, [signal], coverage)
        archived = next(item for item in result["signals"] if item["id"] == legacy["id"])
        self.assertTrue(archived["archived"])
        self.assertEqual(archived["superseded_by"], signal["id"])

    def test_portfolio_uses_balanced_lane_limits_instead_of_flat_storage_cap(self):
        coverage = {lane: {"status": "complete", "filtered": 0} for lane in scanner.SCAN_LANES}
        signals = []
        event_types = list(scanner.EVENT_TYPE_LIMITS)
        lane_counts = {"FR": 12, "ES": 8, "DE": 8, "PT": 8, "EU": 9, "GB": 6, "US": 5}
        for lane, count in lane_counts.items():
            for index in range(count):
                signals.append({
                    "id": f"{lane.lower()}-{index}",
                    "title": f"Verified {lane} signal {index}",
                    "quality_version": 3,
                    "event_date": "2026-08-13",
                    "date": "2026-08-13",
                    "priority": "high",
                    "market": lane,
                    "eu_relevance": "read_across" if lane in {"GB", "US"} else "direct",
                    "source_type": "primary",
                    "event_type": event_types[index % len(event_types)],
                    "entity": f"Competitor {lane} {index}",
                    "relevance_reason": "This verified move changes the competitive benchmark in a named European accounting market.",
                    "implication": "Track the move and test the relevant European positioning response with the country PMM lead.",
                })
        result = scanner.merge_results({"meta": {}, "signals": signals}, [], coverage)
        active = [item for item in result["signals"] if not item.get("archived")]
        self.assertLessEqual(len(active), 42)
        self.assertGreaterEqual(len(active), 35)
        self.assertEqual(sum(1 for item in active if scanner.portfolio_lane(item) == "FR"), 10)
        self.assertLessEqual(sum(1 for item in active if scanner.portfolio_lane(item) == "US"), 3)


if __name__ == "__main__":
    unittest.main()
