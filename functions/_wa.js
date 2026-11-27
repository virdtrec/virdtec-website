/*
 * Link WhatsApp per platform: /wa-yt, /wa-ig, /wa-fb, /wa-tt.
 * Dipasang di profil YouTube/Instagram/Facebook/TikTok. Setiap klik dicatat sebagai
 * "Klik WhatsApp" dengan sumber platformnya di Statistik admin, lalu langsung
 * diteruskan ke WhatsApp ViRdtec dengan pesan pembuka yang menyebut platform tersebut.
 * Tidak dicatat: bot/pembuat pratinjau link, dan perangkat yang memilih "jangan hitung".
 */
import { BOT, record, ensureSchema } from './api/hit.js';

const WA_NUMBER = '6289501816060';

export const PLATFORMS = {
  yt: { utm: 'youtube', name: 'YouTube' },
  ig: { utm: 'instagram', name: 'Instagram' },
  fb: { utm: 'facebook', name: 'Facebook' },
  tt: { utm: 'tiktok', name: 'TikTok' }
};

export function waTarget(name) {
  const text = 'Halo ViRdtec, saya lihat dari ' + name + ' dan ingin konsultasi instalasi EV charger.';
  return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
}

async function log(env, request, key) {
  const body = { t: 'wa', p: '/wa-' + key, r: request.headers.get('referer') || '', u: PLATFORMS[key].utm };
  try {
    await record(env.DB, request, body);
  } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await ensureSchema(env.DB);
    await record(env.DB, request, body);
  }
}

export function waRedirect(key) {
  return async function onRequest({ request, env, waitUntil }) {
    const ua = request.headers.get('user-agent') || '';
    const cookie = request.headers.get('cookie') || '';
    const skip = !env.DB || !ua || BOT.test(ua) || /(?:^|;\s*)virdtec_no_track=1/.test(cookie) ||
      request.method !== 'GET';
    if (!skip) waitUntil(log(env, request, key).catch(() => {}));
    return new Response(null, {
      status: 302,
      headers: { location: waTarget(PLATFORMS[key].name), 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
    });
  };
}
