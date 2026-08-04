# WiSE Intel Hub

Sage Europe PMM decision-intelligence platform for France, Spain, Germany and Portugal.

## Trust model

- `signals.json` is the automated discovery feed. New Critical and High signals require a direct HTTPS source, exact publication and access dates, and verified or corroborated evidence.
- Older records without that evidence contract are shown as legacy intelligence and excluded from the evidence-backed Today count.
- The WiSE Brain remains the source of truth for actions, owners, decision status and committed dates. The hub is a read-only decision-support view.
- No-change scans are valid. The pipeline status must be healthy before silence is interpreted as “nothing moved”.

## Publishing architecture

- Edit `src/index.html`; never hand-edit the encrypted root `index.html`.
- GitHub Pages reads the committed `signals.json`. Netlify endpoints are not required for the live hub or weekly brief.
- `Encrypt & Publish Hub` validates the source, encrypts it with Staticrypt and commits the generated root page.
- `WiSE Daily Signal Scanner` runs twice daily and validates the feed before committing it.

## Local validation

Run `npm run validate`. Legacy evidence debt is reported as a warning; broken navigation, duplicate IDs, count drift and malformed evidence-aware records fail the build.
