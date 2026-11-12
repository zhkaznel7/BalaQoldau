import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvedAssets, forbiddenPath, textFindings, checkMigrations, sha256, safePolicyError } from './release-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = args => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch { throw new Error('Git command failed'); }
};
const mode = process.argv[2];
const failures = [];
let phase = 'arguments';
function inspect(file, artifact = false) {
  if (forbiddenPath(file, artifact)) { failures.push(`${file}: forbidden path`); return; }
  const target = path.join(root, file);
  if (lstatSync(target).isSymbolicLink()) { failures.push(`${file}: symlink`); return; }
  const bytes = readFileSync(target);
  if (artifact && bytes.includes(0)) failures.push(`${file}: unexpected binary artifact`);
  if (!bytes.includes(0)) for (const reason of textFindings(file, bytes.toString('utf8'), artifact)) failures.push(`${file}: ${reason}`);
}
function walk(dir) {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const file = dir + '/' + entry.name;
    if (entry.isSymbolicLink()) { failures.push(`${file}: symlink`); return []; }
    return entry.isDirectory() ? walk(file) : [file];
  });
}
try {
  if (!['--source', '--artifacts'].includes(mode) || process.argv.length !== 3) throw new Error('Choose --source or --artifacts');
  phase = 'asset policy';
  const assets = approvedAssets(root);
  if (mode === '--source') {
    phase = 'source inventory';
    const files = new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean));
    for (const file of git(['ls-files', '-z', '--deleted']).split('\0').filter(Boolean)) files.delete(file);
    for (const file of files) inspect(file);
    phase = 'migration inventory';
    const current = new Map(readdirSync(path.join(root, 'backend/migrations')).map(name => [name, readFileSync(path.join(root, 'backend/migrations', name))]));
    const previous = new Map();
    const base = process.env.MIGRATION_BASE;
    phase = 'migration baseline';
    if (base && !/^0{40}$/.test(base)) {
      if (!/^[a-f0-9]{40}$/.test(base)) throw new Error('Invalid migration baseline');
      try { git(['cat-file', '-e', `${base}^{commit}`]); }
      catch { throw new Error('Migration base commit unavailable (fetch required history)'); }
      for (const file of git(['ls-tree', '-r', '--name-only', base, '--', 'backend/migrations']).trim().split('\n').filter(Boolean)) previous.set(path.basename(file), git(['show', `${base}:${file}`]));
    }
    phase = 'migration policy';
    checkMigrations(previous, current);
    console.log(`Source/asset/migration policy: ${files.size} files checked; baseline ${base ? 'provided' : 'not provided (inventory only)'}`);
  } else {
    phase = 'production artifacts';
    for (const asset of assets) {
      if (sha256(readFileSync(path.join(root, 'balaqoldau/dist', asset.output))) !== asset.sha256) throw new Error('Missing or changed approved asset');
    }
    for (const dir of ['backend/dist', 'balaqoldau/dist']) {
      const files = walk(dir);
      if (!files.length) throw new Error('Missing build outputs');
      for (const file of files) {
        inspect(file, true);
        if (file.startsWith('balaqoldau/dist/')) {
          const relative = file.slice('balaqoldau/dist/'.length);
          const approved = assets.find(asset => asset.output === relative);
          if (!/\.(?:js|css|html)$/.test(relative) && !approved) failures.push(`${file}: asset not approved`);
          if (approved && sha256(readFileSync(path.join(root, file))) !== approved.sha256) failures.push(`${file}: altered licensed asset`);
          if (/\.(?:js|css|html)$/.test(file) && /postgres(?:ql)?:\/\/|DATABASE_URL|data:image\/(?:png|jpeg|webp)/i.test(readFileSync(path.join(root, file), 'utf8'))) failures.push(`${file}: database configuration or unapproved inline image`);
        }
      }
    }
    console.log('Production artifact policy checked');
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} catch (error) {
  // Findings contain paths/reason categories, never matching secret values.
  console.error(`Release policy check failed [${phase}]: ${safePolicyError(error)}`);
  if (failures.length) console.error(failures.join('\n'));
  process.exitCode = 1;
}
