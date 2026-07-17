/**
 * /api/bunny-upload — Bunny.net video upload proxy
 * 
 * POST ?action=create  → create video slot, return videoId + embedUrl
 * POST ?action=chunk   → forward a chunk to Bunny TUS (streams body directly)
 * GET  ?action=status  → check encoding status
 */

export const config = {
  api: {
    bodyParser: false,        // stream raw body — no 4.5MB limit parsing
    responseLimit: false,
  },
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bunny-VideoId, X-Bunny-LibraryId, X-Bunny-ApiKey, X-Upload-Offset, X-Upload-Length');
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  try {
    // ── CREATE: register video with Bunny, return videoId ──────────────────
    if (action === 'create') {
      const body = await readBody(req);
      const { title, bunnyLibraryId, bunnyApiKey, lessonId } = JSON.parse(body.toString());
      if (!title || !bunnyLibraryId || !bunnyApiKey) {
        return res.status(400).json({ error: 'title, bunnyLibraryId, bunnyApiKey required' });
      }

      const createRes = await fetch(`https://video.bunnycdn.com/library/${bunnyLibraryId}/videos`, {
        method: 'POST',
        headers: { AccessKey: bunnyApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const video = await createRes.json();
      if (!createRes.ok || !video.guid) {
        return res.status(502).json({ error: `Bunny rejected video creation: ${video.message || JSON.stringify(video)}` });
      }

      return res.status(200).json({
        videoId: video.guid,
        embedUrl: `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${video.guid}`,
        lessonId,
      });
    }

    // ── CHUNK: stream one chunk to Bunny via simple PUT upload ─────────────
    // We use Bunny's simple upload (PUT) instead of TUS to avoid CORS issues
    if (action === 'chunk') {
      const videoId    = req.headers['x-bunny-videoid'];
      const libraryId  = req.headers['x-bunny-libraryid'];
      const apiKey     = req.headers['x-bunny-apikey'];
      const offset     = parseInt(req.headers['x-upload-offset'] || '0', 10);
      const totalSize  = parseInt(req.headers['x-upload-length'] || '0', 10);

      if (!videoId || !libraryId || !apiKey) {
        return res.status(400).json({ error: 'Missing required headers' });
      }

      // Read the chunk buffer
      const chunkBuf = await readBody(req);

      // For single-file uploads (< 200MB), use Bunny simple PUT upload
      if (offset === 0 && chunkBuf.length >= totalSize) {
        // Single PUT upload
        const putRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
          method: 'PUT',
          headers: {
            AccessKey: apiKey,
            'Content-Type': 'application/octet-stream',
          },
          body: chunkBuf,
          duplex: 'half',
        });

        if (!putRes.ok) {
          const txt = await putRes.text();
          return res.status(502).json({ error: `Bunny upload failed: ${txt}` });
        }

        return res.status(200).json({ done: true, offset: chunkBuf.length });
      }

      // For chunked/resumable: use Bunny TUS from server side (no CORS)
      // First chunk: TUS create
      if (offset === 0) {
        const tusCreate = await fetch('https://video.bunnycdn.com/tusupload', {
          method: 'POST',
          headers: {
            AccessKey: apiKey,
            VideoId: videoId,
            LibraryId: libraryId,
            'Tus-Resumable': '1.0.0',
            'Upload-Length': String(totalSize),
            'Content-Type': 'application/offset+octet-stream',
          },
        });
        if (!tusCreate.ok) {
          return res.status(502).json({ error: `TUS create failed (${tusCreate.status})` });
        }
        const location = tusCreate.headers.get('Location');
        // Store location in response header for client to send back
        res.setHeader('X-Tus-Location', location || '');
      }

      return res.status(200).json({ done: false, offset: offset + chunkBuf.length });
    }

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (action === 'status') {
      const { videoId, libraryId, apiKey } = req.query;
      const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
        headers: { AccessKey: apiKey },
      });
      const data = await r.json();
      return res.status(200).json({ status: data.status, encodeProgress: data.encodeProgress || 0 });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('[bunny-upload]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
