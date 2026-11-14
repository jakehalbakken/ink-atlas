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

  // working on a project together
  const C = await mk('c@example.com');
  const [ps] = await q(A, `insert into public.projects (name, state, image_keys, tattoos) values ('Back piece', '{"tattoos":[]}', '{k1}', 0) returning id`);
  const inv = 'invite_aaaaaaaaaaaaaaaaaaaaa';
  await fails(B, `insert into public.invites (id, project_id) values ($1, $2)`, ['invite_bbbbbbbbbbbbbbbbbbbbb', ps.id], 'B inviting people into A\'s project');
  await fails(A, `insert into public.invites (id, project_id) values ('short', $1)`, [ps.id], 'a guessable invite id');
  await fails(A, `insert into public.invites (id, project_id, used_by) values ($1, $2, $3)`, ['invite_ccccccccccccccccccccc', ps.id, B], 'an invite already marked as used');
  await q(A, `update public.projects set shared = true, owner_name = 'Jake' where id = $1`, [ps.id]);
  await q(A, `insert into public.invites (id, project_id) values ($1, $2)`, [inv, ps.id]);
  assert.equal((await q(B, 'select id from public.invites')).length, 0, 'B cannot see invites');
  assert.equal((await q(B, 'select id from public.projects where id = $1', [ps.id])).length, 0, 'B cannot see it before joining');
  await fails(null, `select * from public.accept_invite($1, 'x')`, [inv], 'joining signed out');
  await fails(B, `select * from public.accept_invite($1, 'Liv')`, ['invite_zzzzzzzzzzzzzzzzzzzzz'], 'a wrong invite');
  await fails(B, `insert into public.project_members (project_id, user_id) values ($1, $2)`, [ps.id, B], 'B adding themselves without an invite');
  const acc = await q(B, `select * from public.accept_invite($1, 'Liv')`, [inv]);
  assert.equal(acc[0].project_id, ps.id); assert.equal(acc[0].owner_name, 'Jake');
  assert.equal((await q(B, `select * from public.accept_invite($1, 'Liv')`, [inv])).length, 1, 'the same person can open the invite again');
  await fails(C, `select * from public.accept_invite($1, 'Stranger')`, [inv], 'a forwarded invite someone already used');
  assert.equal((await q(B, 'select id from public.projects')).length, 1, 'B now sees that one project and nothing else of A\'s');
  assert.equal((await q(C, 'select id from public.projects')).length, 0, 'C still sees nothing');
  const members = await q(A, 'select user_id, name from public.project_members where project_id = $1', [ps.id]);
  assert.deepEqual(members, [{ user_id: B, name: 'Liv' }], 'A sees who joined');
  assert.equal((await q(C, 'select user_id from public.project_members')).length, 0, 'C cannot see who is on it');
  // B can save it (rev check as usual) but not take it, rename, remove or unshare it
  assert.equal((await q(B, `update public.projects set state = '{"tattoos":[1]}', rev = rev + 1 where id = $1 and rev = 1 returning rev`, [ps.id]))[0].rev, 2, 'B saves a change');
  await fails(B, `update public.projects set owner = $2 where id = $1`, [ps.id, B], 'B taking the project');
  await fails(B, `update public.projects set archived = true where id = $1`, [ps.id], 'B removing the project');
  await fails(B, `update public.projects set name = 'mine' where id = $1`, [ps.id], 'B renaming the project');
  await fails(B, `update public.projects set shared = false where id = $1`, [ps.id], 'B switching sharing off');
  await fails(A, `update public.projects set owner = $2 where id = $1`, [ps.id, B], 'A handing the project to B');
  assert.equal((await q(B, `delete from public.projects where id = $1 returning id`, [ps.id])).length, 0, 'B cannot delete it');
  assert.equal((await q(B, `update public.projects set name = 'x' where id = $1 returning id`, [pa.id])).length, 0, 'B still cannot touch A\'s other project');
  // shared artwork folder
  await q(A, `insert into storage.objects (bucket_id, name) values ('artwork', $1)`, ['p/' + ps.id + '/k1']);
  await q(B, `insert into storage.objects (bucket_id, name) values ('artwork', $1)`, ['p/' + ps.id + '/k2']);
  assert.equal((await q(B, `select name from storage.objects where bucket_id = 'artwork' and name like 'p/%'`)).length, 2, 'B reads the project\'s artwork');
  assert.equal((await q(B, `select name from storage.objects where bucket_id = 'artwork' and name = $1`, [A + '/k1'])).length, 0, 'but not A\'s own folder');
  await fails(C, `insert into storage.objects (bucket_id, name) values ('artwork', $1)`, ['p/' + ps.id + '/k3'], 'C writing into the project\'s artwork');
  await fails(B, `insert into storage.objects (bucket_id, name) values ('artwork', $1)`, ['p/' + pa.id + '/k3'], 'B writing into A\'s unshared project folder');
  await fails(B, `insert into storage.objects (bucket_id, name) values ('artwork', 'p/not-a-uuid/k3')`, [], 'a folder that is not a project');
  await fails(B, `insert into storage.objects (bucket_id, name) values ('artwork', $1)`, ['p/' + ps.id + '/deeper/k3'], 'a deeper folder');
  assert.equal((await q(C, `select name from storage.objects where bucket_id = 'artwork'`)).length, 0, 'C sees no artwork');
  // removing a project takes it away from people who joined; the owner taking someone off or them leaving does too
  await q(A, `update public.projects set archived = true where id = $1`, [ps.id]);
  assert.equal((await q(B, 'select id from public.projects where id = $1', [ps.id])).length, 0, 'removed: B no longer sees it');
  assert.equal((await q(B, `select name from storage.objects where name like 'p/%'`)).length, 0, 'removed: nor its artwork');
  await q(A, `update public.projects set archived = false where id = $1`, [ps.id]);
  assert.equal((await q(B, 'select id from public.projects where id = $1', [ps.id])).length, 1);
  assert.equal((await q(C, `delete from public.project_members where project_id = $1 returning user_id`, [ps.id])).length, 0, 'C cannot take B off');
  assert.equal((await q(A, `delete from public.project_members where project_id = $1 and user_id = $2 returning user_id`, [ps.id, B])).length, 1, 'A takes B off');
  assert.equal((await q(B, 'select id from public.projects where id = $1', [ps.id])).length, 0, 'taken off: B no longer sees it');
  await fails(B, `select * from public.accept_invite($1, 'Liv')`, [inv], 'rejoining with the old invite after being taken off');
  // leaving
  const inv2 = 'invite_ddddddddddddddddddddd';
  await q(A, `insert into public.invites (id, project_id) values ($1, $2)`, [inv2, ps.id]);
  await q(B, `select * from public.accept_invite($1, 'Liv')`, [inv2]);
  assert.equal((await q(B, `delete from public.project_members where project_id = $1 and user_id = $2 returning user_id`, [ps.id, B])).length, 1, 'B leaves');
  assert.equal((await q(B, 'select id from public.projects where id = $1', [ps.id])).length, 0, 'left: B no longer sees it');
  const expired = 'invite_eeeeeeeeeeeeeeeeeeeee';
  await q(A, `insert into public.invites (id, project_id, expires_at) values ($1, $2, now() - interval '1 minute')`, [expired, ps.id]);
  await fails(C, `select * from public.accept_invite($1, 'x')`, [expired], 'an invite that ran out');
  await fails(A, `insert into public.invites (id, project_id, expires_at) values ('invite_fffffffffffffffffffff', $1, now() + interval '1 year')`, [ps.id], 'an invite that never runs out');
  console.log('accounts-rls-unit: ok');
} finally { await fake.stop(); }
