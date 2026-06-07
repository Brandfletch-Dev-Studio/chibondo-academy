import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SEO from '@/components/SEO';
import {
  MessageSquare, Plus, ArrowLeft, Pin, CheckCircle,
  Clock, ChevronRight, Filter, TrendingUp, Search,
  Megaphone, GraduationCap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const STATUS_BADGE = {
  open:     { label: 'Open',     cls: 'bg-green-500/10 text-green-600 border-green-500/20'   },
  resolved: { label: 'Resolved', cls: 'bg-primary/10 text-primary border-primary/20'        },
  closed:   { label: 'Closed',   cls: 'bg-muted text-muted-foreground border-border'         },
};

function ThreadCard({ thread, subjectSlug, navigate }) {
  const badge = STATUS_BADGE[thread.thread_status] || STATUS_BADGE.open;
  const ago   = thread.updated_date
    ? formatDistanceToNow(new Date(thread.updated_date), { addSuffix: true })
    : '';
  return (
    <button
      onClick={() => navigate(`/forums/${subjectSlug}/${thread.slug || thread.id}`, { state: { thread } })}
      className="w-full text-left group bg-card border border-border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all duration-150"
    >
      <div className="flex items-start gap-3">
        {/* Status + pin indicators */}
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
          {thread.is_pinned && <Pin className="w-3.5 h-3.5 text-accent" />}
          {thread.is_announcement
            ? <Megaphone className="w-4 h-4 text-accent" />
            : <MessageSquare className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">
            {thread.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{thread.content?.slice(0, 100)}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
              <Clock className="w-3 h-3" />{ago}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              by <span className="font-medium text-foreground/70">{thread.author_name}</span>
            </span>
            {thread.reply_count > 0 && (
              <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />{thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            )}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
            {thread.is_tutor_reply && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'hsl(43 74% 52% / 0.12)', color: 'hsl(43 60% 38%)' }}>
                ✔ Tutor answered
              </span>
            )}
          </div>
          {thread.tags?.length > 0 && (
            <div className="flex gap-1 mt-2">
              {thread.tags.slice(0,3).map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

export default function SubjectForum() {
  const { subjectSlug }    = useParams();
  const navigate           = useNavigate();
  const { state }          = useLocation();
  const { user }           = useOutletContext();
  const qc                 = useQueryClient();
  const [filter, setFilter] = useState('latest');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Resolve subject from route state or fetch by slug
  const { data: subjects = [] } = useQuery({
    queryKey: ['subject-by-slug', subjectSlug],
    queryFn: () => base44.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 120_000,
    enabled: !state?.subject,
  });
  const subject = state?.subject || subjects.find(s =>
    (s.slug || s.name.toLowerCase().replace(/\s+/g,'-')) === subjectSlug
  );

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['forum-threads', subject?.id],
    queryFn: () => base44.entities.Discussion.filter(
      { subject_id: subject.id, status: 'active' }, '-created_date', 200
    ),
    enabled: !!subject?.id,
    staleTime: 30_000,
  });

  // Only root threads
  const rootThreads = useMemo(() => threads.filter(t => !t.parent_id), [threads]);

  const filtered = useMemo(() => {
    let list = rootThreads;
    if (search) list = list.filter(t =>
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.content?.toLowerCase().includes(search.toLowerCase())
    );
    // Pinned & announcements always float to top
    const pinned = list.filter(t => t.is_pinned || t.is_announcement);
    const rest   = list.filter(t => !t.is_pinned && !t.is_announcement);
    switch (filter) {
      case 'unanswered': return [...pinned, ...rest.filter(t => !t.reply_count || t.reply_count === 0)];
      case 'resolved':   return [...pinned, ...rest.filter(t => t.thread_status === 'resolved')];
      case 'popular':    return [...pinned, ...rest.sort((a,b) => (b.reply_count||0) - (a.reply_count||0))];
      default:           return [...pinned, ...rest];
    }
  }, [rootThreads, filter, search]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim() || !newContent.trim()) throw new Error('Title and content required');
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)
        + '-' + Date.now().toString(36);
      return base44.entities.Discussion.create({
        title: newTitle.trim(),
        slug,
        content: newContent.trim(),
        subject_id: subject.id,
        subject_slug: subjectSlug,
        author_id: user.id,
        author_name: user.full_name || user.email,
        author_role: user.role || 'user',
        thread_status: 'open',
        status: 'active',
        reply_count: 0,
        view_count: 0,
      });
    },
    onSuccess: (created) => {
      toast.success('Thread posted!');
      setShowNew(false); setNewTitle(''); setNewContent('');
      qc.invalidateQueries({ queryKey: ['forum-threads', subject?.id] });
      navigate(`/forums/${subjectSlug}/${created.slug || created.id}`, { state: { thread: created, subject } });
    },
    onError: e => toast.error(e.message),
  });

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <>
      <SEO
        title={`${subject?.name || 'Forum'} | Forums | Chibondo Academy`}
        description={`Ask questions and discuss ${subject?.name || 'topics'} with tutors and fellow students`}
      />
      <div className="space-y-4">

        {/* Header */}
        <div className="rounded-2xl p-5" style={{ background: 'hsl(222 47% 14%)' }}>
          <button
            onClick={() => navigate('/forums')}
            className="flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors"
            style={{ color: 'hsl(43 74% 66% / 0.7)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Forums
          </button>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-display font-bold leading-tight" style={{ color: 'hsl(43 20% 94%)' }}>
                {subject?.name || subjectSlug} Forum
              </h1>
              {subject?.form_name && (
                <p className="text-xs mt-0.5" style={{ color: 'hsl(43 20% 65%)' }}>{subject.form_name}</p>
              )}
            </div>
            <button
              onClick={() => setShowNew(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 active:scale-95 transition-transform"
              style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}
            >
              <Plus className="w-4 h-4" /> Ask
            </button>
          </div>
          <div className="flex items-center gap-3 mt-3" style={{ color: 'hsl(43 20% 65%)' }}>
            <span className="text-xs flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />{rootThreads.length} threads
            </span>
          </div>
        </div>

        {/* New thread form */}
        {showNew && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm">Ask a Question</h3>
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Write a clear question title…"
              className="h-10"
            />
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Describe your question in detail. Include what you've tried, what you don't understand…"
              rows={4}
              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
                style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}
              >
                {createMut.isPending ? 'Posting…' : 'Post Question'}
              </button>
              <button
                onClick={() => { setShowNew(false); setNewTitle(''); setNewContent(''); }}
                className="px-4 py-2.5 rounded-xl text-sm border border-border hover:border-primary/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search threads…" className="pl-9" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mt-1">
          {[
            { key: 'latest',     label: 'Latest',      icon: Clock },
            { key: 'popular',    label: 'Most Replied', icon: TrendingUp },
            { key: 'unanswered', label: 'Unanswered',   icon: MessageSquare },
            { key: 'resolved',   label: 'Resolved',     icon: CheckCircle },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>

        {/* Thread list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-2xl border border-border animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/20" />
            <p className="font-semibold text-muted-foreground">No threads yet</p>
            <p className="text-sm text-muted-foreground/60">Be the first to ask a question!</p>
            <button onClick={() => setShowNew(true)}
              className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'hsl(222 47% 18%)', color: 'hsl(43 74% 66%)' }}>
              Ask a Question
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <ThreadCard key={t.id} thread={t} subjectSlug={subjectSlug} navigate={navigate} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
