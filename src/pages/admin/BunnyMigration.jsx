import React, { useState, useEffect } from 'react';
import { db } from '@/api/supabaseClient';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Video, ExternalLink, CheckCircle2, Clock, AlertCircle,
  Upload, RefreshCw, Play, ChevronDown, ChevronUp, Settings,
  Zap, Shield, Globe, ArrowRight, Copy, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── helpers ──────────────────────────────────────────────────────────────────
function getYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?#&]+)/,
    /youtube\.com\/watch\?v=([^?#&]+)/,
    /youtube\.com\/embed\/([^?#&]+)/,
    /youtube\.com\/shorts\/([^?#&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isBunnyUrl(url) {
  return url && (url.includes('iframe.mediadelivery.net') || url.includes('b-cdn.net') || url.includes('bunny.net'));
}

function StatusBadge({ status }) {
  const map = {
    youtube:   { label: 'YouTube',   color: 'bg-red-100 text-red-700' },
    bunny:     { label: 'Bunny ✓',   color: 'bg-green-100 text-green-700' },
    migrated:  { label: 'Migrated',  color: 'bg-green-100 text-green-700' },
    pending:   { label: 'Pending…',  color: 'bg-yellow-100 text-yellow-700' },
    none:      { label: 'No Video',  color: 'bg-gray-100 text-gray-500' },
  };
  const { label, color } = map[status] || map.none;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BunnyMigration() {
  const { user } = useOutletContext();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bunnyApiKey, setBunnyApiKey] = useState(() => localStorage.getItem('bunny_api_key') || '');
  const [bunnyLibraryId, setBunnyLibraryId] = useState(() => localStorage.getItem('bunny_library_id') || '');
  const [bunnyPullZone, setBunnyPullZone] = useState(() => localStorage.getItem('bunny_pull_zone') || '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [updating, setUpdating] = useState({});
  const [manualUrls, setManualUrls] = useState({});
  const [copied, setCopied] = useState(null);
  const [filter, setFilter] = useState('all'); // all | youtube | bunny | none

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    fetchLessons();
  }, [isAdmin]);

  async function fetchLessons() {
    setLoading(true);
    try {
      const all = await db.entities.Lesson.list();
      setLessons(all || []);
    } catch (e) {
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  }

  function saveSettings() {
    localStorage.setItem('bunny_api_key', bunnyApiKey);
    localStorage.setItem('bunny_library_id', bunnyLibraryId);
    localStorage.setItem('bunny_pull_zone', bunnyPullZone);
    toast.success('Bunny settings saved');
    setSettingsOpen(false);
  }

  function getLessonStatus(lesson) {
    if (!lesson.video_url) return 'none';
    if (isBunnyUrl(lesson.video_url) || lesson.video_provider === 'bunny') return 'bunny';
    if (lesson.video_provider === 'youtube' || getYouTubeId(lesson.video_url)) return 'youtube';
    return 'none';
  }

  // Apply manual Bunny embed URL to a lesson
  async function applyBunnyUrl(lesson) {
    const url = manualUrls[lesson.id]?.trim();
    if (!url) { toast.error('Paste the Bunny embed URL first'); return; }
    if (!isBunnyUrl(url) && !url.includes('iframe')) {
      toast.error('That doesn\'t look like a Bunny embed URL');
      return;
    }
    setUpdating(p => ({ ...p, [lesson.id]: true }));
    try {
      await db.entities.Lesson.update(lesson.id, {
        video_url: url,
        video_provider: 'bunny',
      });
      setLessons(prev => prev.map(l =>
        l.id === lesson.id ? { ...l, video_url: url, video_provider: 'bunny' } : l
      ));
      setManualUrls(p => { const n = {...p}; delete n[lesson.id]; return n; });
      toast.success(`✓ ${lesson.title} migrated to Bunny`);
    } catch (e) {
      toast.error('Failed to update lesson');
    } finally {
      setUpdating(p => ({ ...p, [lesson.id]: false }));
    }
  }

  // Reset a bunny lesson back to YouTube (undo)
  async function resetToYoutube(lesson, ytUrl) {
    setUpdating(p => ({ ...p, [lesson.id]: true }));
    try {
      await db.entities.Lesson.update(lesson.id, {
        video_url: ytUrl,
        video_provider: 'youtube',
      });
      setLessons(prev => prev.map(l =>
        l.id === lesson.id ? { ...l, video_url: ytUrl, video_provider: 'youtube' } : l
      ));
      toast.success('Reset to YouTube');
    } catch (e) {
      toast.error('Reset failed');
    } finally {
      setUpdating(p => ({ ...p, [lesson.id]: false }));
    }
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const stats = lessons.reduce((acc, l) => {
    const s = getLessonStatus(l);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const filtered = lessons.filter(l => {
    if (filter === 'all') return l.video_url;
    return getLessonStatus(l) === filter;
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-2xl">🐰</span> Bunny Migration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Migrate YouTube videos to Bunny.net for protected, fast delivery
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLessons} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(s => !s)}>
            <Settings className="w-4 h-4 mr-1" /> Settings
          </Button>
        </div>
      </div>

      {/* Why Bunny info card */}
      <div className="rounded-xl border bg-card p-4 grid grid-cols-3 gap-4 text-center text-sm">
        <div className="flex flex-col items-center gap-1">
          <Shield className="w-6 h-6 text-primary" />
          <span className="font-semibold">Token Auth</span>
          <span className="text-xs text-muted-foreground">URLs expire — can't be shared</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-semibold">Africa CDN</span>
          <span className="text-xs text-muted-foreground">South Africa edge, fast in Malawi</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Globe className="w-6 h-6 text-primary" />
          <span className="font-semibold">~$2/month</span>
          <span className="text-xs text-muted-foreground">vs YouTube's zero control</span>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Bunny.net Credentials</h3>
          <p className="text-xs text-muted-foreground">
            Get these from <a href="https://dash.bunny.net" target="_blank" rel="noreferrer" className="underline text-primary">dash.bunny.net</a> → Stream → Your Library → API
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
              <Input
                type="password"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={bunnyApiKey}
                onChange={e => setBunnyApiKey(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Library ID</label>
              <Input
                placeholder="123456"
                value={bunnyLibraryId}
                onChange={e => setBunnyLibraryId(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Pull Zone (hostname)</label>
              <Input
                placeholder="vz-xxxxxx.b-cdn.net"
                value={bunnyPullZone}
                onChange={e => setBunnyPullZone(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <Button size="sm" onClick={saveSettings}>Save Settings</Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'all',     label: 'Total w/ video', count: Object.values(stats).reduce((a,b)=>a+b,0), color: 'text-foreground' },
          { key: 'youtube', label: 'YouTube',         count: stats.youtube || 0,  color: 'text-red-600' },
          { key: 'bunny',   label: 'On Bunny',        count: stats.bunny || 0,    color: 'text-green-600' },
          { key: 'none',    label: 'No video',        count: stats.none || 0,     color: 'text-muted-foreground' },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-lg border bg-card p-3 text-center transition-all',
              filter === key ? 'ring-2 ring-primary' : 'hover:bg-accent'
            )}
          >
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* How-to guide */}
      <div className="rounded-xl border bg-card/50 p-4 text-sm space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><Play className="w-4 h-4 text-primary" /> How to migrate a lesson</h3>
        <ol className="space-y-1.5 text-muted-foreground list-none">
          {[
            'Sign up at bunny.net → Stream → Create a Library',
            'Upload the video file (download from YouTube first if needed)',
            'Open the video → copy the "Embed URL" (looks like: https://iframe.mediadelivery.net/embed/XXXXX/video-id)',
            'Paste it into the field next to the lesson below and click Migrate',
            'Done — the lesson now streams from Bunny with token protection',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Enable <strong>Token Authentication</strong> in your Bunny Stream library settings for maximum protection — URLs become time-limited and can't be shared outside ACA.
          </p>
        </div>
      </div>

      {/* Lesson list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading lessons…
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">No lessons match this filter.</p>
          )}
          {filtered.map(lesson => {
            const status = getLessonStatus(lesson);
            const ytId = getYouTubeId(lesson.video_url);
            const isUpdating = updating[lesson.id];

            return (
              <div key={lesson.id} className={cn(
                'rounded-xl border bg-card p-4 space-y-3',
                status === 'bunny' && 'border-green-200 bg-green-50/30 dark:bg-green-950/10'
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={status} />
                      <span className="text-xs text-muted-foreground">{lesson.subject_name}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{lesson.topic_title}</span>
                    </div>
                    <h3 className="font-semibold text-sm mt-1 leading-snug">{lesson.title}</h3>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {status === 'youtube' && ytId && (
                      <a
                        href={`https://youtube.com/watch?v=${ytId}`}
                        target="_blank" rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border rounded px-2 py-1"
                      >
                        <ExternalLink className="w-3 h-3" /> YouTube
                      </a>
                    )}
                    {status === 'bunny' && (
                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> On Bunny
                      </span>
                    )}
                  </div>
                </div>

                {/* YouTube → Bunny migration input */}
                {status === 'youtube' && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste Bunny embed URL: https://iframe.mediadelivery.net/embed/..."
                      value={manualUrls[lesson.id] || ''}
                      onChange={e => setManualUrls(p => ({ ...p, [lesson.id]: e.target.value }))}
                      className="text-xs h-8 flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs whitespace-nowrap"
                      onClick={() => applyBunnyUrl(lesson)}
                      disabled={isUpdating || !manualUrls[lesson.id]}
                    >
                      {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : (
                        <><ArrowRight className="w-3 h-3 mr-1" /> Migrate</>
                      )}
                    </Button>
                  </div>
                )}

                {/* Current Bunny URL (copyable) */}
                {status === 'bunny' && (
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{lesson.video_url}</span>
                    <button
                      onClick={() => copyText(lesson.video_url, lesson.id)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      {copied === lesson.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
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
