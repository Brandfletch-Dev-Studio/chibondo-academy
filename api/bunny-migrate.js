/**
 * api/bunny-migrate.js
 * POST { youtubeUrl, lessonId, bunnyLibraryId, bunnyApiKey, title }
 *
 * Flow:
 *  1. Fetch YouTube video info via oEmbed + invidious API (no API key needed)
 *  2. Get a direct MP4 stream URL via Invidious public instance
 *  3. Create a video object on Bunny Stream
 *  4. Stream the MP4 bytes from YouTube → Bunny upload endpoint
 *  5. Update the lesson record in Supabase with the new Bunny embed URL
 *  6. Return { success, bunnyVideoId, embedUrl }
 */

const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// ── helpers ───────────────────────────────────────────────────────────────────
function getYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([^?#&\s]+)/,
    /youtube\.com\/watch\?v=([^?#&\s]+)/,
    /youtube\.com\/embed\/([^?#&\s]+)/,
    /youtube\.com\/shorts\/([^?#&\s]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.request(url, { ...options, timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    if (options.body) req.write(options.body);
    req.end();
  });
}

function streamRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.request(url, { ...options, timeout: 60000 }, resolve);
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Stream timeout')));
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Get direct video URL via Invidious (public YouTube frontend, no API key)
async function getVideoStream(ytId) {
  // Try multiple public Invidious instances
  const instances = [
    'https://inv.nadeko.net',
    'https://invidious.privacydev.net',
    'https://yt.cdaut.de',
    'https://invidious.fdn.fr',
  ];

  for (const instance of instances) {
    try {
      const data = await fetchJson(`${instance}/api/v1/videos/${ytId}?fields=title,lengthSeconds,adaptiveFormats,formatStreams`);
      if (data.formatStreams || data.adaptiveFormats) {
        // Prefer 720p mp4, fallback to 360p, then any mp4
        const streams = [...(data.formatStreams || []), ...(data.adaptiveFormats || [])];
        const mp4 = streams.filter(s => s.container === 'mp4' || s.type?.includes('video/mp4'));
        const p720 = mp4.find(s => s.quality === 'hd720' || s.qualityLabel === '720p');
        const p480 = mp4.find(s => s.qualityLabel === '480p');
        const p360 = mp4.find(s => s.quality === 'medium' || s.qualityLabel === '360p');
        const chosen = p720 || p480 || p360 || mp4[0];
        if (chosen) {
          return {
            url: chosen.url,
            title: data.title,
            duration: data.lengthSeconds,
            quality: chosen.qualityLabel || chosen.quality,
          };
        }
      }
    } catch (e) {
      console.log(`Instance ${instance} failed: ${e.message}`);
    }
  }
  throw new Error('Could not get video stream from any Invidious instance. The video may be private or region-blocked.');
}

// Create a video on Bunny Stream and upload via TUS or direct PUT
async function uploadToBunny({ streamUrl, title, libraryId, apiKey }) {
  // Step 1: Create video object on Bunny
  const created = await fetchJson(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      'AccessKey': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!created.guid) throw new Error(`Bunny create failed: ${JSON.stringify(created)}`);
  const videoId = created.guid;
  console.log(`Created Bunny video: ${videoId}`);

  // Step 2: Stream the YouTube video bytes directly to Bunny upload endpoint
  // Bunny accepts a direct PUT with the video bytes
  const videoStream = await streamRequest(streamUrl, { method: 'GET' });

  await new Promise((resolve, reject) => {
    const uploadReq = https.request(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      method: 'PUT',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/octet-stream',
      },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error(`Bunny upload failed ${res.statusCode}: ${body}`));
      });
    });

    uploadReq.on('error', reject);
    videoStream.pipe(uploadReq);
    videoStream.on('error', reject);
  });

  return videoId;
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { youtubeUrl, lessonId, bunnyLibraryId, bunnyApiKey, title: customTitle } = req.body || {};

    if (!youtubeUrl || !bunnyLibraryId || !bunnyApiKey) {
      return res.status(400).json({ error: 'Missing required fields: youtubeUrl, bunnyLibraryId, bunnyApiKey' });
    }

    const ytId = getYouTubeId(youtubeUrl);
    if (!ytId) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log(`Starting migration: ${ytId}`);

    // 1. Get stream URL
    const { url: streamUrl, title: ytTitle, quality } = await getVideoStream(ytId);
    const title = customTitle || ytTitle || `Lesson ${ytId}`;
    console.log(`Got stream: ${quality} — ${title}`);

    // 2. Upload to Bunny
    const videoId = await uploadToBunny({ streamUrl, title, libraryId: bunnyLibraryId, apiKey: bunnyApiKey });
    const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}`;

    // 3. Update lesson in Supabase if lessonId provided
    if (lessonId && SUPABASE_URL && SUPABASE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      const { error } = await supabase
        .from('lessons')
        .update({ video_url: embedUrl, video_provider: 'bunny' })
        .eq('id', lessonId);
      if (error) console.error('Supabase update failed:', error);
    }

    return res.status(200).json({
      success: true,
      videoId,
      embedUrl,
      title,
      quality,
      message: 'Video uploaded to Bunny successfully. Processing may take 1-2 minutes.',
    });

  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: err.message || 'Migration failed' });
  }
};
