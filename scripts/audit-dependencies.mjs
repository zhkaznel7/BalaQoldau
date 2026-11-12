import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function auditDecision(report, production) {
  const counts = report?.metadata?.vulnerabilities;
  if (report?.error || !counts || ['high', 'critical', 'moderate', 'low', 'info'].some(key => !Number.isInteger(counts[key]) || counts[key] < 0)) throw new Error('Audit unavailable or malformed');
  return { counts, blocked: production && (counts.high > 0 || counts.critical > 0) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const project of ['backend', 'balaqoldau']) for (const production of [false, true]) {
    try {
      const args = ['audit', '--json', '--ignore-scripts', '--fetch-timeout=15000', '--fetch-retries=0', ...(production ? ['--omit=dev', '--audit-level=high'] : [])];
      const result = process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd ' + args.join(' ')], { cwd: path.join(root, project), encoding: 'utf8', windowsHide: true, timeout: 25000 })
        : spawnSync('npm', args, { cwd: path.join(root, project), encoding: 'utf8', timeout: 25000 });
      if (result.error || result.status === null || result.status > 1) throw new Error('Audit process failed');
      const report = auditDecision(JSON.parse(result.stdout), production);
      console.log(JSON.stringify({ project, scope: production ? 'production' : 'all', ...report }));
      if (report.blocked) process.exitCode = 1;
    } catch { console.error(`${project}: dependency audit unavailable`); process.exitCode = 1; }
  }
}
