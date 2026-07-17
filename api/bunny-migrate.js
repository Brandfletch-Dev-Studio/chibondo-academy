/**
 * api/bunny-migrate.js
 *
 * Architecture:
 *   1. Hit Invidious (open YouTube proxy) to get a direct MP4 stream URL
 *   2. Create a video on Bunny Stream
 *   3. Tell Bunny to FETCH the video from that URL (Bunny pulls it server-side)
 *   4. Update the lesson in Supabase with the new embed URL
 *   5. Return immediately — Bunny processes async, usually done in 1-2 min
 *
 * Uses only native fetch — no external packages required.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://yt.cdaut.de',
  'https://invidious.fdn.fr',
  'https://iv.datura.network',
];

function getYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([^?#&\s]+)/,
    /youtube\.com\/watch\?v=([^?#&\s]+)/,
    /youtube\.com\/embed\/([^?#&\s]+)/,
    /youtube\.com\/shorts\/([^?#&\s]+)/,
  ];
  for (const p of patterns) {
    const m = (url || '').match(p);
    if (m) return m[1];
  }
  return null;
}

async function getDirectVideoUrl(ytId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(
        `${base}/api/v1/videos/${ytId}?fields=title,lengthSeconds,formatStreams,adaptiveFormats`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();

      const all = [...(data.formatStreams || []), ...(data.adaptiveFormats || [])];
      // Want combined audio+video mp4 (formatStreams), prefer 720p → 480p → 360p
      const mp4 = all.filter(s =>
        (s.container === 'mp4' || (s.type || '').includes('video/mp4')) &&
        s.url && !s.audioQuality // skip audio-only adaptive streams
      );
      const pick =
        mp4.find(s => s.qualityLabel === '720p') ||
        mp4.find(s => s.qualityLabel === '480p') ||
        mp4.find(s => s.qualityLabel === '360p') ||
        mp4[0];

      if (pick) {
        return {
          url: pick.url,
          title: data.title || ytId,
          quality: pick.qualityLabel || pick.quality || 'SD',
          duration: data.lengthSeconds,
        };
      }
    } catch (e) {
      console.log(`Invidious ${base} failed: ${e.message}`);
    }
  }
  throw new Error('Could not retrieve video stream. The video may be private, age-restricted, or unavailable.');
}

async function createBunnyVideo({ libraryId, apiKey, title }) {
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  if (!res.ok || !data.guid) throw new Error(`Bunny create failed: ${data.message || JSON.stringify(data)}`);
  return data.guid;
}

async function fetchIntoBunny({ libraryId, apiKey, videoId, sourceUrl }) {
  // Bunny "fetch" endpoint — Bunny pulls the video from the source URL themselves
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/fetch`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sourceUrl }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bunny fetch failed (${res.status}): ${text}`);
  return text;
}

async function updateSupabaseLesson(lessonId, embedUrl) {
  if (!lessonId || !SUPABASE_URL || !SUPABASE_KEY) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lessons?id=eq.${lessonId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ video_url: embedUrl, video_provider: 'bunny' }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Supabase update failed:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { youtubeUrl, lessonId, bunnyLibraryId, bunnyApiKey, title: customTitle } = req.body || {};

  if (!youtubeUrl)     return res.status(400).json({ error: 'youtubeUrl is required' });
  if (!bunnyLibraryId) return res.status(400).json({ error: 'bunnyLibraryId is required' });
  if (!bunnyApiKey)    return res.status(400).json({ error: 'bunnyApiKey is required' });

  const ytId = getYouTubeId(youtubeUrl);
  if (!ytId) return res.status(400).json({ error: `Could not parse YouTube ID from: ${youtubeUrl}` });

  try {
    // 1. Get direct video URL from Invidious
    const { url: sourceUrl, title: ytTitle, quality, duration } = await getDirectVideoUrl(ytId);
    const title = customTitle || ytTitle;

    // 2. Create video shell on Bunny
    const videoId = await createBunnyVideo({ libraryId: bunnyLibraryId, apiKey: bunnyApiKey, title });

    // 3. Tell Bunny to fetch the video (async on their end)
    await fetchIntoBunny({ libraryId: bunnyLibraryId, apiKey: bunnyApiKey, videoId, sourceUrl });

    // 4. Build embed URL
    const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}`;

    // 5. Update lesson in Supabase
    await updateSupabaseLesson(lessonId, embedUrl);

    return res.status(200).json({
      success: true,
      videoId,
      embedUrl,
      title,
      quality,
      duration,
      note: 'Bunny is now processing the video. It will be ready to play in 1-3 minutes.',
    });

  } catch (err) {
    console.error('[bunny-migrate]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
