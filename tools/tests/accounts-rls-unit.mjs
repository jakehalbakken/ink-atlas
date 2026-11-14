// Accounts: supabase/setup.sql's row-level security, in a real PostgreSQL through
// tools/fake-supabase.mjs. Each person sees and changes only their own projects and artwork,
// nobody can list shared copies, a shared copy opens by its exact link id (signed out too),
// and signed out nothing can be written.
// Run: PGHOST=/var/run/postgresql PGUSER=postgres node tools/tests/accounts-rls-unit.mjs
import assert from 'node:assert/strict';
import { startFakeSupabase } from '../fake-supabase.mjs';

const fake = await startFakeSupabase();
try {
  const mk = async (email) => (await fake.pool.query(`insert into auth.users (email, password) values ($1, 'secret1') returning id`, [email])).rows[0].id;
  const A = await mk('a@example.com'), B = await mk('b@example.com');
  const q = (uid, sql, args) => fake.as(uid, (c) => c.query(sql, args)).then((r) => r.rows);
  const fails = async (uid, sql, args, what) => { let err = null; try { await q(uid, sql, args); } catch (e) { err = e; } assert.ok(err, what + ' should be refused'); };

  // projects
  const [pa] = await q(A, `insert into public.projects (name, state, image_keys, tattoos) values ('Liv sleeve', '{"tattoos":[]}', '{k1}', 0) returning id, owner, rev`);
  assert.equal(pa.owner, A, 'owner is the person signed in'); assert.equal(pa.rev, 1);
  assert.equal((await q(A, 'select id from public.projects')).length, 1, 'A sees their project');
  assert.equal((await q(B, 'select id from public.projects')).length, 0, 'B sees none of A\'s');
  assert.equal((await q(null, 'select id from public.projects')).length, 0, 'signed out sees nothing');
  assert.equal((await q(B, `update public.projects set name = 'mine now' where id = $1 returning id`, [pa.id])).length, 0, 'B cannot change it');
  assert.equal((await q(B, `delete from public.projects where id = $1 returning id`, [pa.id])).length, 0, 'B cannot delete it');
  await fails(B, `insert into public.projects (owner, name, state) values ($1, 'x', '{}')`, [A], 'B adding a project in A\'s name');
  await fails(A, `update public.projects set owner = $2 where id = $1`, [pa.id, B], 'A giving a project to B');
  await fails(null, `insert into public.projects (name, state) values ('x', '{}')`, [], 'adding a project signed out');
  // saving only if nobody saved since (rev check), and the server's clock
  const before = (await q(A, 'select updated_at from public.projects where id = $1', [pa.id]))[0].updated_at;
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await q(A, `update public.projects set rev = 2, updated_at = '2001-01-01' where id = $1 and rev = 1 returning rev`, [pa.id])).length, 1);
  assert.equal((await q(A, `update public.projects set rev = 2 where id = $1 and rev = 1 returning rev`, [pa.id])).length, 0, 'a save from an older version changes nothing');
  const after = (await q(A, 'select updated_at from public.projects where id = $1', [pa.id]))[0].updated_at;
  assert.ok(after > before, 'updated_at comes from the server, not the device');

  // shares
  const id = 'abcdefghijklmnopqrstuv';
  await q(A, `insert into public.shares (id, name, from_name, state, image_keys) values ($1, 'For Liv', 'Jake', '{"tattoos":[]}', '{k1}')`, [id]);
  assert.equal((await q(B, 'select id from public.shares')).length, 0, 'B cannot list shares');
  assert.equal((await q(null, 'select id from public.shares')).length, 0, 'signed out cannot list shares');
  const got = await q(null, 'select * from public.get_share($1)', [id]);
  assert.equal(got.length, 1, 'the link opens signed out'); assert.equal(got[0].folder, A + '/' + id); assert.equal(got[0].from_name, 'Jake');
  assert.equal((await q(B, 'select * from public.get_share($1)', ['abcdefghijklmnopqrstuw'])).length, 0, 'a wrong id opens nothing');
  await fails(B, `insert into public.shares (id, owner, name, state) values ('zzzzzzzzzzzzzzzzzzzzzz', $1, 'x', '{}')`, [A], 'B making a share in A\'s name');
  await fails(A, `insert into public.shares (id, name, state) values ('short', 'x', '{}')`, [], 'a guessable share id');
  await fails(null, `insert into public.shares (id, name, state) values ('yyyyyyyyyyyyyyyyyyyyyy', 'x', '{}')`, [], 'sharing signed out');

  // storage
  await q(A, `insert into storage.objects (bucket_id, name) values ('artwork', $1)`, [A + '/k1']);
  assert.equal((await q(A, `select name from storage.objects where bucket_id = 'artwork'`)).length, 1, 'A reads their artwork');
  assert.equal((await q(B, `select name from storage.objects where bucket_id = 'artwork'`)).length, 0, 'B cannot see A\'s artwork');
  assert.equal((await q(null, `select name from storage.objects`)).length, 0, 'signed out cannot list any files');
  await fails(B, `insert into storage.objects (bucket_id, name) values ('artwork', $1)`, [A + '/k2'], 'B writing into A\'s folder');
  await fails(null, `insert into storage.objects (bucket_id, name) values ('artwork', 'x/k2')`, [], 'writing files signed out');
  await q(A, `insert into storage.objects (bucket_id, name) values ('shared-artwork', $1)`, [A + '/' + id + '/k1']);
  await fails(B, `insert into storage.objects (bucket_id, name) values ('shared-artwork', $1)`, [A + '/' + id + '/k9'], 'B adding to A\'s shared copy');
  assert.equal((await q(B, `select name from storage.objects where bucket_id = 'shared-artwork'`)).length, 0, 'B cannot list shared artwork');
  const buckets = (await fake.pool.query('select id, public from storage.buckets order by id')).rows;
  assert.deepEqual(buckets, [{ id: 'artwork', public: false }, { id: 'shared-artwork', public: true }]);
  console.log('accounts-rls-unit: ok');
} finally { await fake.stop(); }
