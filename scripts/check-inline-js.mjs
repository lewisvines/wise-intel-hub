import { readFileSync } from 'node:fs';

const source = readFileSync('src/index.html', 'utf8');
const blocks = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
let checked = 0;

for (const [, attributes, code] of blocks) {
  if (/\bsrc\s*=/i.test(attributes) || /type\s*=\s*["']application\/(?:ld\+)?json/i.test(attributes)) {
    continue;
  }
  try {
    // Compile only. Browser globals are intentionally not executed in this check.
    new Function(code);
    checked += 1;
  } catch (error) {
    console.error(`ERROR: inline script ${checked + 1} does not compile: ${error.message}`);
    process.exit(1);
  }
}

if (!checked) {
  console.error('ERROR: no inline JavaScript blocks were found to validate.');
  process.exit(1);
}

console.log(`Inline JavaScript validation passed: ${checked} script block${checked === 1 ? '' : 's'}.`);
