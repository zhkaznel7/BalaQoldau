import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseTestDatabaseEnvironment } from '../../dist/db/config.js';
import { createDatabasePool } from '../../dist/db/pool.js';
import { runMigrations } from '../../dist/db/migrate.js';

test('dedicated PostgreSQL database: migrations, constraints and visibility without DEMO seed', async t => {
  // Fail (never silently skip) without an explicit separate *_test database.
  const config = parseTestDatabaseEnvironment(process.env);
  const pool = createDatabasePool(config);
  try {
    const identity = await pool.query('SELECT current_database() AS name');
    assert.equal(identity.rows[0].name, decodeURIComponent(new URL(config.DATABASE_URL).pathname.slice(1)));
    await t.test('migrations are idempotent and record checksums', async () => {
      await runMigrations(pool);
      const before = await pool.query('SELECT version,checksum,applied_at FROM balaqoldau.schema_migrations ORDER BY version');
      assert.ok(before.rowCount > 0);
      assert.equal(await runMigrations(pool), 0);
      const after = await pool.query('SELECT version,checksum,applied_at FROM balaqoldau.schema_migrations ORDER BY version');
      assert.deepEqual(after.rows, before.rows);
      assert.match(before.rows[0].checksum, /^[a-f0-9]{64}$/);
    });
    await t.test('test database has no development DEMO seed', async () => {
      const result = await pool.query('SELECT count(*)::int AS count FROM balaqoldau.programs WHERE is_demo');
      assert.equal(result.rows[0].count, 0);
    });
    await t.test('constraints, foreign keys, duplicate links and publication rules', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const id = randomUUID();
        const category = (await client.query('INSERT INTO balaqoldau.categories(slug,name) VALUES ($1,$2) RETURNING id', ['integration-' + id, 'TEST fixture'])).rows[0].id;
        const region = (await client.query('INSERT INTO balaqoldau.regions(slug,name) VALUES ($1,$2) RETURNING id', ['integration-' + id, 'TEST fixture'])).rows[0].id;
        await client.query(`INSERT INTO balaqoldau.programs(id,slug,category_id,title,description)
          VALUES ($1,$2,$3,$4,$5)`, [id, 'integration-' + id, category, 'TEST', 'Transient test row; rolled back']);
        const reject = async (sql, values, code) => {
          await client.query('SAVEPOINT invalid_input');
          await assert.rejects(client.query(sql, values), error => error.code === code);
          await client.query('ROLLBACK TO SAVEPOINT invalid_input');
        };
        await reject('UPDATE balaqoldau.programs SET age_min=$1,age_max=$2 WHERE id=$3', [18, 17, id], '23514');
        await reject('UPDATE balaqoldau.programs SET status=$1 WHERE id=$2', ['unknown', id], '23514');
        await reject('UPDATE balaqoldau.programs SET status=$1 WHERE id=$2', ['published', id], '23514');
        await reject('UPDATE balaqoldau.programs SET category_id=$1 WHERE id=$2', [-1, id], '23503');
        await reject('UPDATE balaqoldau.programs SET source_url=$1 WHERE id=$2', ['javascript:alert(1)', id], '23514');
        await reject('UPDATE balaqoldau.programs SET title=$1 WHERE id=$2', [' ', id], '23514');
        await reject('INSERT INTO balaqoldau.program_regions(program_id,region_id) VALUES ($1,$2)', [id, -1], '23503');
        await reject('INSERT INTO balaqoldau.contact_messages(sender_name,email,message) VALUES ($1,$2,$3)', ['TEST', 'invalid', 'TEST'], '23514');
        await client.query('INSERT INTO balaqoldau.program_regions(program_id,region_id) VALUES ($1,$2)', [id, region]);
        await reject('INSERT INTO balaqoldau.program_regions(program_id,region_id) VALUES ($1,$2)', [id, region], '23505');
        const visible = async () => (await client.query('SELECT id FROM balaqoldau.published_programs WHERE id=$1', [id])).rowCount;
        assert.equal(await visible(), 0);
        await client.query(`UPDATE balaqoldau.programs SET status='verified',source_url=$1,
          source_name=$2,verified_at=now() WHERE id=$3`, ['https://example.com/test', 'TEST source', id]);
        assert.equal(await visible(), 0);
        await client.query("UPDATE balaqoldau.programs SET status='published' WHERE id=$1", [id]);
        assert.equal(await visible(), 1);
        await reject('UPDATE balaqoldau.programs SET is_demo=true WHERE id=$1', [id], '23514');
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });
  } catch {
    throw new Error('Database integration failed: check dedicated TEST_DATABASE_URL, server availability and schema. No reset was performed.');
  } finally { await pool.end(); }
});
