/*
 * GET /api/stats?days=30 — ringkasan statistik untuk halaman admin.
 * Hanya untuk admin: header "Authorization: Bearer <token GitHub>" dicek ke
 * GitHub, dan pemilik token harus ada di daftar ADMIN_GITHUB_USERS.
 */
import { ensureSchema, wibDay } from './hit.js';

const DEFAULT_ADMINS = 'virdtrec';
const KEEP_DAYS = 400;
const authCache = new Map(); // token-hash -> expiry (ms), agar tidak cek GitHub setiap kali

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isAdmin(request, env) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!m) return false;
  const key = await sha256(m[1]);
  const exp = authCache.get(key);
  if (exp && exp > Date.now()) return true;

  const res = await fetch((env.GITHUB_API || 'https://api.github.com') + '/user', {
    headers: {
      'authorization': 'Bearer ' + m[1],
      'accept': 'application/vnd.github+json',
      'user-agent': 'virdtec-website-stats'
    }
  });
  if (!res.ok) return false;
  const user = await res.json();
  const admins = String(env.ADMIN_GITHUB_USERS || DEFAULT_ADMINS)
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!user || admins.indexOf(String(user.login || '').toLowerCase()) < 0) return false;
  authCache.set(key, Date.now() + 10 * 60e3);
  return true;
}

async function query(db, days) {
  const now = Date.now();
  const start = wibDay(now - (days - 1) * 86400e3);
  const today = wibDay(now);
  const top = (expr, measure, extra = '') => db.prepare(
    `SELECT ${expr} AS k, ${measure} AS n FROM hits
     WHERE type = 'view' AND day >= ?1 ${extra}
     GROUP BY k ORDER BY n DESC LIMIT 8`
  ).bind(start);
  const visitors = 'COUNT(DISTINCT day || visitor)';

  const [totals, daily, sources, devices, locations, browsers, oses, pages, waSources, recent] = await db.batch([
    db.prepare(
      `SELECT SUM(type = 'view') AS views,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN day || visitor END) AS visitors,
              SUM(type = 'wa') AS wa
       FROM hits WHERE day >= ?1`
    ).bind(start),
    db.prepare(
      `SELECT day, SUM(type = 'view') AS views,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN visitor END) AS visitors,
              SUM(type = 'wa') AS wa
       FROM hits WHERE day >= ?1 GROUP BY day ORDER BY day`
    ).bind(start),
    top('source', visitors),
    top('device', visitors),
    top(`COALESCE(city, '') || '|' || COALESCE(country, '')`, visitors),
    top('browser', visitors),
    top('os', visitors),
    top('path', 'COUNT(*)'),
    db.prepare(
      `SELECT source AS k, COUNT(*) AS n FROM hits
       WHERE type = 'wa' AND day >= ?1 GROUP BY k ORDER BY n DESC LIMIT 8`
    ).bind(start),
    db.prepare(
      `SELECT ts, type, path, source, device, browser, os, city, country
       FROM hits ORDER BY id DESC LIMIT 25`
    )
  ]);

  return {
    days, start, today,
    totals: totals.results[0] || { views: 0, visitors: 0, wa: 0 },
    daily: daily.results,
    top: {
      sources: sources.results, devices: devices.results, locations: locations.results,
      browsers: browsers.results, os: oses.results, pages: pages.results, waSources: waSources.results
    },
    recent: recent.results
  };
}

export async function onRequestGet({ request, env, waitUntil }) {
  if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'no_db' }, 503);

  const days = Math.min(365, Math.max(1, parseInt(new URL(request.url).searchParams.get('days'), 10) || 30));
  let data;
  try {
    data = await query(env.DB, days);
  } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await ensureSchema(env.DB);
    data = await query(env.DB, days);
  }

  // Bersihkan data yang sangat lama sesekali
  if (Math.random() < 0.1) {
    waitUntil(env.DB.prepare('DELETE FROM hits WHERE day < ?').bind(wibDay(Date.now() - KEEP_DAYS * 86400e3)).run());
  }
  return json(data);
}
