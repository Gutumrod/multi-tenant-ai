import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const MANIFEST = resolve(REPO, 'DELIVERY-MANIFEST.md');

const HIGH_CONFIDENCE = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['github-token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g],
  ['github-pat', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ['stripe-live-secret', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['credential-url', /https?:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/g],
];

const SENSITIVE_ASSIGNMENT =
  /^\s*([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*)\s*=\s*([^\s#]+)\s*$/gim;
const SENSITIVE_JSON =
  /"(?:api[_-]?key|access[_-]?token|secret|password|private[_-]?key)"\s*:\s*"([^"]+)"/gim;
const SAFE_MARKERS = [
  'your_', 'your-', 'example', 'placeholder', 'changeme', 'change_me', 'replace',
  '<', '>', 'test_', 'test-', 'dummy', 'fake', 'xxxx', 'todo', 'not-set',
];

function parseDelivered(text) {
  const start = text.indexOf('## Delivered');
  const end = text.indexOf('## Not delivered');
  if (start < 0 || end < 0 || end <= start) throw new Error('DELIVERY-MANIFEST delivered section not found');
  const section = text.slice(start, end);
  const match = section.match(/```text\r?\n([\s\S]*?)\r?\n```/);
  if (!match) throw new Error('DELIVERY-MANIFEST delivered code block not found');
  return match[1].split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

function looksSafePlaceholder(value) {
  const v = String(value).trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  if (!v || ['0', '1', 'true', 'false'].includes(v)) return true;
  return SAFE_MARKERS.some((marker) => v.includes(marker));
}

function findingsForText(text) {
  const findings = [];
  for (const [label, pattern] of HIGH_CONFIDENCE) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) findings.push({ label, sample: m[0].slice(0, 80) });
  }

  SENSITIVE_ASSIGNMENT.lastIndex = 0;
  for (const m of text.matchAll(SENSITIVE_ASSIGNMENT)) {
    const value = m[2].trim();
    if (value.length >= 12 && !looksSafePlaceholder(value)) {
      findings.push({ label: 'sensitive-assignment', sample: `${m[1]}=<redacted>` });
    }
  }

  SENSITIVE_JSON.lastIndex = 0;
  for (const m of text.matchAll(SENSITIVE_JSON)) {
    const value = m[1].trim();
    if (value.length >= 12 && !looksSafePlaceholder(value)) {
      findings.push({ label: 'sensitive-json-value', sample: '<redacted>' });
    }
  }
  return findings;
}

function selfTest() {
  const fakeStripe = ['sk', 'live', 'A'.repeat(24)].join('_');
  const fakeGithub = ['ghp', 'B'.repeat(36)].join('_');
  const fakePrivate = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
  const cases = [
    ['stripe-live-detected', `TOKEN=${fakeStripe}\n`, true],
    ['github-token-detected', fakeGithub, true],
    ['private-key-detected', fakePrivate, true],
    ['placeholder-env-allowed', 'OPENAI_API_KEY=your_openai_api_key', false],
    ['example-json-allowed', '"api_key": "example-placeholder-key"', false],
  ];
  let failed = 0;
  for (const [name, text, expectFinding] of cases) {
    const got = findingsForText(text).length > 0;
    const pass = got === expectFinding;
    console.log(`CHECK self-${name} ${pass ? 'PASS' : 'FAIL'} expected_finding=${expectFinding} observed_finding=${got}`);
    if (!pass) failed += 1;
  }
  console.log(`SUMMARY self_tests=${cases.length} passed=${cases.length - failed} failed=${failed}`);
  return failed === 0 ? 0 : 1;
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest());
}

const delivered = parseDelivered(readFileSync(MANIFEST, 'utf8'));
let failed = 0;
let scannedText = 0;
for (const rel of delivered) {
  const path = resolve(REPO, rel);
  if (!statSync(path).isFile()) continue;
  const buf = readFileSync(path);
  if (buf.includes(0)) continue;
  const text = buf.toString('utf8');
  scannedText += 1;
  const findings = findingsForText(text);
  for (const finding of findings) {
    console.log(`CHECK secret-scan:${rel} FAIL type=${finding.label} sample=${finding.sample}`);
    failed += 1;
  }
}
if (failed === 0) {
  console.log(`CHECK buyer-delivered-secret-scan PASS delivered_files=${delivered.length} text_files_scanned=${scannedText} findings=0`);
}
console.log(`SUMMARY buyer_secret_scan delivered_files=${delivered.length} text_files_scanned=${scannedText} findings=${failed}`);
process.exit(failed === 0 ? 0 : 1);
