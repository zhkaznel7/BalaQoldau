import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
// Only messages authored by this checker are public; never echo JSON, Git stderr or OS paths.
export function safePolicyError(error) {
  const known = new Set(['Empty asset policy', 'Asset symlink is not allowed', 'Unreviewed frontend asset',
    'Invalid asset policy', 'Asset escaped public root', 'Invalid migration inventory',
    'Destructive migration requires separate review', 'No migrations', 'Existing migration changed or removed',
    'New migrations must follow previous versions', 'Invalid migration baseline', 'Git command failed',
    'Migration base commit unavailable (fetch required history)',
    'Choose --source or --artifacts', 'Missing or changed approved asset', 'Missing build outputs']);
  if (known.has(error?.message)) return error.message;
  if (/^Asset policy hash mismatch: [a-zA-Z0-9/_-]+\.(?:svg|txt)$/.test(error?.message ?? '')) return error.message;
  if (error instanceof SyntaxError) return 'Invalid JSON (contents redacted)';
  if (error?.code === 'ENOENT') return 'Required file or directory missing (ENOENT)';
  if (['EACCES', 'EPERM'].includes(error?.code)) return 'File access denied';
  return 'Unexpected failure (details redacted)';
}
export function forbiddenPath(file, artifact = false) {
  return file.split(/[\\/]/).some(part => {
    if (!artifact && ['.env.example', '.env.production.example'].includes(part)) return false;
    return /^\.env(?:\.|$)/.test(part) || ['node_modules', '.git', '.pgpass', 'pgpass.conf'].includes(part)
      || (!artifact && ['dist', 'coverage'].includes(part))
      || /\.(?:pem|key|p12|pfx|dump|backup|log|sql\.gz)$/i.test(part);
  });
}
export function textFindings(file, content, artifact = false) {
  const findings = [];
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) findings.push('private key');
  if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b/.test(content)) findings.push('token pattern');
  for (const match of content.matchAll(/(?:postgres(?:ql)?|https?):\/\/([^\s/:@]+):([^\s/@]+)@([^\s/"'<>]+)/g)) {
    const placeholder = /^YOUR_[A-Z_]+$/.test(match[2]);
    const fixture = /(?:^|\/)tests\//.test(file) && /^(?:example\.(?:com|kz)|localhost|127\.0\.0\.1)(?::\d+)?$/.test(match[3]) && ['pass', 'secret', 'test'].includes(match[2]);
    if (!placeholder && !fixture) findings.push('credential URL');
  }
  if (artifact && /(?:api[_-]?key|password|access[_-]?token|secret)\s*[:=]\s*["'][A-Za-z0-9_+\/-]{24,}["']/i.test(content)) findings.push('literal secret assignment');
  if (artifact && process.env.RELEASE_SCAN_CANARY && content.includes(process.env.RELEASE_SCAN_CANARY)) findings.push('private build environment leaked');
  return findings;
}
export function approvedAssets(root) {
  const entries = JSON.parse(readFileSync(path.join(root, 'release-assets.json'), 'utf8'));
  if (!Array.isArray(entries) || !entries.length) throw new Error('Empty asset policy');
  const sources = new Set(entries.map(entry => entry.source));
  function inspectAssets(directory) {
    if (!existsSync(path.join(root, directory))) return;
    for (const item of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = directory + '/' + item.name;
      if (item.isSymbolicLink()) throw new Error('Asset symlink is not allowed');
      if (item.isDirectory()) inspectAssets(file);
      else if ((directory.startsWith('balaqoldau/public') || /\.(?:svg|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp[34]|webm|pdf)$/i.test(file))
        && !sources.has(file) && file !== 'balaqoldau/public/images/CREDITS.md') throw new Error('Unreviewed frontend asset');
    }
  }
  inspectAssets('balaqoldau/public');
  inspectAssets('balaqoldau/src');
  const outputs = new Set();
  return entries.map(entry => {
    if (!['MIT', 'ISC AND MIT', 'CC0-1.0', 'LicenseRef-Project-Owned'].includes(entry.license) || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || typeof entry.source !== 'string' || !entry.source.startsWith('balaqoldau/public/')
      || typeof entry.output !== 'string' || !/^[a-zA-Z0-9/_-]+\.(?:svg|txt)$/.test(entry.output)
      || entry.output.split('/').includes('..') || outputs.has(entry.output)) throw new Error('Invalid asset policy');
    const publicRoot = realpathSync(path.join(root, 'balaqoldau/public'));
    const source = realpathSync(path.resolve(root, entry.source));
    if (!source.startsWith(publicRoot + path.sep)) throw new Error('Asset escaped public root');
    const bytes = readFileSync(source);
    if (sha256(bytes) !== entry.sha256) throw new Error(`Asset policy hash mismatch: ${entry.output}`);
    outputs.add(entry.output);
    return { ...entry, bytes };
  });
}
export function checkMigrations(previous, current) {
  const versions = new Set();
  for (const [name, bytes] of current) {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name) || versions.has(name.slice(0, 3))) throw new Error('Invalid migration inventory');
    versions.add(name.slice(0, 3));
    if (/\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA|DATABASE)\b|\bDROP\s+COLUMN\b/i.test(bytes.toString())) throw new Error('Destructive migration requires separate review');
  }
  if (!current.size) throw new Error('No migrations');
  const maximum = Math.max(0, ...[...previous.keys()].map(name => Number(name.slice(0, 3))));
  for (const [name, bytes] of previous) if (!current.has(name) || sha256(bytes.toString().replace(/\r\n/g, '\n')) !== sha256(current.get(name).toString().replace(/\r\n/g, '\n'))) throw new Error('Existing migration changed or removed');
  for (const name of current.keys()) if (!previous.has(name) && Number(name.slice(0, 3)) <= maximum) throw new Error('New migrations must follow previous versions');
}
