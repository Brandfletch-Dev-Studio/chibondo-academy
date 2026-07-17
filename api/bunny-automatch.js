/**
 * api/bunny-automatch.js
 * POST { bunnyLibraryId, bunnyApiKey, dryRun? }
 *
 * 1. Fetches all videos from Bunny (paginated)
 * 2. Fetches all lessons from Supabase
 * 3. Fuzzy-matches by title (normalised, token-overlap score)
 * 4. For matches above threshold: updates lesson video_url, video_provider,
 *    video_duration, estimated_minutes in Supabase
 * 5. Returns full match report
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// ── Fuzzy match helpers ──────────────────────────────────────────────────────
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str) {
  const stopWords = new Set(['of','the','a','an','in','on','and','or','to','is',
    'for','with','by','from','as','at','be','it','its','that','this','what',
    'how','lesson','part','topic','unit','chapter','video','introduction','intro',
    'class','form','msce','book','section','module']);
  return normalize(str).split(' ').filter(t => t.length > 1 && !stopWords.has(t));
}

function jaccardScore(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 && tb.size === 0) return 0;
  const intersection = [...ta].filter(t => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

function containsScore(a, b) {
  // Check if all tokens of shorter string appear in the longer one
  const ta = tokenize(a);
  const tb = new Set(tokenize(b));
  if (ta.length === 0) return 0;
  const matches = ta.filter(t => tb.has(t)).length;
  return matches / ta.length;
}

function matchScore(bunnyTitle, lessonTitle) {
  const j = jaccardScore(bunnyTitle, lessonTitle);
  const c1 = containsScore(bunnyTitle, lessonTitle);
  const c2 = containsScore(lessonTitle, bunnyTitle);
  // Weight jaccard 50%, contains 50%
  return Math.max(j * 0.5 + Math.max(c1, c2) * 0.5);
}

// ── Fetch all Bunny videos (paginated) ───────────────────────────────────────
async function fetchAllBunnyVideos(libraryId, apiKey) {
  const videos = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const params = new URLSearchParams({ page, itemsPerPage: perPage, orderBy: 'date' });
    const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos?${params}`, {
      headers: { AccessKey: apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Bunny API error ${r.status}`);
    const data = await r.json();
    videos.push(...(data.items || []));
    if (videos.length >= data.totalItems || (data.items || []).length < perPage) break;
    page++;
  }
  return videos;
}

// ── Fetch all lessons from Supabase ─────────────────────────────────────────
async function fetchAllLessons() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/lessons?select=id,title,video_url,video_provider,topic_title,subject_name&limit=2000`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!r.ok) throw new Error(`Supabase lessons fetch failed: ${await r.text()}`);
  return r.json();
}

// ── Update a lesson in Supabase ──────────────────────────────────────────────
async function updateLesson(lessonId, updates) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/lessons?id=eq.${lessonId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(updates),
  });
  return r.ok;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { bunnyLibraryId, bunnyApiKey, dryRun = false, threshold = 0.35 } = req.body || {};
  if (!bunnyLibraryId || !bunnyApiKey)
    return res.status(400).json({ error: 'bunnyLibraryId and bunnyApiKey required' });

  try {
    // 1. Fetch everything in parallel
    const [bunnyVideos, lessons] = await Promise.all([
      fetchAllBunnyVideos(bunnyLibraryId, bunnyApiKey),
      fetchAllLessons(),
    ]);

    console.log(`[automatch] ${bunnyVideos.length} Bunny videos, ${lessons.length} lessons`);

    // 2. For each lesson (without Bunny), find best Bunny match
    const results = [];
    const usedVideoIds = new Set(); // prevent one Bunny video matching multiple lessons

    // Sort lessons: unlinked first
    const unlinked = lessons.filter(l => !l.video_url || !l.video_url.includes('mediadelivery.net'));
    const linked   = lessons.filter(l =>  l.video_url &&  l.video_url.includes('mediadelivery.net'));

    for (const lesson of unlinked) {
      let bestScore = 0;
      let bestVideo = null;

      for (const video of bunnyVideos) {
        if (usedVideoIds.has(video.guid)) continue;
        const score = matchScore(video.title, lesson.title);
        if (score > bestScore) {
          bestScore = score;
          bestVideo = video;
        }
      }

      const matched = bestScore >= threshold && bestVideo;
      const embedUrl = matched
        ? `https://iframe.mediadelivery.net/embed/${bunnyLibraryId}/${bestVideo.guid}`
        : null;
      const durationSec = matched ? (bestVideo.length || 0) : 0;
      const estimatedMin = durationSec ? Math.ceil(durationSec / 60) : null;

      results.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        subjectName: lesson.subject_name,
        topicTitle: lesson.topic_title,
        matched,
        score: Math.round(bestScore * 100),
        bunnyVideoId: matched ? bestVideo.guid : null,
        bunnyTitle: matched ? bestVideo.title : null,
        bunnyStatus: matched ? bestVideo.status : null,
        embedUrl,
        durationSec,
        estimatedMin,
      });

      if (matched) usedVideoIds.add(bestVideo.guid);
    }

    // Already-linked lessons — still update their duration if missing
    for (const lesson of linked) {
      // Extract video ID from embed URL
      const m = lesson.video_url?.match(/embed\/\d+\/([a-f0-9-]+)/);
      if (!m) continue;
      const vid = bunnyVideos.find(v => v.guid === m[1]);
      if (vid && vid.length) {
        results.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          subjectName: lesson.subject_name,
          matched: true,
          score: 100,
          bunnyVideoId: vid.guid,
          bunnyTitle: vid.title,
          alreadyLinked: true,
          embedUrl: lesson.video_url,
          durationSec: vid.length || 0,
          estimatedMin: vid.length ? Math.ceil(vid.length / 60) : null,
        });
      }
    }

    // 3. Apply updates (unless dryRun)
    let updated = 0;
    let durationUpdated = 0;
    if (!dryRun) {
      const toUpdate = results.filter(r => r.matched && (r.embedUrl || r.durationSec));
      await Promise.all(
        toUpdate.map(async r => {
          const updates = {};
          if (!r.alreadyLinked && r.embedUrl) {
            updates.video_url = r.embedUrl;
            updates.video_provider = 'bunny';
          }
          if (r.durationSec) {
            updates.video_duration = r.durationSec;
          }
          if (r.estimatedMin) {
            updates.estimated_minutes = r.estimatedMin;
          }
          if (Object.keys(updates).length > 0) {
            const ok = await updateLesson(r.lessonId, updates);
            if (ok) {
              if (!r.alreadyLinked) updated++;
              if (r.durationSec) durationUpdated++;
            }
          }
        })
      );
    }

    const matchedCount = results.filter(r => r.matched && !r.alreadyLinked).length;
    const noMatch = results.filter(r => !r.matched);

    return res.status(200).json({
      success: true,
      dryRun,
      stats: {
        bunnyVideos: bunnyVideos.length,
        totalLessons: lessons.length,
        newlyMatched: matchedCount,
        alreadyLinked: linked.length,
        noMatch: noMatch.length,
        updated,
        durationUpdated,
      },
      matches: results.filter(r => r.matched && !r.alreadyLinked),
      noMatches: noMatch.map(r => ({ lessonId: r.lessonId, lessonTitle: r.lessonTitle, subjectName: r.subjectName })),
    });

  } catch (err) {
    console.error('[automatch]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
