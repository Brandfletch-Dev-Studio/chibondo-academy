/**
 * api/bunny-status.js
 * GET /api/bunny-status?libraryId=X&videoId=Y&apiKey=Z
 * Returns Bunny video processing status
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { libraryId, videoId, apiKey } = req.query || {};
  if (!libraryId || !videoId || !apiKey)
    return res.status(400).json({ error: 'libraryId, videoId, apiKey required' });

  try {
    const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      headers: { AccessKey: apiKey },
    });
    const data = await r.json();
    // status: 0=queued, 1=processing, 2=encoding, 3=finished, 4=resolution_finished, 5=failed
    const STATUS_MAP = { 0:'queued', 1:'processing', 2:'encoding', 3:'ready', 4:'ready', 5:'failed' };
    return res.status(200).json({
      status: STATUS_MAP[data.status] || 'unknown',
      statusCode: data.status,
      title: data.title,
      length: data.length,
      encodeProgress: data.encodeProgress || 0,
      availableResolutions: data.availableResolutions,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
