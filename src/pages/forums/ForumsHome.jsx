import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import { MessageSquare, TrendingUp, Clock, ChevronRight, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { formatAgo } from '@/hooks/useLiveAgo';
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
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 120_000,
  });

  // Count open threads per subject
  const { data: threadCounts = [] } = useQuery({
    queryKey: ['forum-thread-counts'],
    queryFn: () => base44.entities.Discussion.filter({ status: 'active' }, '-created_date', 500),
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
    queryFn: () => base44.entities.ForumPresence.list('-last_seen', 200),
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

        {/* Hero */}
        <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: 'hsl(222 47% 14%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5" style={{ color: 'hsl(43 74% 66%)' }} />
            <span className="text-sm font-medium" style={{ color: 'hsl(43 74% 66% / 0.8)' }}>Academic Forums</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-1" style={{ color: 'hsl(43 20% 94%)' }}>
            Discussion Forums
          </h1>
          <p className="text-sm mb-4" style={{ color: 'hsl(43 20% 70%)' }}>
            Ask questions, get tutor answers, and help others — organised by subject
          </p>
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="text-center">
              <p className="font-bold text-lg" style={{ color: 'hsl(43 74% 66%)' }}>{subjects.length}</p>
              <p className="text-[11px]" style={{ color: 'hsl(43 20% 65%)' }}>Subjects</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg" style={{ color: 'hsl(43 74% 66%)' }}>{totalThreads}</p>
              <p className="text-[11px]" style={{ color: 'hsl(43 20% 65%)' }}>Discussions</p>
            </div>
            <div className="text-center flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <p className="font-bold text-lg leading-none" style={{ color: 'hsl(43 74% 66%)' }}>{onlineCount}</p>
              </div>
              <p className="text-[11px]" style={{ color: 'hsl(43 20% 65%)' }}>Online now</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subjects…"
              className="pl-9 bg-white text-foreground border-0 shadow-sm"
            />
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
                <button
                  key={subject.id}
                  onClick={() => navigate(`/forums/${slug}`, { state: { subject } })}
                  className={`text-left bg-card border ${meta.border} rounded-2xl p-4 hover:shadow-md hover:border-primary/40 active:scale-[0.99] transition-all duration-150 group flex flex-col gap-3`}
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
                        {formatAgo(lastAt.toISOString())}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
