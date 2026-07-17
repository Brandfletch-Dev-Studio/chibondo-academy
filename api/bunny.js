/**
 * api/bunny.js  — unified Bunny.net router
 * Replaces: bunny-library, bunny-status, bunny-upload-sign, bunny-automatch, bunny-migrate
 *
 * Routes via ?action= query param:
 *   GET  ?action=library        → list videos
 *   GET  ?action=status         → video encoding status
 *   POST ?action=sign           → create video + return TUS headers
 *   POST ?action=automatch      → fuzzy-match & link lessons
 *   POST ?action=migrate        → YouTube → Bunny via cobalt.tools
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// ── CORS helper ──────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Fuzzy match helpers ──────────────────────────────────────────────────────
function normalize(s) {
  return (s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function tokenize(s) {
  const stop = new Set(['of','the','a','an','in','on','and','or','to','is','for','with','by',
    'from','as','at','be','it','its','that','this','what','how','lesson','part','topic',
    'unit','chapter','video','introduction','intro','class','form','msce','book','section','module']);
  return normalize(s).split(' ').filter(t => t.length > 1 && !stop.has(t));
}
function matchScore(a, b) {
  const ta = new Set(tokenize(a)), tb = new Set(tokenize(b));
  if (!ta.size && !tb.size) return 0;
  const inter = [...ta].filter(t => tb.has(t)).length;
  const union = new Set([...ta,...tb]).size;
  const j = union ? inter/union : 0;
  const c1 = ta.size ? inter/ta.size : 0;
  const c2 = tb.size ? [...tb].filter(t=>ta.has(t)).length/tb.size : 0;
  return j*0.5 + Math.max(c1,c2)*0.5;
}

// ── Fetch all Bunny videos ───────────────────────────────────────────────────
async function fetchBunnyVideos(libraryId, apiKey) {
  const videos = []; let page = 1;
  while (true) {
    const r = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=100&orderBy=date`,
      { headers: { AccessKey: apiKey }, signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) throw new Error(`Bunny API ${r.status}`);
    const d = await r.json();
    videos.push(...(d.items||[]));
    if (videos.length >= d.totalItems || (d.items||[]).length < 100) break;
    page++;
  }
  return videos;
}

// ── action=library ───────────────────────────────────────────────────────────
async function handleLibrary(req, res) {
  const { libraryId, apiKey, page=1, search='', perPage=100 } = req.query||{};
  if (!libraryId||!apiKey) return res.status(400).json({error:'libraryId and apiKey required'});
  const params = new URLSearchParams({page, itemsPerPage:perPage, orderBy:'date', ...(search?{search}:{})});
  const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos?${params}`,
    {headers:{AccessKey:apiKey}, signal:AbortSignal.timeout(15000)});
  if (!r.ok) return res.status(r.status).json({error:await r.text()});
  const d = await r.json();
  return res.status(200).json({
    total: d.totalItems, page: d.currentPage, perPage: d.itemsPerPage,
    videos: (d.items||[]).map(v => ({
      id: v.guid, title: v.title, status: v.status,
      duration: v.length, size: v.storageSize,
      thumbnail: v.thumbnailFileName
        ? `https://vz-${libraryId}.b-cdn.net/${v.guid}/${v.thumbnailFileName}` : null,
      embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${v.guid}`,
      created: v.dateUploaded, views: v.views,
    })),
  });
}

// ── action=status ────────────────────────────────────────────────────────────
async function handleStatus(req, res) {
  const { libraryId, videoId, apiKey } = req.query||{};
  if (!libraryId||!videoId||!apiKey) return res.status(400).json({error:'libraryId, videoId, apiKey required'});
  const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    {headers:{AccessKey:apiKey}});
  const d = await r.json();
  const STATUS = {0:'queued',1:'processing',2:'encoding',3:'ready',4:'ready',5:'failed'};
  return res.status(200).json({
    status: STATUS[d.status]||'unknown', statusCode:d.status,
    title:d.title, length:d.length, encodeProgress:d.encodeProgress||0,
  });
}

// ── action=sign ──────────────────────────────────────────────────────────────
async function handleSign(req, res) {
  const { title, lessonId, bunnyLibraryId, bunnyApiKey } = req.body||{};
  if (!title||!bunnyLibraryId||!bunnyApiKey) return res.status(400).json({error:'title, bunnyLibraryId, bunnyApiKey required'});
  const createRes = await fetch(`https://video.bunnycdn.com/library/${bunnyLibraryId}/videos`,{
    method:'POST',
    headers:{AccessKey:bunnyApiKey,'Content-Type':'application/json'},
    body: JSON.stringify({title}),
  });
  const video = await createRes.json();
  if (!createRes.ok||!video.guid) throw new Error(`Bunny create failed: ${video.message||JSON.stringify(video)}`);
  const videoId = video.guid;
  const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}`;
  const expiryTs = Math.floor(Date.now()/1000)+3600;
  const crypto = await import('crypto');
  const signature = crypto.createHash('sha256')
    .update(bunnyLibraryId+bunnyApiKey+expiryTs+videoId).digest('hex');
  return res.status(200).json({
    success:true, videoId, embedUrl, lessonId,
    tusUrl:'https://video.bunnycdn.com/tusupload',
    authSignature:signature, authExpiry:expiryTs, libraryId:bunnyLibraryId,
  });
}

// ── action=automatch ─────────────────────────────────────────────────────────
async function handleAutomatch(req, res) {
  const { bunnyLibraryId, bunnyApiKey, dryRun=false, threshold=0.35 } = req.body||{};
  if (!bunnyLibraryId||!bunnyApiKey) return res.status(400).json({error:'bunnyLibraryId and bunnyApiKey required'});
  const [bunnyVideos, lessonsRes] = await Promise.all([
    fetchBunnyVideos(bunnyLibraryId, bunnyApiKey),
    fetch(`${SUPABASE_URL}/rest/v1/lessons?select=id,title,video_url,video_provider&limit=2000`,
      {headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}}),
  ]);
  const lessons = await lessonsRes.json();
  const unlinked = lessons.filter(l=>!(l.video_url||'').includes('mediadelivery.net'));
  const results = []; const used = new Set();
  for (const lesson of unlinked) {
    let best=0, bestVid=null;
    for (const v of bunnyVideos) {
      if (used.has(v.guid)) continue;
      const s = matchScore(v.title, lesson.title);
      if (s>best){best=s;bestVid=v;}
    }
    const matched = best>=threshold && bestVid;
    if (matched) used.add(bestVid.guid);
    results.push({
      lessonId:lesson.id, lessonTitle:lesson.title, matched,
      score:Math.round(best*100),
      bunnyVideoId:matched?bestVid.guid:null, bunnyTitle:matched?bestVid.title:null,
      embedUrl:matched?`https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${bestVid.guid}`:null,
      durationSec:matched?bestVid.length||0:0,
      estimatedMin:matched&&bestVid.length?Math.ceil(bestVid.length/60):null,
    });
  }
  let updated=0;
  if (!dryRun) {
    await Promise.all(results.filter(r=>r.matched&&r.embedUrl).map(async r=>{
      const body={video_url:r.embedUrl,video_provider:'bunny'};
      if(r.durationSec) body.video_duration=r.durationSec;
      if(r.estimatedMin) body.estimated_minutes=r.estimatedMin;
      const ok = await fetch(`${SUPABASE_URL}/rest/v1/lessons?id=eq.${r.lessonId}`,{
        method:'PATCH', headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,
        'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)});
      if(ok.ok) updated++;
    }));
  }
  return res.status(200).json({matched:results.filter(r=>r.matched).length, updated, dryRun, results});
}

// ── action=migrate (YouTube → Bunny via cobalt.tools) ───────────────────────
async function handleMigrate(req, res) {
  const { lessonId, youtubeUrl, bunnyLibraryId, bunnyApiKey, lessonTitle } = req.body||{};
  if (!lessonId||!youtubeUrl||!bunnyLibraryId||!bunnyApiKey)
    return res.status(400).json({error:'lessonId, youtubeUrl, bunnyLibraryId, bunnyApiKey required'});

  // 1. Resolve stream via cobalt.tools
  const cobalt = await fetch('https://api.cobalt.tools/', {
    method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({url:youtubeUrl,videoQuality:'1080',filenameStyle:'basic'}),
    signal:AbortSignal.timeout(20000),
  });
  const cobaltData = await cobalt.json();
  if (cobaltData.status==='error') return res.status(400).json({error:cobaltData.error?.code||'cobalt error'});
  const streamUrl = cobaltData.url;
  if (!streamUrl) return res.status(400).json({error:'No stream URL from cobalt'});

  // 2. Create video on Bunny
  const title = lessonTitle||`Lesson ${lessonId}`;
  const createRes = await fetch(`https://video.bunnycdn.com/library/${bunnyLibraryId}/videos`,{
    method:'POST', headers:{AccessKey:bunnyApiKey,'Content-Type':'application/json'},
    body:JSON.stringify({title}),
  });
  const video = await createRes.json();
  if (!createRes.ok||!video.guid) return res.status(500).json({error:`Bunny create failed: ${video.message}`});
  const videoId = video.guid;

  // 3. Kick off Bunny fetch-from-URL
  const fetchRes = await fetch(
    `https://video.bunnycdn.com/library/${bunnyLibraryId}/videos/${videoId}/fetch`,{
    method:'POST', headers:{AccessKey:bunnyApiKey,'Content-Type':'application/json'},
    body:JSON.stringify({url:streamUrl}),
  });
  const embedUrl = `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${videoId}`;

  // 4. Update lesson in Supabase
  await fetch(`${SUPABASE_URL}/rest/v1/lessons?id=eq.${lessonId}`,{
    method:'PATCH', headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,
    'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({video_url:embedUrl,video_provider:'bunny',bunny_video_id:videoId}),
  });

  return res.status(200).json({success:true, videoId, embedUrl,
    fetchStatus:fetchRes.ok?'started':'failed'});
}

// ── Main router ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res);
  if (req.method==='OPTIONS') return res.status(200).end();

  const action = req.query?.action || (req.body?.action);
  try {
    if (action==='library')    return await handleLibrary(req, res);
    if (action==='status')     return await handleStatus(req, res);
    if (action==='sign')       return await handleSign(req, res);
    if (action==='automatch')  return await handleAutomatch(req, res);
    if (action==='migrate')    return await handleMigrate(req, res);
    return res.status(400).json({error:'Missing ?action= (library|status|sign|automatch|migrate)'});
  } catch (err) {
    console.error(`[bunny:${action}]`, err.message);
    return res.status(500).json({error:err.message});
  }
}
