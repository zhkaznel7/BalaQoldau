import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

test('development source modules load with native Node TypeScript support', () => {
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', "await import('./src/app.ts')"], {
    encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
});

test('invalid production configuration stops startup without leaking values', () => {
  const child = spawnSync(process.execPath, ['dist/server.js'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, NODE_ENV: 'production', PORT: 'secret-invalid-port', CORS_ALLOWED_ORIGINS: 'https://example.kz' },
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /check environment configuration/);
  assert.equal(child.stderr.includes('secret-invalid-port'), false);
  assert.equal(child.stderr.includes(' at '), false);
});

test('compiled production entry point serves health over HTTP', { timeout: 10000 }, async t => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['dist/server.js'], {
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), CORS_ALLOWED_ORIGINS: 'https://example.kz' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Server exited before readiness')));
    child.stdout.on('data', data => {
      if (data.toString().includes('Backend listening')) resolve();
    });
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('successful shutdown cancels its deadline instead of reporting a later failure', async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const script = `
    import { mock } from 'node:test';
    mock.timers.enable({ apis: ['setTimeout'] });
    console.info = () => {
      process.emit('SIGTERM');
      setImmediate(() => {
        mock.timers.tick(10001);
        mock.timers.reset();
      });
    };
    await import('./dist/server.js');
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), CORS_ALLOWED_ORIGINS: 'https://example.kz' },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr.includes('shutdown timed out'), false);
});
