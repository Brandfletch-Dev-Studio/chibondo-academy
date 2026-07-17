/**
 * api/bunny-library.js
 * GET /api/bunny-library?libraryId=X&apiKey=Y&page=1&search=
 * Returns paginated list of videos in the Bunny Stream library
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { libraryId, apiKey, page = 1, search = '', perPage = 100 } = req.query || {};
  if (!libraryId || !apiKey) return res.status(400).json({ error: 'libraryId and apiKey required' });

  try {
    const params = new URLSearchParams({
      page,
      itemsPerPage: perPage,
      ...(search ? { search } : {}),
      orderBy: 'date',
    });

    const r = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos?${params}`,
      { headers: { AccessKey: apiKey }, signal: AbortSignal.timeout(15000) }
    );

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: `Bunny API error: ${err}` });
    }

    const data = await r.json();
    // data = { totalItems, currentPage, itemsPerPage, items: [...] }
    return res.status(200).json({
      total: data.totalItems,
      page: data.currentPage,
      perPage: data.itemsPerPage,
      videos: (data.items || []).map(v => ({
        id: v.guid,
        title: v.title,
        status: v.status, // 3/4 = ready
        duration: v.length,
        size: v.storageSize,
        thumbnail: v.thumbnailFileName
          ? `https://vz-${libraryId}.b-cdn.net/${v.guid}/${v.thumbnailFileName}`
          : null,
        embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${v.guid}`,
        created: v.dateUploaded,
        views: v.views,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
