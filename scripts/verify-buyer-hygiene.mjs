import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buyerRoots = [
  'README.md',
  'SECURITY.md',
  'LICENSE.md',
  'COMMERCIAL_LICENSE.md',
  'EULA.md',
  'THIRD_PARTY_LICENSES.md',
  'PROVENANCE.md',
  'docs/market-parity',
  'modules',
  'server',
];
const forbiddenNames = [
  /^\.agy/i,
  /^agy-prompt\.md$/i,
  /^ROUND\d+_HANDOFF\.md$/i,
];
const forbiddenContent = [
  /[A-Z]:\\AI-Workspace\\/i,
  /\/Users\/[^/]+\/AI-Workspace\//i,
  /projects[\\/]modules-hub/i,
  /\.secretary-relay/i,
  /hermes-native/i,
];
const secretPatterns = [
  /sk_live_[A-Za-z0-9]{16,}/,
  /rk_live_[A-Za-z0-9]{16,}/,
  /whsec_[A-Za-z0-9]{20,}/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
];

function listFiles(target) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const child = path.join(full, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(path.relative(root, child)));
    else out.push(child);
  }
  return out;
}

const files = buyerRoots.flatMap(listFiles);
const failures = [];
for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const base = path.basename(file);
  if (forbiddenNames.some((pattern) => pattern.test(base))) {
    failures.push(`${rel}: internal-only filename`);
    continue;
  }
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) continue;
  const text = buffer.toString('utf8');
  for (const pattern of forbiddenContent) {
    if (pattern.test(text)) failures.push(`${rel}: private/internal path reference (${pattern})`);
  }
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) failures.push(`${rel}: high-confidence credential pattern (${pattern})`);
  }
}

if (failures.length > 0) {
  console.error('Buyer hygiene verification FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Buyer hygiene verification PASS (${files.length} files scanned).`);
