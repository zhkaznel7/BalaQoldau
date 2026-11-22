import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function auditDecision(report, production) {
  const counts = report?.metadata?.vulnerabilities;
  if (report?.error || !counts || ['high', 'critical', 'moderate', 'low', 'info'].some(key => !Number.isInteger(counts[key]) || counts[key] < 0)) throw new Error('Audit unavailable or malformed');
  return { counts, blocked: production && (counts.high > 0 || counts.critical > 0) };
}

const transientCodes = new Set(['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'E429', 'E500', 'E502', 'E503', 'E504']);
class AuditFailure extends Error {
  constructor(message, retryable = false) { super(message); this.retryable = retryable; }
}
const failure = (message, retryable = false) => new AuditFailure(message, retryable);

export function evaluateAudit(result, production) {
  if (result.error?.code === 'ETIMEDOUT') throw failure('AUDIT_TIMEOUT: npm exceeded the 90s process deadline', true);
  if (result.error?.code === 'ENOENT') throw failure('AUDIT_EXECUTABLE_MISSING: npm could not be started');
  if (result.error?.code === 'ENOBUFS') throw failure('AUDIT_OUTPUT_LIMIT: report exceeded the bounded output buffer');
  if (result.error) throw failure('AUDIT_PROCESS_ERROR: npm could not complete');
  if (result.status === null) throw failure('AUDIT_PROCESS_SIGNALLED: npm terminated without a report');
  if (![0, 1].includes(result.status)) throw failure('AUDIT_PROCESS_EXIT: unexpected npm exit status');
  let report;
  try { report = JSON.parse(result.stdout); }
  catch { throw failure('AUDIT_INVALID_JSON: npm did not return a complete JSON report'); }
  if (report?.error) {
    const code = report.error.code;
    if (transientCodes.has(code)) throw failure(`AUDIT_REGISTRY_TRANSIENT: ${code}`, true);
    if (['E401', 'E403', 'ENEEDAUTH'].includes(code)) throw failure('AUDIT_REGISTRY_AUTH: registry authentication or permission failure');
    if (code === 'ENOLOCK') throw failure('AUDIT_LOCKFILE_MISSING: npm requires an existing lockfile');
    throw failure('AUDIT_REGISTRY_ERROR: registry did not provide an audit report (details redacted)');
  }
  try { return auditDecision(report, production); }
  catch { throw failure('AUDIT_INVALID_REPORT: required vulnerability counts are missing or invalid'); }
}

export function runAudit(project, production, spawn = spawnSync, onRetry = () => {}) {
  if (!['backend', 'balaqoldau'].includes(project)) throw failure('AUDIT_CONFIG: unknown project');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const args = ['audit', '--json', '--ignore-scripts', '--fetch-timeout=30000', '--fetch-retries=1',
    '--fetch-retry-mintimeout=1000', '--fetch-retry-maxtimeout=2000', ...(production ? ['--omit=dev', '--audit-level=high'] : [])];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const options = { cwd: path.join(root, project), encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 };
    const result = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm.cmd ' + args.join(' ')], options)
      : spawn('npm', args, options);
    try { return { ...evaluateAudit(result, production), attempts: attempt }; }
    catch (error) {
      if (!error.retryable || attempt === 2) throw error;
      onRetry(error.message);
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const project of ['backend', 'balaqoldau']) for (const production of [false, true]) {
    const scope = production ? 'production' : 'all';
    try {
      const report = runAudit(project, production, spawnSync, reason => console.error(`${project} [${scope}]: ${reason}; retrying once`));
      console.log(JSON.stringify({ project, scope, ...report }));
      if (report.blocked) process.exitCode = 1;
    } catch (error) {
      // Only diagnostics created above are exposed, never registry responses, stderr or configuration.
      const reason = error instanceof AuditFailure ? error.message : 'AUDIT_INTERNAL_ERROR: details redacted';
      console.error(`${project} [${scope}]: ${reason}; security gate failed closed`);
      process.exitCode = 1;
    }
  }
}
