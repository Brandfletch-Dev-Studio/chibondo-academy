import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/api/supabaseClient';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import {
  RefreshCw, Settings, CheckCircle2, Upload,
  ExternalLink, Shield, Zap, Globe, ArrowRight,
  Loader2, Info, Search, Link2, Play, X,
  ChevronRight, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const NAVY = '#0d1b4b';
const GOLD  = '#D4AF37';

// ── Helpers ──────────────────────────────────────────────────────────────────
function getYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([^?#&\s]+)/,
    /youtube\.com\/watch\?v=([^?#&\s]+)/,
    /youtube\.com\/embed\/([^?#&\s]+)/,
    /youtube\.com\/shorts\/([^?#&\s]+)/,
  ];
  for (const p of patterns) { const m = (url||'').match(p); if (m) return m[1]; }
  return null;
}
function isBunny(url) {
  return url && (url.includes('iframe.mediadelivery.net') || url.includes('b-cdn.net'));
}
function lessonStatus(l) {
  if (!l.video_url) return 'none';
  if (isBunny(l.video_url) || l.video_provider === 'bunny') return 'bunny';
  if (getYouTubeId(l.video_url)) return 'youtube';
  return 'none';
}
function fmtDur(s) {
  if (!s) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
function fmtSize(bytes) {
  if (!bytes) return '';
  return (bytes / 1024 / 1024).toFixed(0) + ' MB';
}

function StatusPill({ status }) {
  const cfg = {
    youtube: { label: 'YouTube', cls: 'bg-red-100 text-red-700' },
    bunny:   { label: '🐰 Bunny', cls: 'bg-green-100 text-green-700' },
    none:    { label: 'No video', cls: 'bg-muted text-muted-foreground' },
  };
  const { label, cls } = cfg[status] || cfg.none;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel({ apiKey, setApiKey, libraryId, setLibraryId, onSave, onClose }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Bunny.net Credentials</h3>
        <a href="https://dash.bunny.net/stream" target="_blank" rel="noreferrer"
          className="text-xs text-primary underline flex items-center gap-1">
          dash.bunny.net <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Stream Library API Key</label>
          <Input type="password" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={apiKey} onChange={e => setApiKey(e.target.value)} className="text-xs" />
          <p className="text-[10px] text-muted-foreground mt-1">Stream → Your Library → API → VideoAccessKey</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Library ID</label>
          <Input placeholder="e.g. 123456"
            value={libraryId} onChange={e => setLibraryId(e.target.value)} className="text-xs" />
          <p className="text-[10px] text-muted-foreground mt-1">Stream → Settings → Library ID (number)</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} style={{ background: NAVY, color: 'white' }}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Tab: Link Existing Bunny Videos ──────────────────────────────────────────
function LinkExistingTab({ lessons, setLessons, apiKey, libraryId }) {
  const [bunnyVideos, setBunnyVideos] = useState([]);
  const [loadingBunny, setLoadingBunny] = useState(false);
  const [bunnySearch, setBunnySearch] = useState('');
  const [lessonSearch, setLessonSearch] = useState('');
  const [selectedBunny, setSelectedBunny] = useState(null); // video object
  const [linking, setLinking] = useState(false);
  const [page, setPage] = useState(1);
  const [totalBunny, setTotalBunny] = useState(0);
  const PER_PAGE = 100;

  const fetchBunnyVideos = useCallback(async (p = 1, search = '') => {
    if (!apiKey || !libraryId) return;
    setLoadingBunny(true);
    try {
      const params = new URLSearchParams({ libraryId, apiKey, page: p, search, perPage: PER_PAGE });
      const r = await fetch(`/api/bunny-library?${params}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setBunnyVideos(data.videos || []);
      setTotalBunny(data.total || 0);
      setPage(p);
    } catch (e) {
      toast.error(`Failed to load Bunny library: ${e.message}`);
    } finally {
      setLoadingBunny(false);
    }
  }, [apiKey, libraryId]);

  useEffect(() => {
    if (apiKey && libraryId) fetchBunnyVideos(1, '');
  }, [apiKey, libraryId, fetchBunnyVideos]);

  const unlinkedLessons = lessons.filter(l => {
    const st = lessonStatus(l);
    const q = lessonSearch.toLowerCase();
    const matchSearch = !q || l.title?.toLowerCase().includes(q) ||
      l.subject_name?.toLowerCase().includes(q) || l.topic_title?.toLowerCase().includes(q);
    return st !== 'bunny' && matchSearch;
  });

  async function linkToLesson(lesson) {
    if (!selectedBunny) { toast.error('Select a Bunny video first'); return; }
    setLinking(true);
    try {
      await db.entities.Lesson.update(lesson.id, {
        video_url: selectedBunny.embedUrl,
        video_provider: 'bunny',
      });
      setLessons(prev => prev.map(l =>
        l.id === lesson.id ? { ...l, video_url: selectedBunny.embedUrl, video_provider: 'bunny' } : l
      ));
      toast.success(`✓ "${lesson.title}" linked to "${selectedBunny.title}"`);
      setSelectedBunny(null);
    } catch (e) {
      toast.error(`Link failed: ${e.message}`);
    } finally {
      setLinking(false);
    }
  }

  const filteredBunny = bunnyVideos.filter(v =>
    !bunnySearch || v.title?.toLowerCase().includes(bunnySearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* LEFT — Bunny Library */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            🐰 Bunny Library
            <span className="text-xs text-muted-foreground font-normal">({totalBunny} videos)</span>
          </h3>
          <Button size="sm" variant="outline" onClick={() => fetchBunnyVideos(1, bunnySearch)} disabled={loadingBunny}>
            <RefreshCw className={cn('w-3 h-3 mr-1', loadingBunny && 'animate-spin')} /> Refresh
          </Button>
        </div>

        <div className="flex gap-2">
          <Input placeholder="Search Bunny videos…" value={bunnySearch}
            onChange={e => setBunnySearch(e.target.value)} className="text-xs h-8" />
          <Button size="sm" variant="outline" className="h-8 px-2"
            onClick={() => fetchBunnyVideos(1, bunnySearch)}>
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>

        {!apiKey || !libraryId ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-center">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">Enter Bunny credentials in Settings first</p>
          </div>
        ) : loadingBunny ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {filteredBunny.length === 0 && (
                <p className="text-center py-8 text-xs text-muted-foreground">No videos found</p>
              )}
              {filteredBunny.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedBunny(sel => sel?.id === v.id ? null : v)}
                  className={cn(
                    'w-full text-left rounded-lg border p-2.5 flex items-center gap-3 transition-all',
                    selectedBunny?.id === v.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'bg-card hover:bg-accent'
                  )}
                >
                  {/* Thumbnail */}
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" className="w-14 h-9 rounded object-cover flex-shrink-0 bg-muted" />
                  ) : (
                    <div className="w-14 h-9 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Play className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate leading-snug">{v.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.duration && <span className="text-[10px] text-muted-foreground">{fmtDur(v.duration)}</span>}
                      {v.size && <span className="text-[10px] text-muted-foreground">{fmtSize(v.size)}</span>}
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                        v.status === 3 || v.status === 4 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      )}>
                        {v.status === 3 || v.status === 4 ? 'Ready' : 'Processing'}
                      </span>
                    </div>
                  </div>
                  {selectedBunny?.id === v.id && (
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalBunny > PER_PAGE && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Page {page} of {Math.ceil(totalBunny / PER_PAGE)}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-xs" disabled={page <= 1}
                    onClick={() => fetchBunnyVideos(page - 1, bunnySearch)}>Prev</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs" disabled={page * PER_PAGE >= totalBunny}
                    onClick={() => fetchBunnyVideos(page + 1, bunnySearch)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* RIGHT — Lessons to link */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            Lessons without Bunny
            <span className="text-xs text-muted-foreground font-normal ml-1">({unlinkedLessons.length})</span>
          </h3>
          {selectedBunny && (
            <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded-full px-2 py-1">
              <CheckCircle2 className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{selectedBunny.title}</span>
              <button onClick={() => setSelectedBunny(null)}><X className="w-3 h-3" /></button>
            </div>
          )}
        </div>

        <Input placeholder="Search lessons…" value={lessonSearch}
          onChange={e => setLessonSearch(e.target.value)} className="text-xs h-8" />

        {selectedBunny && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary mb-1">Selected: {selectedBunny.title}</p>
            <p className="text-[10px] text-muted-foreground">Click any lesson below to link it to this video</p>
          </div>
        )}

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {unlinkedLessons.length === 0 && (
            <p className="text-center py-8 text-xs text-muted-foreground">
              {lessonSearch ? 'No matching lessons' : 'All lessons are on Bunny! 🎉'}
            </p>
          )}
          {unlinkedLessons.map(lesson => (
            <div key={lesson.id} className="rounded-lg border bg-card p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <StatusPill status={lessonStatus(lesson)} />
                  <span className="text-[10px] text-muted-foreground truncate">{lesson.subject_name}</span>
                  {lesson.topic_title && (
                    <><ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground truncate">{lesson.topic_title}</span></>
                  )}
                </div>
                <p className="text-xs font-semibold leading-snug">{lesson.title}</p>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs gap-1 flex-shrink-0"
                style={selectedBunny ? { background: NAVY, color: 'white' } : {}}
                variant={selectedBunny ? 'default' : 'outline'}
                disabled={!selectedBunny || linking}
                onClick={() => linkToLesson(lesson)}
              >
                {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                Link
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Auto-Migrate YouTube → Bunny ────────────────────────────────────────
function AutoMigrateTab({ lessons, setLessons, apiKey, libraryId }) {
  const [jobs, setJobs] = useState({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRef = useRef(false);
  const [filter, setFilter] = useState('youtube');

  const ytLessons = lessons.filter(l => lessonStatus(l) === 'youtube');
  const filteredLessons = lessons.filter(l => {
    if (filter === 'all') return !!l.video_url;
    return lessonStatus(l) === filter;
  });

  function simulateProgress(lessonId) {
    const stages = [
      { p: 10, msg: 'Connecting to cobalt.tools…' },
      { p: 25, msg: 'Resolving video stream…' },
      { p: 45, msg: 'Creating Bunny video…' },
      { p: 65, msg: 'Bunny is fetching video…' },
      { p: 80, msg: 'Confirming upload…' },
      { p: 90, msg: 'Almost there…' },
    ];
    let i = 0;
    const advance = () => {
      if (i >= stages.length) return;
      const s = stages[i++];
      setJobs(p => p[lessonId]?.status === 'running'
        ? { ...p, [lessonId]: { ...p[lessonId], progress: s.p, message: s.msg } }
        : p
      );
    };
    advance();
    return setInterval(advance, 4000);
  }

  async function pollUntilReady(lessonId, videoId, embedUrl) {
    if (!libraryId || !apiKey || !videoId) return;
    let attempts = 0;
    const iv = setInterval(async () => {
      if (++attempts > 40) { clearInterval(iv); return; }
      try {
        const r = await fetch(`/api/bunny-status?libraryId=${libraryId}&videoId=${videoId}&apiKey=${apiKey}`);
        const d = await r.json();
        if (d.status === 'ready') {
          clearInterval(iv);
          setJobs(p => ({ ...p, [lessonId]: { status: 'done', progress: 100, message: `✓ Ready — ${d.availableResolutions || 'HD'}`, embedUrl } }));
          toast.success('Video ready! ✅');
        } else if (d.status === 'failed') {
          clearInterval(iv);
          setJobs(p => ({ ...p, [lessonId]: { status: 'error', progress: 100, message: 'Bunny encoding failed.' } }));
        } else {
          setJobs(p => ({ ...p, [lessonId]: { ...p[lessonId], progress: Math.min(97, 93 + (d.encodeProgress||0)*0.04), message: `⏳ Bunny ${d.status}… ${d.encodeProgress||0}%` } }));
        }
      } catch {}
    }, 5000);
  }

  async function migrateLesson(lesson) {
    if (!apiKey || !libraryId) { toast.error('Enter Bunny credentials in Settings'); return; }
    setJobs(p => ({ ...p, [lesson.id]: { status: 'running', progress: 5, message: 'Starting…' } }));
    const timer = simulateProgress(lesson.id);
    try {
      const r = await fetch('/api/bunny-migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: lesson.video_url, lessonId: lesson.id, bunnyLibraryId: libraryId, bunnyApiKey: apiKey, title: lesson.title }),
      });
      clearInterval(timer);
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(JSON.stringify(data));
      setJobs(p => ({ ...p, [lesson.id]: { status: 'processing', progress: 93, message: '⏳ Bunny processing…', embedUrl: data.embedUrl } }));
      setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, video_url: data.embedUrl, video_provider: 'bunny' } : l));
      toast.success(`Uploaded! Bunny encoding… 🐰`);
      pollUntilReady(lesson.id, data.videoId, data.embedUrl);
    } catch (err) {
      clearInterval(timer);
      let msg = err.message;
      let isUnlisted = false;
      try { const p = JSON.parse(msg); if (p.error === 'unlisted_not_accessible') { isUnlisted = true; msg = p.message; } } catch {}
      setJobs(p => ({ ...p, [lesson.id]: { status: 'error', progress: 100, message: msg, isUnlisted } }));
      toast.error(isUnlisted ? 'Unlisted — needs manual upload' : msg);
    }
  }

  async function runBulk() {
    const pending = ytLessons.filter(l => !jobs[l.id]);
    if (!pending.length) { toast.info('Nothing to migrate'); return; }
    setBulkRunning(true); bulkRef.current = true;
    for (const l of pending) {
      if (!bulkRef.current) break;
      await migrateLesson(l);
      await new Promise(r => setTimeout(r, 2000));
    }
    setBulkRunning(false); bulkRef.current = false;
    toast.success('Bulk migration done!');
  }

  return (
    <div className="space-y-4">
      {/* Filter + Bulk */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {[['youtube',`YouTube (${ytLessons.length})`],['bunny','Bunny'],['all','All']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={cn('px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
                filter===k ? 'text-white border-transparent' : 'bg-card text-muted-foreground hover:bg-accent')}
              style={filter===k ? {background:NAVY} : {}}>
              {l}
            </button>
          ))}
        </div>
        {!bulkRunning ? (
          <Button size="sm" onClick={runBulk} disabled={!apiKey||!libraryId||!ytLessons.length}
            style={{background:NAVY,color:'white'}} className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Migrate All {ytLessons.length}
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => { bulkRef.current=false; setBulkRunning(false); }}>
            Stop
          </Button>
        )}
      </div>

      {/* Lesson cards */}
      <div className="space-y-2">
        {filteredLessons.map(lesson => {
          const st = lessonStatus(lesson);
          const job = jobs[lesson.id];
          const ytId = getYouTubeId(lesson.video_url);

          return (
            <div key={lesson.id} className={cn('rounded-xl border bg-card p-4 space-y-2',
              st==='bunny' && !job && 'border-green-200',
              job?.status==='error' && 'border-red-200')}>

              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <StatusPill status={st} />
                    <span className="text-[10px] text-muted-foreground">{lesson.subject_name}</span>
                    {lesson.topic_title && <><ChevronRight className="w-2.5 h-2.5 text-muted-foreground"/><span className="text-[10px] text-muted-foreground">{lesson.topic_title}</span></>}
                  </div>
                  <p className="text-sm font-semibold">{lesson.title}</p>
                </div>
                <div className="flex-shrink-0">
                  {st==='bunny' && !job ? (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>Done</span>
                  ) : job?.status==='running' || job?.status==='processing' ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin"/>Working…</span>
                  ) : job?.status==='done' ? (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>Ready</span>
                  ) : (
                    <Button size="sm" className="h-7 text-xs gap-1" style={{background:NAVY,color:'white'}}
                      disabled={!apiKey||!libraryId||bulkRunning}
                      onClick={() => migrateLesson(lesson)}>
                      <Upload className="w-3 h-3"/>Migrate
                    </Button>
                  )}
                </div>
              </div>

              {job && (
                <div className="space-y-1.5">
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all duration-500"
                      style={{width:`${job.progress}%`, background: job.status==='error' ? '#ef4444' : job.status==='done' ? '#22c55e' : GOLD}}/>
                  </div>
                  <p className={cn('text-[11px]', job.status==='error'?'text-red-500':'text-muted-foreground')}>
                    {job.message}
                  </p>
                  {job.isUnlisted && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3"/> Unlisted video — needs manual upload
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Download from YouTube → upload to <a href={`https://dash.bunny.net/stream/${libraryId}`} target="_blank" rel="noreferrer" className="underline">your Bunny library</a> → paste the embed URL:
                      </p>
                      <div className="flex gap-2">
                        <input id={`m-${lesson.id}`} type="text" placeholder="https://iframe.mediadelivery.net/embed/..."
                          className="flex-1 text-[11px] border rounded px-2 py-1 bg-background min-w-0"/>
                        <button onClick={async () => {
                          const url = document.getElementById(`m-${lesson.id}`)?.value?.trim();
                          if (!url) return;
                          await db.entities.Lesson.update(lesson.id, {video_url:url, video_provider:'bunny'});
                          setLessons(prev => prev.map(l => l.id===lesson.id ? {...l,video_url:url,video_provider:'bunny'} : l));
                          setJobs(p => ({...p,[lesson.id]:{status:'done',progress:100,message:'✓ Linked manually',embedUrl:url}}));
                          toast.success('Lesson updated!');
                        }} className="text-[11px] px-3 py-1 rounded font-semibold text-white" style={{background:NAVY}}>
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {st==='youtube' && ytId && !job && (
                <div className="flex items-center gap-3">
                  <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt=""
                    className="w-20 h-12 rounded object-cover flex-shrink-0"/>
                  <a href={`https://youtube.com/watch?v=${ytId}`} target="_blank" rel="noreferrer"
                    className="text-[11px] text-primary underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3"/> YouTube
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BunnyMigration() {
  const { user } = useOutletContext();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('bunny_api_key') || '');
  const [libraryId, setLibraryId] = useState(() => localStorage.getItem('bunny_lib_id') || '');
  const [tab, setTab] = useState('link'); // 'link' | 'migrate'

  const isAdmin = user?.role === 'admin';
  const hasSettings = apiKey && libraryId;

  useEffect(() => { if (isAdmin) fetchLessons(); }, [isAdmin]);

  async function fetchLessons() {
    setLoading(true);
    try { setLessons(await db.entities.Lesson.list() || []); }
    catch { toast.error('Failed to load lessons'); }
    finally { setLoading(false); }
  }

  function saveSettings() {
    localStorage.setItem('bunny_api_key', apiKey);
    localStorage.setItem('bunny_lib_id', libraryId);
    toast.success('Settings saved');
    setSettingsOpen(false);
  }

  const stats = lessons.reduce((a,l) => { a[lessonStatus(l)] = (a[lessonStatus(l)]||0)+1; return a; }, {});
  const pct = lessons.filter(l=>l.video_url).length
    ? Math.round(((stats.bunny||0) / lessons.filter(l=>l.video_url).length) * 100) : 0;

  if (!isAdmin) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Admin only.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold">🐰 Bunny Video Manager</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Link existing Bunny videos or migrate from YouTube</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLessons} disabled={loading}>
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(s=>!s)}>
            <Settings className="w-3.5 h-3.5 mr-1" />
            {hasSettings ? '✓ Settings' : 'Setup'}
          </Button>
        </div>
      </div>

      {/* Settings */}
      {settingsOpen && (
        <SettingsPanel apiKey={apiKey} setApiKey={setApiKey}
          libraryId={libraryId} setLibraryId={setLibraryId}
          onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
      )}

      {!hasSettings && !settingsOpen && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Enter your Bunny credentials first. <button onClick={() => setSettingsOpen(true)} className="underline font-semibold">Open Settings →</button>
          </p>
        </div>
      )}

      {/* Stats bar */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Overall Progress</span>
          <span className="text-sm font-bold" style={{color:GOLD}}>{stats.bunny||0}/{(stats.bunny||0)+(stats.youtube||0)} on Bunny</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
          <div className="h-2.5 rounded-full transition-all duration-700"
            style={{width:`${pct}%`, background: pct===100 ? '#22c55e' : GOLD}}/>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            {label:'On Bunny 🟢', val:stats.bunny||0, color:'text-green-600'},
            {label:'YouTube 🔴', val:stats.youtube||0, color:'text-red-600'},
            {label:'No video ⚪', val:stats.none||0, color:'text-muted-foreground'},
          ].map(({label,val,color})=>(
            <div key={label} className="rounded-lg border bg-card/50 py-2">
              <p className={`text-xl font-bold ${color}`}>{val}</p>
              <p className="text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border bg-muted">
        {[
          { key: 'link', label: '🔗 Link Existing Bunny Videos' },
          { key: 'migrate', label: '⬆️ Auto-Migrate from YouTube' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
              tab===key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" /> Loading…
        </div>
      ) : tab === 'link' ? (
        <LinkExistingTab lessons={lessons} setLessons={setLessons} apiKey={apiKey} libraryId={libraryId} />
      ) : (
        <AutoMigrateTab lessons={lessons} setLessons={setLessons} apiKey={apiKey} libraryId={libraryId} />
      )}
    </div>
  );
}
