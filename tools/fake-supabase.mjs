// A small stand-in for a Supabase project, for testing accounts without one.
// Auth, the REST calls the app makes, and storage are answered here; every data call runs in
// a real PostgreSQL as the signed-in person (role authenticated, auth.uid() = their id) or as
// anon, against supabase/setup.sql run unchanged, so row-level security is the real thing.
//
// Needs a local PostgreSQL the current user can reach as a superuser (PGHOST/PGUSER etc.).
// Usage: const fake = await startFakeSupabase({ port }); ... await fake.stop();
// Codes for "email me a code" are not emailed: fake.codes.get(email) holds the last one.
import { createServer } from 'node:http';
import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const SECRET = 'fake-supabase-secret';
const b64u = (b) => Buffer.from(b).toString('base64url');
const jwt = (payload) => { const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64u(JSON.stringify(payload)); return `${h}.${p}.${b64u(createHmac('sha256', SECRET).update(h + '.' + p).digest())}`; };
const unjwt = (t) => { try { const [h, p, s] = t.split('.'); if (b64u(createHmac('sha256', SECRET).update(h + '.' + p).digest()) !== s) return null; const c = JSON.parse(Buffer.from(p, 'base64url')); return c.exp * 1000 > Date.now() ? c : null; } catch (e) { return null; } };

// What Supabase gives a project before any of its own SQL: roles, auth.users, auth.uid(),
// and the storage schema with storage.foldername().
const PLATFORM = `
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique not null, password text, meta jsonb not null default '{}', created_at timestamptz not null default now());
create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid default auth.uid(), created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $f$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
grant usage on schema auth, storage, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`;

