import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Search } from 'lucide-react';

const SUBJECT_META = {
  biology:              { icon: '🧬' },
  chemistry:            { icon: '⚗️' },
  physics:              { icon: '⚡' },
  mathematics:          { icon: '📐' },
  'additional mathematics': { icon: '∑' },
  english:              { icon: '📖' },
  'english language':   { icon: '📖' },
  'english literature': { icon: '📚' },
  chichewa:             { icon: '🗣️' },
  agriculture:          { icon: '🌱' },
  geography:            { icon: '🌍' },
  history:              { icon: '📜' },
};

function getMeta(name = '') {
  return SUBJECT_META[name.toLowerCase()] || { icon: '💬' };
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

  const { data: threadCounts = [] } = useQuery({
    queryKey: ['forum-thread-counts'],
    queryFn: () => db.entities.Discussion.filter({ status: 'active' }, '-created_date', 500),
    staleTime: 60_000,
  });

  // Calculate unread counts or last messages if needed, using directly imported useMemo
  const subjectStats = useMemo(() => {
    const stats = {};
    threadCounts.forEach(d => {
      if (d.subject_id) {
        if (!stats[d.subject_id]) {
          stats[d.subject_id] = {
            count: 0,
            lastMessage: null,
            lastDate: null
          };
        }
        stats[d.subject_id].count += 1;
        
        const msgDate = new Date(d.created_date || d.updated_date);
        if (!stats[d.subject_id].lastDate || msgDate > stats[d.subject_id].lastDate) {
          stats[d.subject_id].lastDate = msgDate;
          stats[d.subject_id].lastMessage = d.content || d.title;
        }
      }
    });
    return stats;
  }, [threadCounts]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s =>
      !search || s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [subjects, search]);

  const handleCommunityClick = () => {
    navigate('/forums/community/chat', {
      state: {
        isCommunity: true,
        subject: { id: 'community', name: 'Chibondo Academy', slug: 'community' }
      }
    });
  };

  const handleSubjectClick = (subject) => {
    navigate(`/forums/${subject.slug}/chat`);
  };

  const handleCreateGroupClick = () => {
    navigate('/forums/community/chat', {
      state: { createGroup: true }
    });
  };

  return (
    <>
      <SEO title="Community Forums | Chibondo Academy" description="Interact with peers and tutors in our active study community." />
      
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-24">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-4 sticky top-0 z-10" style={{ backgroundColor: '#075E54' }}>
          <h1 className="text-xl font-bold text-white">Community</h1>
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-white/80 mr-2" />
          </div>
        </div>

        {/* Search inline bar */}
        <div className="p-3 border-b border-border bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Main list container */}
        <div className="flex-1 overflow-y-auto">
          {/* Global Community Chat row */}
          <div 
            onClick={handleCommunityClick}
            className="flex items-center gap-3 p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors bg-card"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: '#075E54' }}>
              🎓
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">Chibondo Academy</span>
                <span className="text-xs text-muted-foreground">Pinned</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Official community chat
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600" fill="currentColor">
                <path d="M16 12V4c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5c.24 0 .47-.04.7-.12l6 1.8c1 .3 2.1-.4 2.1-1.5V14c0-1.1-.9-2-2-2zm-3-3h-2v2H9V9H7V7h2V5h2v2h2v2z"/>
              </svg>
            </div>
          </div>

          {/* Section header */}
          <div className="px-4 py-2 bg-muted/30">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              Subject Groups
            </span>
          </div>

          {/* Subject forum rows */}
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading community rooms...
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No active subject groups found matching your search.
              </div>
            ) : (
              filteredSubjects.map((subject) => {
                const meta = getMeta(subject.name);
                const stats = subjectStats[subject.id] || {};
                const lastMsg = stats.lastMessage || 'No messages yet';
                const unreadCount = stats.count || 0;
                
                // Formatted date string for timestamp
                let timeStr = '';
                if (stats.lastDate) {
                  const now = new Date();
                  const diffMs = now - stats.lastDate;
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMins / 60);
                  const diffDays = Math.floor(diffHours / 24);

                  if (diffMins < 1) {
                    timeStr = 'Just now';
                  } else if (diffMins < 60) {
                    timeStr = `${diffMins}m ago`;
                  } else if (diffHours < 24) {
                    timeStr = `${diffHours}h ago`;
                  } else if (diffDays < 7) {
                    timeStr = `${diffDays}d ago`;
                  } else {
                    timeStr = stats.lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  }
                }

                return (
                  <div
                    key={subject.id}
                    onClick={() => handleSubjectClick(subject)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors bg-card"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 bg-muted/60">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-sm truncate pr-2">
                          {subject.name}
                        </span>
                        {timeStr && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {timeStr}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {lastMsg}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <div className="flex-shrink-0 flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {unreadCount}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* FAB Button */}
        <button
          onClick={handleCreateGroupClick}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 text-white z-20"
          style={{ backgroundColor: '#128C7E' }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </>
  );
}
