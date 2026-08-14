# WiSE Intel Hub

Sage Europe PMM decision-intelligence platform. France, Spain, Germany and Portugal
remain the core WiSE markets; a wider EU lane scans cross-border and adjacent-country
movement, while UK and US lanes import only signals with a specific European read-across.

## Trust model

- `signals.json` is the automatically published evidence feed. Every new signal requires
  a reachable, durable evidence page, an exact publication or first-observed date,
  an exact access date, claim-to-page matching, a source-content hash, a specific
  European implication and duplicate screening. Publication, effective, observed and
  access dates remain separate; an undated page never receives an invented publication date.
- Critical and High secondary claims require a second independent source. Search results,
  homepages, snippets, RSS links and transient AI grounding redirects are rejected.
- UK and US signals are excluded unless they name the European markets affected and explain
  a credible read-across. Broad global AI news without accounting, finance, SMB or
  professional-services relevance is noise and is not published.
- Pricing and messaging changes require evidenced before and after states plus a dated
  historical baseline. A current pricing page alone is not proof that a change occurred.
- Hiring is published only for leadership or meaningful clusters by role, location and
  capability. Marketing is published only for a strategic campaign or major-event message.
  Routine vacancies, webinars, social posts and cosmetic site edits are excluded.
- Older records without that evidence contract are quarantined as archived legacy
  intelligence and excluded from active counts until reverified.
- The WiSE Brain remains the source of truth for actions, owners, decision status and committed dates. The hub is a read-only decision-support view.
- No-change scans are valid. The pipeline status must be healthy before silence is interpreted as “nothing moved”.

## Publishing architecture

- Edit `src/index.html`; never hand-edit generated `src_index.html` or the root front door.
- GitHub Pages reads the committed `signals.json`. Netlify endpoints are not required for the live hub or weekly brief.
- The WiSE PMM Hub front door controls stakeholder access to the site.
- `Publish Hub Source` validates `src/index.html`, copies it to the live
  `src_index.html` page used by the front door, and commits only that generated file.
- `WiSE Daily Signal Scanner` runs at 07:00 and 17:00 UTC every day. It treats model output
  as untrusted candidates, verifies the evidence deterministically, validates the feed and
  then commits accepted signals and transparent scan-health metadata to `main`.
- Every lane checks six lenses: hiring, marketing, launches, pricing, messaging, and
  expansion/investment. A missing lens makes coverage partial even when another signal passes.
- Fourteen priority official pages are fingerprinted twice daily across Pennylane, Cegid,
  Qonto, Holded, sevdesk and Lexware Office: pricing, careers, newsrooms and major events.
  A page change becomes a research lead, not a published claim; the scanner must still prove
  the substantive change, exact dates, European relevance and historical baseline.
- The active feed is capped at 42 verified records, not targeted at 42. The cap represents
  six slots per seven coverage lanes on average, with 35 slots reserved for direct EU evidence
  and seven for UK/US read-across. Lane, event-type and four-per-competitor caps stop one news
  cycle from crowding out the rest of the radar. Watch items age out after 21 days, High after
  45 and Critical after 60; archived history is retained separately.
- If evidence checks or validation fail, publication fails closed. If a scan finds no
  material move, it publishes only truthful scan health; it does not manufacture a signal.

## Local validation

Run `npm run validate` and `python .github/scripts/test_scan_signals.py`.
Legacy evidence debt is reported as a warning; broken navigation, duplicate IDs, count
drift, malformed evidence records, missing coverage lanes and quality-contract breaches
fail the build.
