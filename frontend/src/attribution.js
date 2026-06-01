/**
 * Attribution — captures the first-touch source of a visitor so every lead
 * event knows where they came from.
 *
 * Stored in sessionStorage so it survives in-session navigation but resets
 * on each new visit (giving us per-visit attribution rather than first-ever).
 *
 * Use:
 *   import { getAttribution, attachAttributionToData } from './attribution';
 *   gtag('event', 'partner_quick_lead_submitted', { ...getAttribution() });
 *   await addDoc(coll, { ...formData, ...getAttribution() });
 */

const KEY = 'aayojan_attribution';

function readSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}

function writeSession(obj) {
  try { sessionStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}

/** Capture once per session — UTMs, referrer, landing page, timestamp. */
export function captureAttribution() {
  if (typeof window === 'undefined') return;
  if (readSession()) return; // already captured this session

  const params = new URLSearchParams(window.location.search);
  const ref = document.referrer || '';
  let referrerHost = '';
  try { if (ref) referrerHost = new URL(ref).hostname; } catch {}

  const data = {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content: params.get('utm_content') || '',
    utm_term: params.get('utm_term') || '',
    gclid: params.get('gclid') || '',         // Google Ads click id
    fbclid: params.get('fbclid') || '',       // Facebook click id
    referrer: ref,
    referrer_host: referrerHost,
    landing_page: window.location.pathname + window.location.search,
    landed_at: new Date().toISOString(),
  };

  // Channel inference: easy for queries / dashboards later
  if (data.utm_source) data.channel = `paid_${data.utm_source}`;
  else if (data.gclid) data.channel = 'google_ads';
  else if (data.fbclid) data.channel = 'facebook_ads';
  else if (referrerHost && !referrerHost.includes('aayojan')) {
    if (/google|bing|yahoo|duckduckgo/i.test(referrerHost)) data.channel = 'organic_search';
    else if (/facebook|instagram|twitter|x\.com|linkedin|youtube|t\.co/i.test(referrerHost)) data.channel = 'social';
    else if (/wa\.me|whatsapp/i.test(referrerHost)) data.channel = 'whatsapp';
    else data.channel = 'referral';
  } else if (!ref) {
    data.channel = 'direct';
  } else {
    data.channel = 'internal';
  }

  writeSession(data);
}

/** Returns the captured attribution dict (or empty if not captured yet). */
export function getAttribution() {
  return readSession() || {};
}

/** Convenience: returns the GA-event-flavored subset (flat keys, no PII). */
export function getAttributionForEvent() {
  const a = getAttribution();
  return {
    utm_source: a.utm_source || '',
    utm_medium: a.utm_medium || '',
    utm_campaign: a.utm_campaign || '',
    utm_content: a.utm_content || '',
    channel: a.channel || '',
    referrer_host: a.referrer_host || '',
    landing_page: a.landing_page || '',
  };
}

// Auto-capture as soon as this module loads
captureAttribution();
