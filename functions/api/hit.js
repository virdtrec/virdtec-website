/*
 * POST /api/hit — mencatat 1 kunjungan halaman atau 1 klik WhatsApp.
 * Dipanggil dari js/main.js (navigator.sendBeacon). Data disimpan di
 * Cloudflare D1 (binding "DB"). Tanpa cookie; IP tidak disimpan — pengunjung
 * dikenali dengan hash harian (IP + browser + tanggal + salt acak).
 */

// Hanya browser sungguhan yang menjalankan JavaScript yang mengirim data; ini menyaring bot yang tersisa
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|python|curl|wget|httpclient/i;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS hits (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     ts INTEGER NOT NULL,
     day TEXT NOT NULL,
     type TEXT NOT NULL,
     path TEXT,
     visitor TEXT,
     referrer TEXT,
     source TEXT,
     country TEXT,
     city TEXT,
     device TEXT,
     browser TEXT,
     os TEXT
   )`,
  'CREATE INDEX IF NOT EXISTS idx_hits_day ON hits(day)',
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)'
];

export async function ensureSchema(db) {
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
}

// Tanggal dalam zona WIB (UTC+7)
export function wibDay(ms) {
  return new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
}

function sourceOf(utm, ref) {
  if (utm) return utm.slice(0, 40);
  if (!ref) return 'Langsung';
  const rules = [
    [/(^|\.)google\./, 'Google'], [/bing\.com$/, 'Bing'], [/yahoo\./, 'Yahoo'], [/duckduckgo/, 'DuckDuckGo'],
    [/instagram\.com$/, 'Instagram'], [/(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'], [/(whatsapp|wa\.me)/, 'WhatsApp'],
    [/tiktok\.com$/, 'TikTok'], [/youtube\.com$|youtu\.be$/, 'YouTube'], [/(t\.co|twitter\.com|x\.com)$/, 'X / Twitter'],
    [/(chatgpt\.com|openai\.com)$/, 'ChatGPT'], [/perplexity\.ai$/, 'Perplexity'],
    [/claude\.ai$/, 'Claude'], [/copilot\.microsoft\.com$/, 'Copilot']
  ];
  // Gemini harus dicek sebelum Google
  if (/gemini\.google\.com$/.test(ref)) return 'Gemini';
  for (const [re, name] of rules) if (re.test(ref)) return name;
  return ref.slice(0, 60);
}

function deviceOf(ua) {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'Tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'HP';
  return 'Komputer';
}
function browserOf(ua) {
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/FBAN|FBAV|Instagram/i.test(ua)) return 'Aplikasi Instagram/Facebook';
  if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
  if (/Chrome|CriOS/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua)) return 'Safari';
  return 'Lainnya';
}
function osOf(ua) {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Lainnya';
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getSalt(db) {
  const row = await db.prepare("SELECT v FROM meta WHERE k = 'salt'").first();
  if (row) return row.v;
  const salt = crypto.randomUUID();
  await db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('salt', ?)").bind(salt).run();
  return (await db.prepare("SELECT v FROM meta WHERE k = 'salt'").first()).v;
}

async function record(db, request, body) {
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';
  const cf = request.cf || {};
  const now = Date.now();
  const day = wibDay(now);
  const ownHost = hostOf(request.url);
  let ref = hostOf(body.r);
  if (ref === ownHost) ref = '';
  const visitor = (await sha256((await getSalt(db)) + '|' + day + '|' + ip + '|' + ua)).slice(0, 16);

  await db.prepare(
    `INSERT INTO hits (ts, day, type, path, visitor, referrer, source, country, city, device, browser, os)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    now, day, body.t === 'wa' ? 'wa' : 'view',
    String(body.p || '/').slice(0, 200), visitor, ref || null,
    sourceOf(String(body.u || '').trim().toLowerCase(), ref),
    cf.country || null, cf.city || null,
    deviceOf(ua), browserOf(ua), osOf(ua)
  ).run();
}

export async function onRequestPost({ request, env }) {
  const done = new Response(null, { status: 204 });
  if (!env.DB) return done;
  if (BOT.test(request.headers.get('user-agent') || '')) return done;

  // Hanya terima dari website ini sendiri
  const origin = request.headers.get('origin');
  if (origin && hostOf(origin) !== hostOf(request.url)) return done;

  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return done; }
  if (!body || typeof body !== 'object') return done;

  try {
    await record(env.DB, request, body);
  } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await ensureSchema(env.DB);
    await record(env.DB, request, body);
  }
  return done;
}
