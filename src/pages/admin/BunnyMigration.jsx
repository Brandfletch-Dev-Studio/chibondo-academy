import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/api/supabaseClient';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import {
  RefreshCw, Settings, CheckCircle2, AlertCircle,
  Upload, Play, ExternalLink, Shield, Zap, Globe,
  ArrowRight, Copy, Check, ChevronRight, Loader2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const NAVY = '#0d1b4b';
const GOLD = '#D4AF37';

function getYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([^?#&\s]+)/,
    /youtube\.com\/watch\?v=([^?#&\s]+)/,
    /youtube\.com\/embed\/([^?#&\s]+)/,
    /youtube\.com\/shorts\/([^?#&\s]+)/,
  ];
  for (const p of patterns) { const m = url?.match(p); if (m) return m[1]; }
  return null;
}

function isBunny(url) {
  return url && (url.includes('iframe.mediadelivery.net') || url.includes('b-cdn.net'));
}

function StatusPill({ status }) {
  const cfg = {
    youtube:  { label: 'YouTube',  cls: 'bg-red-100 text-red-700 border-red-200' },
    bunny:    { label: '🐰 Bunny', cls: 'bg-green-100 text-green-700 border-green-200' },
    none:     { label: 'No video', cls: 'bg-muted text-muted-foreground border-border' },
  };
  const { label, cls } = cfg[status] || cfg.none;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function ProgressBar({ progress, status }) {
  const color = status === 'done' ? '#22c55e' : status === 'error' ? '#ef4444' : GOLD;
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${progress}%`, background: color }}
      />
    </div>
  );
}

export default function BunnyMigration() {
  const { user } = useOutletContext();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bunnyApiKey, setBunnyApiKey] = useState(() => localStorage.getItem('bunny_api_key') || '');
  const [bunnyLibraryId, setBunnyLibraryId] = useState(() => localStorage.getItem('bunny_lib_id') || '');
  const [filter, setFilter] = useState('youtube');
  const [jobs, setJobs] = useState({}); // lessonId → { status, progress, message, embedUrl }
  const [queue, setQueue] = useState([]); // lesson ids queued for bulk
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRef = useRef(false);

  const isAdmin = user?.role === 'admin';
  const hasSettings = bunnyApiKey && bunnyLibraryId;

  useEffect(() => { if (isAdmin) fetchLessons(); }, [isAdmin]);

  async function fetchLessons() {
    setLoading(true);
    try {
      const all = await db.entities.Lesson.list();
      setLessons(all || []);
    } catch { toast.error('Failed to load lessons'); }
    finally { setLoading(false); }
  }

  function saveSettings() {
    localStorage.setItem('bunny_api_key', bunnyApiKey);
    localStorage.setItem('bunny_lib_id', bunnyLibraryId);
    toast.success('Settings saved');
    setSettingsOpen(false);
  }

  function lessonStatus(l) {
    if (!l.video_url) return 'none';
    if (isBunny(l.video_url) || l.video_provider === 'bunny') return 'bunny';
    if (getYouTubeId(l.video_url)) return 'youtube';
    return 'none';
  }

  async function migrateLesson(lesson) {
    if (!hasSettings) { setSettingsOpen(true); toast.error('Enter Bunny credentials first'); return; }
    const ytId = getYouTubeId(lesson.video_url);
    if (!ytId) { toast.error('No YouTube URL on this lesson'); return; }

    setJobs(p => ({ ...p, [lesson.id]: { status: 'running', progress: 5, message: 'Fetching video info…' } }));

    try {
      // Simulate progress while waiting for the server
      const progressTimer = simulateProgress(lesson.id);

      const res = await fetch('/api/bunny-migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: lesson.video_url,
          lessonId: lesson.id,
          bunnyLibraryId,
          bunnyApiKey,
          title: lesson.title,
        }),
      });

      clearInterval(progressTimer);
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || 'Migration failed');

      setJobs(p => ({ ...p, [lesson.id]: { status: 'processing', progress: 95, message: '⏳ Bunny is processing the video…', embedUrl: data.embedUrl } }));
      setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, video_url: data.embedUrl, video_provider: 'bunny' } : l));
      toast.success(`${lesson.title} uploaded! Bunny is encoding… 🐰`);
      // Poll until Bunny finishes encoding
      pollUntilReady(lesson.id, data.videoId, data.embedUrl);

    } catch (err) {
      setJobs(p => ({ ...p, [lesson.id]: { status: 'error', progress: 100, message: err.message } }));
      toast.error(err.message);
    }
  }

  function simulateProgress(lessonId) {
    const stages = [
      { pct: 10, msg: 'Connecting to YouTube…', delay: 1500 },
      { pct: 25, msg: 'Getting video stream…', delay: 3000 },
      { pct: 40, msg: 'Creating Bunny video…', delay: 2000 },
      { pct: 55, msg: 'Uploading to Bunny CDN…', delay: 5000 },
      { pct: 70, msg: 'Streaming video data…', delay: 8000 },
      { pct: 85, msg: 'Finalising upload…', delay: 5000 },
      { pct: 92, msg: 'Almost done…', delay: 3000 },
    ];
    let i = 0;
    const advance = () => {
      if (i >= stages.length) return;
      const s = stages[i++];
      setJobs(p => {
        if (p[lessonId]?.status !== 'running') return p;
        return { ...p, [lessonId]: { ...p[lessonId], progress: s.pct, message: s.msg } };
      });
    };
    advance();
    const timer = setInterval(advance, 4000);
    return timer;
  }


  async function pollUntilReady(lessonId, videoId, embedUrl) {
    if (!bunnyLibraryId || !bunnyApiKey || !videoId) return;
    let attempts = 0;
    const maxAttempts = 40; // poll for up to ~3 min
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setJobs(p => ({ ...p, [lessonId]: { ...p[lessonId], status: 'done', progress: 100, message: '✓ Ready (check Bunny dashboard if not playing yet)' } }));
        return;
      }
      try {
        const r = await fetch(`/api/bunny-status?libraryId=${bunnyLibraryId}&videoId=${videoId}&apiKey=${bunnyApiKey}`);
        const d = await r.json();
        if (d.status === 'ready') {
          clearInterval(interval);
          setJobs(p => ({ ...p, [lessonId]: { status: 'done', progress: 100, message: `✓ Ready — ${d.availableResolutions || 'HD'}`, embedUrl } }));
          toast.success('Video is ready to play! ✅');
        } else if (d.status === 'failed') {
          clearInterval(interval);
          setJobs(p => ({ ...p, [lessonId]: { status: 'error', progress: 100, message: 'Bunny encoding failed. Try again.' } }));
        } else {
          const pct = Math.min(97, 95 + (d.encodeProgress || 0) * 0.02);
          setJobs(p => ({ ...p, [lessonId]: { ...p[lessonId], progress: pct, message: `⏳ Bunny ${d.status}… ${d.encodeProgress || 0}%` } }));
        }
      } catch (e) { /* silently retry */ }
    }, 5000);
  }

  async function runBulk() {
    const ytLessons = lessons.filter(l => lessonStatus(l) === 'youtube' && !jobs[l.id]);
    if (!ytLessons.length) { toast.info('No YouTube lessons left to migrate'); return; }
    setBulkRunning(true);
    bulkRef.current = true;
    toast.info(`Starting bulk migration of ${ytLessons.length} lessons…`);

    for (const lesson of ytLessons) {
      if (!bulkRef.current) break;
      await migrateLesson(lesson);
      await new Promise(r => setTimeout(r, 2000)); // small gap between uploads
    }

    setBulkRunning(false);
    bulkRef.current = false;
    toast.success('Bulk migration complete!');
  }

  function stopBulk() {
    bulkRef.current = false;
    setBulkRunning(false);
    toast.info('Bulk migration stopped');
  }

  const stats = lessons.reduce((a, l) => { a[lessonStatus(l)] = (a[lessonStatus(l)] || 0) + 1; return a; }, {});
  const ytCount = stats.youtube || 0;
  const bunnyCount = stats.bunny || 0;
  const totalPct = lessons.length ? Math.round((bunnyCount / lessons.filter(l => l.video_url).length) * 100) : 0;

  const filtered = lessons.filter(l => {
    if (filter === 'all') return !!l.video_url;
    return lessonStatus(l) === filter;
  });

  if (!isAdmin) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Admin only.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-28">

      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            🐰 YouTube → Bunny Auto-Migrator
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            One click migrates each video — no downloads, no manual steps
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLessons} disabled={loading}>
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(s => !s)}>
            <Settings className="w-3.5 h-3.5 mr-1" /> {hasSettings ? 'Settings ✓' : 'Setup'}
          </Button>
        </div>
      </div>

      {/* Settings */}
      {settingsOpen && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Bunny.net Credentials</h3>
            <a href="https://dash.bunny.net/stream" target="_blank" rel="noreferrer"
              className="text-xs text-primary underline flex items-center gap-0.5">
              dash.bunny.net <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Stream Library API Key
              </label>
              <Input type="password" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={bunnyApiKey} onChange={e => setBunnyApiKey(e.target.value)} className="text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">Stream Library → API → VideoAccessKey</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Library ID
              </label>
              <Input placeholder="e.g. 123456"
                value={bunnyLibraryId} onChange={e => setBunnyLibraryId(e.target.value)} className="text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">Stream Library → Settings → Library ID</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveSettings} style={{ background: NAVY, color: 'white' }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* No settings warning */}
      {!hasSettings && !settingsOpen && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Enter your Bunny.net credentials first. <button onClick={() => setSettingsOpen(true)} className="underline font-semibold">Open Settings →</button>
          </p>
        </div>
      )}

      {/* Why Bunny */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Shield, label: 'URL Protection', desc: 'Token auth — links expire, can\'t be shared' },
          { icon: Zap,    label: 'Africa CDN',      desc: 'South Africa edge node, fast in Malawi' },
          { icon: Globe,  label: '~$2/month',        desc: 'vs zero content control on YouTube' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-xl border bg-card p-3 text-center space-y-1">
            <Icon className="w-5 h-5 mx-auto text-primary" />
            <p className="text-xs font-semibold">{label}</p>
            <p className="text-[10px] text-muted-foreground leading-snug">{desc}</p>
          </div>
        ))}
      </div>

      {/* Progress overview */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Migration Progress</span>
          <span className="text-sm font-bold" style={{ color: GOLD }}>{bunnyCount}/{bunnyCount + ytCount} videos</span>
        </div>
        <ProgressBar progress={totalPct} status={ytCount === 0 ? 'done' : 'running'} />
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>🔴 {ytCount} YouTube remaining</span>
          <span>🟢 {bunnyCount} on Bunny</span>
        </div>

        {/* Bulk migrate button */}
        {ytCount > 0 && (
          <div className="flex gap-2 pt-1">
            {!bulkRunning ? (
              <Button
                size="sm"
                onClick={runBulk}
                disabled={!hasSettings}
                style={{ background: NAVY, color: 'white' }}
                className="gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Migrate All {ytCount} YouTube Videos
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={stopBulk}>
                Stop Migration
              </Button>
            )}
          </div>
        )}
        {ytCount === 0 && bunnyCount > 0 && (
          <p className="text-xs text-green-600 font-semibold">✓ All videos are on Bunny!</p>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'youtube', label: `YouTube (${ytCount})` },
          { key: 'bunny',   label: `Bunny (${bunnyCount})` },
          { key: 'all',     label: 'All' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              filter === key
                ? 'text-white border-transparent'
                : 'bg-card text-muted-foreground hover:bg-accent'
            )}
            style={filter === key ? { background: NAVY } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lesson list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading lessons…
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center py-10 text-muted-foreground text-sm">No lessons here.</p>
          )}
          {filtered.map(lesson => {
            const status = lessonStatus(lesson);
            const job = jobs[lesson.id];
            const ytId = getYouTubeId(lesson.video_url);
            const isDone = status === 'bunny';
            const isRunning = job?.status === 'running';
            const hasError = job?.status === 'error';

            return (
              <div
                key={lesson.id}
                className={cn(
                  'rounded-xl border bg-card p-4 space-y-2.5 transition-all',
                  isDone && 'border-green-200',
                  hasError && 'border-red-200',
                )}
              >
                {/* Lesson info */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusPill status={status} />
                      <span className="text-[10px] text-muted-foreground">{lesson.subject_name}</span>
                      {lesson.topic_title && <>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{lesson.topic_title}</span>
                      </>}
                    </div>
                    <p className="text-sm font-semibold leading-snug">{lesson.title}</p>
                  </div>

                  {/* Action button */}
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Done
                      </span>
                    ) : isRunning ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        style={{ background: NAVY, color: 'white' }}
                        onClick={() => migrateLesson(lesson)}
                        disabled={!hasSettings || bulkRunning}
                      >
                        <Upload className="w-3 h-3" /> Migrate
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar while running */}
                {job && (
                  <div className="space-y-1.5">
                    <ProgressBar progress={job.progress} status={job.status} />
                    <p className={cn(
                      'text-[11px]',
                      job.status === 'error' ? 'text-red-500' : 'text-muted-foreground'
                    )}>
                      {job.message}
                    </p>
                    {job.embedUrl && (
                      <p className="text-[10px] font-mono text-green-600 truncate">{job.embedUrl}</p>
                    )}
                  </div>
                )}

                {/* YouTube thumbnail preview */}
                {status === 'youtube' && ytId && !job && (
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt=""
                      className="w-20 h-12 rounded object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <a
                        href={`https://youtube.com/watch?v=${ytId}`}
                        target="_blank" rel="noreferrer"
                        className="text-[11px] text-primary underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> View on YouTube
                      </a>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">{ytId}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
