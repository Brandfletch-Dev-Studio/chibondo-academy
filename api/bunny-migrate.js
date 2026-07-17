/**
 * api/bunny-migrate.js  — v3 (unlisted YouTube support)
 *
 * For unlisted YouTube videos, Invidious fails.
 * Strategy (in order of preference):
 *   1. cobalt.tools API  — supports unlisted, no auth needed, returns direct URL
 *   2. Pass the YouTube watch URL directly to Bunny fetch (Bunny has YT support)
 *   3. If both fail, return a clear error with manual instructions
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

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

// Strategy 1: cobalt.tools — free API, supports unlisted YouTube videos
async function getUrlViaCobalt(youtubeUrl) {
  const cobaltInstances = [
    'https://api.cobalt.tools',
    'https://cobalt.api.timelessnesses.me',
  ];

  for (const base of cobaltInstances) {
    try {
      const res = await fetch(`${base}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          url: youtubeUrl,
          videoQuality: '720',
          audioFormat: 'mp3',
          filenameStyle: 'basic',
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) continue;
      const data = await res.json();

      // cobalt returns { status: 'stream'|'redirect'|'picker', url, ... }
      if (data.url && (data.status === 'stream' || data.status === 'redirect' || data.status === 'tunnel')) {
        return data.url;
      }
      if (data.status === 'picker' && data.picker?.[0]?.url) {
        return data.picker[0].url;
      }
    } catch (e) {
      console.log(`cobalt ${base} failed: ${e.message}`);
    }
  }
  return null;
}

// Strategy 2: Pass YouTube watch URL straight to Bunny fetch
// Bunny's backend can handle YouTube URLs in some cases
async function tryBunnyFetchYoutube({ libraryId, apiKey, videoId, youtubeUrl }) {
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/fetch`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: youtubeUrl }),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  return { ok: res.ok, text };
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
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/fetch`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sourceUrl }),
    signal: AbortSignal.timeout(12000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bunny fetch failed (${res.status}): ${text}`);
  return text;
}

async function updateSupabaseLesson(lessonId, embedUrl) {
  if (!lessonId || !SUPABASE_URL || !SUPABASE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/lessons?id=eq.${lessonId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ video_url: embedUrl, video_provider: 'bunny' }),
  });
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
  if (!ytId) return res.status(400).json({ error: `Cannot parse YouTube ID from: ${youtubeUrl}` });

  const watchUrl = `https://www.youtube.com/watch?v=${ytId}`;

  try {
    // Create the Bunny video object first
    const title = customTitle || `Lesson ${ytId}`;
    const videoId = await createBunnyVideo({ libraryId: bunnyLibraryId, apiKey: bunnyApiKey, title });
    const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}`;

    let method = null;
    let directUrl = null;

    // --- Strategy 1: cobalt.tools (best for unlisted) ---
    console.log(`[bunny-migrate] Trying cobalt for: ${ytId}`);
    directUrl = await getUrlViaCobalt(watchUrl);
    if (directUrl) {
      method = 'cobalt';
      console.log(`[bunny-migrate] cobalt succeeded — fetching into Bunny`);
      await fetchIntoBunny({ libraryId: bunnyLibraryId, apiKey: bunnyApiKey, videoId, sourceUrl: directUrl });
    }

    // --- Strategy 2: Let Bunny try to fetch YouTube directly ---
    if (!directUrl) {
      console.log(`[bunny-migrate] cobalt failed, trying Bunny direct YouTube fetch`);
      const { ok, text } = await tryBunnyFetchYoutube({
        libraryId: bunnyLibraryId, apiKey: bunnyApiKey, videoId, youtubeUrl: watchUrl,
      });
      if (ok) {
        method = 'bunny-direct';
        console.log(`[bunny-migrate] Bunny direct fetch accepted`);
      } else {
        // Both failed — delete the empty video object we created
        await fetch(`https://video.bunnycdn.com/library/${bunnyLibraryId}/videos/${videoId}`, {
          method: 'DELETE',
          headers: { AccessKey: bunnyApiKey },
        });
        return res.status(422).json({
          error: 'unlisted_not_accessible',
          message: 'This video is unlisted and could not be accessed automatically. Please download it and upload manually to Bunny.',
          youtubeId: ytId,
          manualUrl: `https://dash.bunny.net/stream/${bunnyLibraryId}`,
        });
      }
    }

    // Update Supabase
    await updateSupabaseLesson(lessonId, embedUrl);

    return res.status(200).json({
      success: true,
      videoId,
      embedUrl,
      title,
      method,
      note: 'Bunny is processing the video. It will be ready in 1-3 minutes.',
    });

  } catch (err) {
    console.error('[bunny-migrate]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