export async function startFakeSupabase({ port = 0, db = 'ink_fake_' + randomBytes(3).toString('hex'), sql = resolve(import.meta.dirname, '..', 'supabase', 'setup.sql') } = {}) {
  const admin = new pg.Client({ database: 'postgres' }); await admin.connect();
  await admin.query(`create database ${db}`); await admin.end();
  const pool = new pg.Pool({ database: db, max: 8 });
  await pool.query(PLATFORM);
  await pool.query(readFileSync(sql, 'utf8'));
  await pool.query(readFileSync(sql, 'utf8')); // setup.sql must be safe to run twice
  const files = new Map(), codes = new Map(), refresh = new Map(), log = [];

  // Run fn(client) as this caller, the way PostgREST does: one transaction, role and claims set.
  async function as(uid, fn) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(`select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [uid ? 'authenticated' : 'anon', uid || '']);
      const r = await fn(c); await c.query('commit'); return r;
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
  }
  const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at, user_metadata: u.meta || {}, app_metadata: { provider: 'email', providers: ['email'] }, identities: [], created_at: u.created_at, updated_at: u.created_at });
  const session = (u) => {
    const now = Math.floor(Date.now() / 1000), rt = randomBytes(16).toString('hex'); refresh.set(rt, u.id);
    return { access_token: jwt({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: now + 3600, iat: now, session_id: randomUUID() }), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user: userJson(u) };
  };
  const userBy = async (where, v) => (await pool.query(`select id, email, password, meta, created_at from auth.users where ${where} = $1`, [v])).rows[0];

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', '*');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    const chunks = []; for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks), u = new URL(req.url, 'http://x'), path = u.pathname;
    const send = (code, body, type = 'application/json') => { res.statusCode = code; if (body === undefined) return res.end(); res.setHeader('Content-Type', type); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
    const json = () => { try { return raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch (e) { return {}; } };
    const claims = unjwt((req.headers.authorization || '').replace(/^Bearer /i, '')), uid = claims && claims.sub && claims.role === 'authenticated' ? claims.sub : null;
    log.push(req.method + ' ' + path + (uid ? ' as ' + uid.slice(0, 8) : ''));
    try {
      /* ---------- auth ---------- */
      if (path === '/auth/v1/signup') {
        const b = json(); if (!b.password || b.password.length < 6) return send(422, { code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        if (await userBy('email', b.email.toLowerCase())) return send(422, { code: 'user_already_exists', msg: 'User already registered' });
        const r = (await pool.query(`insert into auth.users (email, password, meta) values ($1, $2, $3) returning id, email, meta, created_at`, [b.email.toLowerCase(), b.password, b.data || {}])).rows[0];
        return send(200, session(r));
      }
      if (path === '/auth/v1/token') {
        const b = json(), g = u.searchParams.get('grant_type');
        if (g === 'password') { const r = await userBy('email', String(b.email || '').toLowerCase()); if (!r || r.password !== b.password) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' }); return send(200, session(r)); }
        if (g === 'refresh_token') { const id = refresh.get(b.refresh_token); if (!id) return send(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }); refresh.delete(b.refresh_token); return send(200, session(await userBy('id', id))); }
        return send(400, { error: 'unsupported_grant_type' });
      }
      if (path === '/auth/v1/otp') { const b = json(), email = String(b.email || '').toLowerCase(); let r = await userBy('email', email); if (!r && b.create_user === false) return send(422, { code: 'otp_disabled', msg: 'Signups not allowed for otp' }); if (!r) await pool.query(`insert into auth.users (email) values ($1)`, [email]); const code = String(100000 + Math.floor(Math.random() * 900000)); codes.set(email, code); return send(200, {}); }
      if (path === '/auth/v1/verify') { const b = json(), email = String(b.email || '').toLowerCase(); if (!codes.get(email) || codes.get(email) !== b.token) return send(403, { code: 'otp_expired', msg: 'Token has expired or is invalid' }); codes.delete(email); return send(200, session(await userBy('email', email))); }
      if (path === '/auth/v1/user') {
        if (!uid) return send(401, { code: 'bad_jwt', msg: 'invalid JWT' });
        if (req.method === 'PUT') { const b = json(); if (b.password) await pool.query(`update auth.users set password = $2 where id = $1`, [uid, b.password]); if (b.data) await pool.query(`update auth.users set meta = meta || $2 where id = $1`, [uid, b.data]); }
        return send(200, userJson(await userBy('id', uid)));
      }
      if (path === '/auth/v1/logout') return send(204);

      /* ---------- REST (only the shapes the app uses) ---------- */
      const fn = /^\/rest\/v1\/rpc\/(get_share|accept_invite)$/.exec(path);
      if (fn) {
        const b = json(), names = Object.keys(b).filter((k) => /^[a-z_]+$/.test(k));
        try { const rows = await as(uid, (c) => c.query(`select * from public.${fn[1]}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, names.map((k) => b[k]))).then((r) => r.rows); return send(200, rows); }
        catch (e) { return send(e.code === '42501' ? 403 : 400, { code: e.code, message: e.message, details: null, hint: null }); }
      }
      const m = /^\/rest\/v1\/(projects|shares|project_members|invites)$/.exec(path);
      if (m) {
        const table = 'public.' + m[1], cols = (u.searchParams.get('select') || '*').split(',').filter((c) => /^[a-z_*]+$/.test(c)).join(', ') || '*';
        const where = [], args = [];
        for (const [k, v] of u.searchParams) { if (['select', 'order', 'limit', 'columns'].includes(k)) continue; if (!/^[a-z_]+$/.test(k) || !v.startsWith('eq.')) return send(400, { message: 'unsupported filter ' + k }); args.push(v.slice(3)); where.push(`${k}::text = $${args.length}`); }
        const order = (u.searchParams.get('order') || '').match(/^([a-z_]+)\.(asc|desc)$/), limit = +u.searchParams.get('limit') || null;
        const single = /vnd\.pgrst\.object/.test(req.headers.accept || ''), minimal = !/return=representation/.test(req.headers.prefer || '') && req.method !== 'GET';
        let rows;
        try {
          rows = await as(uid, async (c) => {
            const w = where.length ? ' where ' + where.join(' and ') : '';
            if (req.method === 'GET') return (await c.query(`select ${cols} from ${table}${w}${order ? ` order by ${order[1]} ${order[2]}` : ''}${limit ? ' limit ' + limit : ''}`, args)).rows;
            const b = json(), keys = Object.keys(b).filter((k) => /^[a-z_]+$/.test(k));
            args.push(JSON.stringify(b)); const rec = `jsonb_populate_record(null::${table}, $${args.length}::jsonb)`;
            if (req.method === 'POST') return (await c.query(`insert into ${table} (${keys.join(', ')}) select ${keys.join(', ')} from ${rec} returning ${cols}`, args)).rows;
            if (req.method === 'PATCH') return (await c.query(`update ${table} t set ${keys.map((k) => `${k} = r.${k}`).join(', ')} from ${rec} r${w.replace(/(\w+)::text/g, 't.$1::text')} returning ${cols.split(', ').map((c2) => c2 === '*' ? 't.*' : 't.' + c2).join(', ')}`, args)).rows;
            if (req.method === 'DELETE') return (await c.query(`delete from ${table}${w} returning ${cols}`, args.slice(0, -1))).rows;
            throw new Error('method');
          });
        } catch (e) { return send(e.code === '42501' ? 403 : 400, { code: e.code, message: e.message, details: null, hint: null }); }
        if (minimal) return send(req.method === 'POST' ? 201 : 204);
        if (single) return rows.length === 1 ? send(200, rows[0]) : send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` });
        return send(req.method === 'POST' ? 201 : 200, rows);
      }

      /* ---------- storage ---------- */
      let s = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(path);
      if (s && req.method === 'GET') {
        const [, bucket, name] = s.map(decodeURIComponent);
        const pub = (await pool.query('select public from storage.buckets where id = $1', [bucket])).rows[0];
        const f = files.get(bucket + '/' + name);
        if (!pub || !pub.public || !f) return send(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
        return send(200, f.body, f.type);
      }
      s = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(path);
      if (s) {
        const [, bucket, name] = s.map(decodeURIComponent);
        if (req.method === 'POST') {
          try { await as(uid, (c) => c.query('insert into storage.objects (bucket_id, name) values ($1, $2)', [bucket, name])); }
          catch (e) {
            if (e.code === '23505') return send(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
            if (e.code === '42501') return send(400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
            throw e;
          }
          files.set(bucket + '/' + name, { body: raw, type: req.headers['content-type'] || 'application/octet-stream' });
          return send(200, { Key: bucket + '/' + name, Id: randomUUID() });
        }
        if (req.method === 'GET') {
          const ok = await as(uid, (c) => c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, name])).then((r) => r.rows.length > 0);
          const f = files.get(bucket + '/' + name);
          if (!ok || !f) return send(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
          return send(200, f.body, f.type);
        }
      }
      send(404, { message: 'not here: ' + req.method + ' ' + path });
    } catch (e) { send(500, { message: e.message }); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}`, anonKey: jwt({ role: 'anon', exp: Math.floor(Date.now() / 1000) + 86400 * 365 }),
    pool, files, codes, log, as,
    async stop() { await new Promise((r) => server.close(r)); await pool.end(); const a = new pg.Client({ database: 'postgres' }); await a.connect(); await a.query(`drop database if exists ${db} with (force)`); await a.end(); },
  };
}
