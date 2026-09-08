import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'docs', 'market-parity', 'MT-MP-01-PACKAGE-MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const actualModuleDirs = fs.readdirSync(path.join(root, 'modules'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `modules/${entry.name}`)
  .sort();
const expectedModuleDirs = manifest.modulePackages.map((entry) => entry.directory).sort();
if (JSON.stringify(actualModuleDirs) !== JSON.stringify(expectedModuleDirs)) {
  failures.push(`module directory set mismatch: actual=${actualModuleDirs.join(',')} expected=${expectedModuleDirs.join(',')}`);
}

for (const expected of manifest.modulePackages) {
  const pkg = readJson(`${expected.directory}/package.json`);
  const versionFile = fs.readFileSync(path.join(root, expected.directory, 'VERSION'), 'utf8').trim();
  if (pkg.name !== expected.packageName) failures.push(`${expected.directory}: package name ${pkg.name} != ${expected.packageName}`);
  if (pkg.version !== expected.version) failures.push(`${expected.directory}: package version ${pkg.version} != ${expected.version}`);
  if (versionFile !== expected.version) failures.push(`${expected.directory}: VERSION ${versionFile} != ${expected.version}`);
  if (pkg.private !== expected.private) failures.push(`${expected.directory}: private flag ${pkg.private} != ${expected.private}`);
  if (pkg.devDependencies?.typescript !== manifest.toolchain.typescript) {
    failures.push(`${expected.directory}: TypeScript ${pkg.devDependencies?.typescript} != ${manifest.toolchain.typescript}`);
  }
  if (pkg.devDependencies?.vitest !== manifest.toolchain.vitest) {
    failures.push(`${expected.directory}: Vitest ${pkg.devDependencies?.vitest} != ${manifest.toolchain.vitest}`);
  }
}

const server = readJson(`${manifest.referenceServer.directory}/package.json`);
if (server.name !== manifest.referenceServer.packageName) failures.push(`server package name mismatch: ${server.name}`);
if (server.version !== manifest.referenceServer.version) failures.push(`server version mismatch: ${server.version}`);
if (server.private !== manifest.referenceServer.private) failures.push(`server private flag mismatch: ${server.private}`);
if (server.engines?.node !== manifest.referenceServer.node) failures.push(`server Node engine mismatch: ${server.engines?.node}`);
for (const [name, version] of Object.entries(manifest.referenceServer.runtimeDependencies)) {
  if (server.dependencies?.[name] !== version) failures.push(`server dependency ${name}: ${server.dependencies?.[name]} != ${version}`);
}
for (const [name, version] of Object.entries(manifest.referenceServer.devDependencies)) {
  if (server.devDependencies?.[name] !== version) failures.push(`server devDependency ${name}: ${server.devDependencies?.[name]} != ${version}`);
}

const rootPkg = readJson('package.json');
for (const workspace of ['modules/*', 'server']) {
  if (!rootPkg.workspaces?.includes(workspace)) failures.push(`root workspace missing ${workspace}`);
}
for (const [name, version] of Object.entries(manifest.rootDevDependencies)) {
  if (rootPkg.devDependencies?.[name] !== version) failures.push(`root devDependency ${name}: ${rootPkg.devDependencies?.[name]} != ${version}`);
}
if (!fs.existsSync(path.join(root, 'package-lock.json'))) failures.push('root package-lock.json is missing');
for (const workspace of [...manifest.modulePackages.map((entry) => entry.directory), manifest.referenceServer.directory]) {
  if (fs.existsSync(path.join(root, workspace, 'package-lock.json'))) failures.push(`${workspace}: child package-lock.json must not exist`);
}
if (failures.length > 0) {
  console.error('Package manifest verification FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Package manifest verification PASS (${manifest.modulePackages.length} modules + reference server).`);
