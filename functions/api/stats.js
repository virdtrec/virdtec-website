/*
 * GET /api/stats?days=30 — ringkasan statistik untuk halaman admin.
 * Hanya untuk admin: header "Authorization: Bearer <token GitHub>" dicek ke
 * GitHub, dan pemilik token harus ada di daftar ADMIN_GITHUB_USERS.
 */
import { ensureSchema, wibDay, SOURCE_ALIASES } from './hit.js';

// Older rows were stored as typed (instagram, instagram`, youtube); fold them into one name per channel
const Q = "'";
const SOURCE_SQL = 'CASE lower(replace(replace(replace(trim(COALESCE(source, ' + Q + Q + ')), char(96), ' + Q + Q +
  '), char(39), ' + Q + Q + '), char(34), ' + Q + Q + '))' +
  Object.keys(SOURCE_ALIASES).map((k) => ' WHEN ' + Q + k + Q + ' THEN ' + Q + SOURCE_ALIASES[k] + Q).join('') +
  ' ELSE source END';

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

function dayDiff(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);
}

// days: angka (1–KEEP_DAYS) atau 'all' = sejak data pertama tercatat
async function query(db, wanted) {
  const now = Date.now();
  const today = wibDay(now);
  const first = await db.prepare('SELECT MIN(day) AS d FROM hits').first();
  const firstDay = (first && first.d) || today;
  const all = wanted === 'all';
  const days = all ? Math.min(KEEP_DAYS, Math.max(1, dayDiff(firstDay, today) + 1)) : wanted;
  const start = wibDay(now - (days - 1) * 86400e3);
  const top = (expr, measure, extra = '') => db.prepare(
    `SELECT ${expr} AS k, ${measure} AS n FROM hits
     WHERE type = 'view' AND day >= ?1 ${extra}
     GROUP BY k ORDER BY n DESC LIMIT 8`
  ).bind(start);
  const visitors = 'COUNT(DISTINCT day || visitor)';

  const [totals, daily, sources, devices, locations, browsers, oses, pages, waSources, linkClicks, galleryViews, recent, hourly, monthly] = await db.batch([
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
    top(SOURCE_SQL, visitors),
    top('device', visitors),
    top(`COALESCE(city, '') || '|' || COALESCE(country, '')`, visitors),
    top('browser', visitors),
    top('os', visitors),
    top('path', 'COUNT(*)'),
    db.prepare(
      `SELECT ${SOURCE_SQL} AS k, COUNT(*) AS n FROM hits
       WHERE type = 'wa' AND day >= ?1 GROUP BY k ORDER BY n DESC LIMIT 8`
    ).bind(start),
    db.prepare(
      `SELECT path AS k, COUNT(*) AS n FROM hits
       WHERE type = 'link' AND day >= ?1 GROUP BY k ORDER BY n DESC LIMIT 12`
    ).bind(start),
    db.prepare(
      `SELECT path AS k, COUNT(*) AS n FROM hits
       WHERE type = 'gallery' AND day >= ?1 GROUP BY k ORDER BY n DESC LIMIT 12`
    ).bind(start),
    db.prepare(
      // "Hari ini": semua aktivitas hari ini; rentang lain: 120 aktivitas terakhir
      days === 1
        ? `SELECT ts, type, path, visitor, ${SOURCE_SQL} AS source, device, browser, os, city, country
           FROM hits WHERE day >= ?1 ORDER BY id DESC LIMIT 3000`
        : `SELECT ts, type, path, visitor, ${SOURCE_SQL} AS source, device, browser, os, city, country
           FROM hits WHERE ?1 IS NOT NULL ORDER BY id DESC LIMIT 120`
    ).bind(start),
    // Per jam (WIB) untuk tampilan "Hari ini"
    db.prepare(
      `SELECT CAST(strftime('%H', ts / 1000 + 25200, 'unixepoch') AS INTEGER) AS hour,
              SUM(type = 'view') AS views,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN visitor END) AS visitors,
              SUM(type = 'wa') AS wa
       FROM hits WHERE day = ?1 GROUP BY hour ORDER BY hour`
    ).bind(today),
    // Per bulan untuk tampilan "Sejak awal" (pengunjung = jumlah pengunjung unik harian)
    db.prepare(
      `SELECT substr(day, 1, 7) AS month,
              SUM(type = 'view') AS views,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN day || visitor END) AS visitors,
              SUM(type = 'wa') AS wa
       FROM hits WHERE day >= ?1 GROUP BY month ORDER BY month`
    ).bind(start)
  ]);

  return {
    days, start, today, all, first_day: firstDay,
    totals: totals.results[0] || { views: 0, visitors: 0, wa: 0 },
    daily: daily.results,
    top: {
      sources: sources.results, devices: devices.results, locations: locations.results,
      browsers: browsers.results, os: oses.results, pages: pages.results, waSources: waSources.results,
      linkClicks: linkClicks.results,
      galleryViews: galleryViews.results
    },
    recent: recent.results,
    hourly: hourly.results,
    monthly: monthly.results
  };
}

export async function onRequestGet({ request, env, waitUntil }) {
  if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'no_db' }, 503);

  const raw = new URL(request.url).searchParams.get('days');
  const days = raw === 'all' ? 'all' : Math.min(KEEP_DAYS, Math.max(1, parseInt(raw, 10) || 30));
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
