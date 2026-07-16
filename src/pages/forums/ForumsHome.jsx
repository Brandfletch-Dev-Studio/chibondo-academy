import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { MessageSquare, TrendingUp, Clock, ChevronRight, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { useLiveAgo, formatAgo } from '@/hooks/useLiveAgo';

/* Tiny component so the hook runs per-card and ticks independently */
function LiveAgo({ isoDate, className = '' }) {
  const label = useLiveAgo(isoDate);
  return <span className={className}>{label}</span>;
}
import { Input } from '@/components/ui/input';

const SUBJECT_META = {
  biology:              { icon: '🧬', color: 'from-green-500/20 to-emerald-500/10',  border: 'border-green-500/20'  },
  chemistry:            { icon: '⚗️',  color: 'from-blue-500/20 to-cyan-500/10',     border: 'border-blue-500/20'   },
  physics:              { icon: '⚡',  color: 'from-yellow-500/20 to-amber-500/10',  border: 'border-yellow-500/20' },
  mathematics:          { icon: '📐',  color: 'from-purple-500/20 to-violet-500/10', border: 'border-purple-500/20' },
  'additional mathematics': { icon: '∑',  color: 'from-indigo-500/20 to-blue-500/10',  border: 'border-indigo-500/20' },
  english:              { icon: '📖',  color: 'from-rose-500/20 to-pink-500/10',     border: 'border-rose-500/20'   },
  'english language':   { icon: '📖',  color: 'from-rose-500/20 to-pink-500/10',     border: 'border-rose-500/20'   },
  'english literature': { icon: '📚',  color: 'from-pink-500/20 to-rose-500/10',     border: 'border-pink-500/20'   },
  chichewa:             { icon: '🗣️',  color: 'from-orange-500/20 to-amber-500/10',  border: 'border-orange-500/20' },
  agriculture:          { icon: '🌱',  color: 'from-lime-500/20 to-green-500/10',    border: 'border-lime-500/20'   },
  geography:            { icon: '🌍',  color: 'from-teal-500/20 to-cyan-500/10',     border: 'border-teal-500/20'   },
  history:              { icon: '📜',  color: 'from-amber-500/20 to-yellow-500/10',  border: 'border-amber-500/20'  },
};
function getMeta(name = '') {
  return SUBJECT_META[name.toLowerCase()] || { icon: '💬', color: 'from-primary/20 to-primary/5', border: 'border-primary/20' };
}

export default function ForumsHome() {
  const navigate = useNavigate();
  const { user } = useOutletContext() ?? {};
  const [search, setSearch] = useState('');

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['forum-subjects'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 120_000,
  });

  // Count open threads per subject
  const { data: threadCounts = [] } = useQuery({
    queryKey: ['forum-thread-counts'],
    queryFn: () => db.entities.Discussion.filter({ status: 'active' }, '-created_date', 500),
    staleTime: 60_000,
  });

  const countMap = React.useMemo(() => {
    const m = {};
    threadCounts.filter(d => !d.parent_id).forEach(d => {
      if (d.subject_id) m[d.subject_id] = (m[d.subject_id] || 0) + 1;
    });
    return m;
  }, [threadCounts]);

  const lastActivityMap = React.useMemo(() => {
    const m = {};
    threadCounts.forEach(d => {
      if (d.subject_id) {
        const ts = new Date(d.updated_date || d.created_date);
        if (!m[d.subject_id] || ts > m[d.subject_id]) m[d.subject_id] = ts;
      }
    });
    return m;
  }, [threadCounts]);

  const filtered = React.useMemo(() => {
    let list = subjects.filter(s =>
      !search || s.name.toLowerCase().includes(search.toLowerCase())
    );
    // Sort by latest activity descending
    return [...list].sort((a, b) => {
      const ta = lastActivityMap[a.id] || new Date(0);
      const tb = lastActivityMap[b.id] || new Date(0);
      return tb - ta;
    });
  }, [subjects, search, lastActivityMap]);

  const totalThreads = threadCounts.filter(d => !d.parent_id).length;

  // Online students — anyone whose last_seen is within the last 2 minutes
  const { data: presenceList = [] } = useQuery({
    queryKey: ['forum-presence'],
    queryFn: () => db.entities.ForumPresence.list('-last_seen', 200),
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const onlineCount = React.useMemo(() => {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000); // 2 min window
    return presenceList.filter(p => p.last_seen && new Date(p.last_seen) > cutoff).length;
  }, [presenceList]);

  return (
    <>
      <SEO title="Forums | Chibondo Academy" description="Subject-based academic discussion forums for MSCE students" />
      <div className="space-y-5">

        {/* Hero — matches Subjects page style */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-medium text-primary-foreground/80">Academic Forums</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-1">
            Discussion Forums
          </h1>
          <p className="text-primary-foreground/70 text-sm mb-4">
            Ask questions, get tutor answers, and help others — organised by subject
          </p>
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="text-center">
              <p className="font-bold text-lg">{subjects.length}</p>
              <p className="text-[11px] text-primary-foreground/70">Subjects</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">{totalThreads}</p>
              <p className="text-[11px] text-primary-foreground/70">Discussions</p>
            </div>
            <div className="text-center flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <p className="font-bold text-lg leading-none">{onlineCount}</p>
              </div>
              <p className="text-[11px] text-primary-foreground/70">Online now</p>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subjects…"
              className="pl-9 h-10 bg-card text-foreground border-0 shadow-sm"
            />
          </div>
        </div>


        {/* ── WhatsApp Community ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* WA header bar */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#075E54' }}>
            {/* Group icon */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white/20"
              style={{ background: '#128C7E' }}>
              <span className="text-xl">🎓</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white leading-none">Chibondo Academy MSCE</p>
              <p className="text-[11px] text-white/60 mt-0.5">WhatsApp Community · 1,240 members</p>
            </div>
            {/* WA icon */}
            <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="white" opacity="0.9">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.399 5.608L0 24l6.532-1.374A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 01-5.032-1.389l-.361-.214-3.733.785.799-3.647-.235-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
            </svg>
          </div>

          {/* Chat preview — 3 fake messages */}
          <div className="px-3 py-3 space-y-2" style={{ background: '#ECE5DD' }}>
            {/* Message 1 */}
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0 mt-0.5">T</div>
              <div className="max-w-[75%] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2 shadow-sm" style={{ background: 'white' }}>
                <p className="text-[10px] font-semibold text-green-700 mb-0.5">Tutor Banda</p>
                <p className="text-xs text-gray-800">📢 Mock exam results are out! Check your portal now.</p>
                <p className="text-[9px] text-gray-400 text-right mt-1">08:42 ✓✓</p>
              </div>
            </div>
            {/* Message 2 */}
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0 mt-0.5">M</div>
              <div className="max-w-[75%] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2 shadow-sm" style={{ background: 'white' }}>
                <p className="text-[10px] font-semibold text-blue-600 mb-0.5">Mphatso</p>
                <p className="text-xs text-gray-800">Got 85% in Biology 🔥 Thank you ACA!</p>
                <p className="text-[9px] text-gray-400 text-right mt-1">08:47 ✓✓</p>
              </div>
            </div>
            {/* Message 3 — sent (right side) */}
            <div className="flex justify-end">
              <div className="max-w-[75%] rounded-tl-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2 shadow-sm" style={{ background: '#DCF8C6' }}>
                <p className="text-xs text-gray-800">Same! The past papers really helped 📚</p>
                <p className="text-[9px] text-gray-400 text-right mt-1">08:51 ✓✓</p>
              </div>
            </div>
            {/* Gradient fade at bottom */}
            <div className="pointer-events-none" style={{ height: 16, marginTop: -8, background: 'linear-gradient(to bottom, transparent, #ECE5DD)' }} />
          </div>

          {/* Footer — join button */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-border">
            <div>
              <p className="text-sm font-semibold text-foreground">Join our community</p>
              <p className="text-xs text-muted-foreground">Get announcements, tips &amp; peer support</p>
            </div>
            <a
              href="https://chat.whatsapp.com/YOUR_INVITE_LINK"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-90 active:scale-95"
              style={{ background: '#25D366' }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.399 5.608L0 24l6.532-1.374A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 01-5.032-1.389l-.361-.214-3.733.785.799-3.647-.235-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
              </svg>
              Join
            </a>
          </div>
        </div>
        {/* Subject grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-28 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(subject => {
              const meta   = getMeta(subject.name);
              const count  = countMap[subject.id] || 0;
              const lastAt = lastActivityMap[subject.id];
              const slug   = subject.slug || subject.name.toLowerCase().replace(/\s+/g, '-');
              return (
                <div
                  key={subject.id}
                  onClick={() => navigate(`/forums/${slug}`, { state: { subject } })}
                  className={`text-left bg-card border ${meta.border} rounded-2xl p-4 hover:shadow-md hover:border-primary/40 cursor-pointer active:scale-[0.99] transition-all duration-150 group flex flex-col gap-3`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-lg flex-shrink-0`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm group-hover:text-accent transition-colors">{subject.forum_name || subject.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{subject.form_name}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      {count} {count === 1 ? 'thread' : 'threads'}
                    </span>
                    {(() => {
                      try {
                        const lv = localStorage.getItem(`forum_last_visit_${slug}`);
                        if (!lv) return null;
                        const lastVisit = new Date(lv);
                        const unread = threadCounts.filter(t =>
                          !t.parent_id && t.subject_id === subject.id &&
                          new Date(t.updated_date || t.created_date) > lastVisit
                        ).length;
                        return unread > 0 ? (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background:'hsl(0 72% 51% / 0.15)', color:'hsl(0 72% 40%)' }}>
                            {unread} new
                          </span>
                        ) : null;
                      } catch { return null; }
                    })()}
                    {lastAt && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                        <Clock className="w-3 h-3" />
                        <LiveAgo isoDate={lastAt.toISOString()} />
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors" />
                  </div>
                  {/* Group Chat entry */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      navigate(`/forums/${slug}/chat`, { state: { subject } });
                    }}
                    className="w-full flex items-center gap-1.5 mt-1 pt-2 border-t border-border/40 text-left hover:opacity-90 active:scale-95 transition-all"
                  >
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex items-center gap-1" style={{ background: "#25D366" }}>
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.399 5.608L0 24l6.532-1.374A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 01-5.032-1.389l-.361-.214-3.733.785.799-3.647-.235-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                      Group Chat
                    </span>
                    <span className="text-[10px] text-muted-foreground">Tap to chat</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
