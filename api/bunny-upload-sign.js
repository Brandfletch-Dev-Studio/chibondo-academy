/**
 * api/bunny-upload-sign.js
 * POST { title, lessonId, bunnyLibraryId, bunnyApiKey, fileSize }
 *
 * Creates a Bunny Stream video object and returns:
 *   { videoId, uploadUrl, embedUrl, signature, expiry }
 *
 * The browser then uploads the file directly to Bunny via TUS protocol.
 * This avoids routing video bytes through Vercel (which has a 4.5MB body limit).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, lessonId, bunnyLibraryId, bunnyApiKey } = req.body || {};
  if (!title || !bunnyLibraryId || !bunnyApiKey)
    return res.status(400).json({ error: 'title, bunnyLibraryId, bunnyApiKey required' });

  try {
    // 1. Create a video shell on Bunny Stream
    const createRes = await fetch(`https://video.bunnycdn.com/library/${bunnyLibraryId}/videos`, {
      method: 'POST',
      headers: { AccessKey: bunnyApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const video = await createRes.json();
    if (!createRes.ok || !video.guid)
      throw new Error(`Bunny create failed: ${video.message || JSON.stringify(video)}`);

    const videoId = video.guid;
    const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}`;

    // 2. Build TUS upload URL — Bunny TUS endpoint is:
    //    https://video.bunnycdn.com/tusupload
    //    with headers: AuthorizationSignature, AuthorizationExpire, LibraryId, VideoId
    // We generate the signature server-side so the apiKey is never exposed to the browser
    const expiryTs = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const crypto = await import('crypto');
    const signature = crypto
      .createHash('sha256')
      .update(bunnyLibraryId + bunnyApiKey + expiryTs + videoId)
      .digest('hex');

    return res.status(200).json({
      success: true,
      videoId,
      embedUrl,
      lessonId,
      // TUS headers the browser needs to upload directly
      tusUrl: 'https://video.bunnycdn.com/tusupload',
      authSignature: signature,
      authExpiry: expiryTs,
      libraryId: bunnyLibraryId,
      // Do NOT return apiKey — signature is enough
    });
  } catch (err) {
    console.error('[bunny-upload-sign]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
