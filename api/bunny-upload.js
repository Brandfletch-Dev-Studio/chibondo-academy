/**
 * /api/bunny-upload — Bunny.net video upload proxy (CommonJS)
 * Browser → Vercel → Bunny (avoids CORS on Bunny TUS endpoint)
 *
 * POST ?action=create  → create video slot, return videoId + embedUrl
 * POST ?action=chunk   → proxy a raw chunk to Bunny via PUT upload
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'X-Bunny-VideoId','X-Bunny-LibraryId','X-Bunny-ApiKey',
    'X-Upload-Offset','X-Upload-Length','X-Is-Last',
  ].join(', '));

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  // Read raw body (works for both JSON and binary)
  async function readBody() {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  try {
    // ── CREATE: register video with Bunny ────────────────────────────────
    if (action === 'create') {
      const raw = await readBody();
      const { title, bunnyLibraryId, bunnyApiKey, lessonId } = JSON.parse(raw.toString());

      if (!title || !bunnyLibraryId || !bunnyApiKey) {
        return res.status(400).json({ error: 'title, bunnyLibraryId, bunnyApiKey required' });
      }

      const createRes = await fetch(
        `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos`,
        {
          method: 'POST',
          headers: { AccessKey: bunnyApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        }
      );
      const video = await createRes.json();
      if (!createRes.ok || !video.guid) {
        return res.status(502).json({ error: `Bunny rejected: ${video.message || JSON.stringify(video)}` });
      }

      return res.status(200).json({
        videoId:  video.guid,
        embedUrl: `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${video.guid}`,
        lessonId,
      });
    }

    // ── CHUNK: proxy raw video bytes to Bunny PUT upload ─────────────────
    if (action === 'chunk') {
      const videoId   = req.headers['x-bunny-videoid'];
      const libraryId = req.headers['x-bunny-libraryid'];
      const apiKey    = req.headers['x-bunny-apikey'];

      if (!videoId || !libraryId || !apiKey) {
        return res.status(400).json({ error: 'Missing X-Bunny-* headers' });
      }

      const chunkBuf = await readBody();

      // Use Bunny simple PUT upload (server-to-server, no CORS)
      const putRes = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
        {
          method:  'PUT',
          headers: {
            AccessKey:      apiKey,
            'Content-Type': 'application/octet-stream',
          },
          body: chunkBuf,
        }
      );

      if (!putRes.ok) {
        const txt = await putRes.text().catch(() => putRes.status.toString());
        return res.status(502).json({ error: `Bunny upload failed (${putRes.status}): ${txt}` });
      }

      return res.status(200).json({ done: true, received: chunkBuf.length });
    }

    return res.status(400).json({ error: 'Unknown action. Use ?action=create or ?action=chunk' });

  } catch (err) {
    console.error('[bunny-upload]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
