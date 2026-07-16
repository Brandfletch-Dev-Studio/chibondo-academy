import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Search } from 'lucide-react';

import { Pin } from 'lucide-react';

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


// WhatsApp-style default group avatar
function GroupAvatar({ src, icon, size = 48 }) {
  if (src) return <img src={src} alt="group" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  if (icon && icon.length <= 4 && icon !== '📚') {
    return (
      <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: '#128C7E', fontSize: size * 0.45 }}>
        {icon}
      </div>
    );
  }
  return (
    <div className="rounded-full flex-shrink-0 overflow-hidden" style={{ width: size, height: size, background: '#DFE5E7' }}>
      <svg viewBox="0 0 212 212" style={{ width: '100%', height: '100%' }}>
        <path fill="#BEC5C9" d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z"/>
        <path fill="#FFF" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.023-7.030c-1.741-.99-3.528-1.929-5.358-2.809-.872-.41-1.750-.81-2.634-1.195a44.34 44.34 0 0 0-1.793-.762 38.713 38.713 0 0 0-2.374-.897 30.038 30.038 0 0 0-2.399-.666 25.792 25.792 0 0 0-2.427-.438 22.956 22.956 0 0 0-2.458-.21 22.2 22.2 0 0 0-2.491.042 21.86 21.86 0 0 0-2.526.317 23.28 23.28 0 0 0-2.562.597 27.29 27.29 0 0 0-2.601.893 32.63 32.63 0 0 0-2.641 1.208 38.63 38.63 0 0 0-2.682 1.543 44.92 44.92 0 0 0-2.723 1.907c-.9.682-1.78 1.389-2.636 2.124-.428.367-.85.742-1.267 1.124-.417.382-.829.772-1.234 1.170-.405.398-.804.803-1.196 1.216-.391.412-.776.832-1.153 1.258-.376.426-.746.860-1.108 1.300-.362.440-.716.888-1.062 1.342-.347.454-.685.914-1.016 1.380-.330.466-.653.937-.967 1.414-.314.477-.62.958-.918 1.445-.298.487-.587.978-.868 1.474-.281.495-.553.995-.817 1.499-.264.504-.519 1.012-.766 1.524-.247.512-.485 1.028-.715 1.548a62.79 62.79 0 0 0-.642 1.712 63.53 63.53 0 0 0-.571 1.77 60.97 60.97 0 0 0-.5 1.826H153.93a60.97 60.97 0 0 0-.5-1.826z"/>
        <path fill="#FFF" d="M106.25 93.75c14.912 0 27-12.088 27-27s-12.088-27-27-27-27 12.088-27 27 12.088 27 27 27z"/>
      </svg>
    </div>
  );
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

  // Subject stats from GroupChatMessages (Discussion entity replaced)
  const { data: recentMsgs = [] } = useQuery({
    queryKey: ['forum-recent-msgs'],
    queryFn: () => db.entities.GroupChatMessage.filter({}, 'created_date', 200),
    staleTime: 30_000,
  });

  const subjectStats = useMemo(() => {
    const stats = {};
    recentMsgs.forEach(m => {
      // group_id is "subject-{subjectId}" for official subject groups
      if (m.group_id && m.group_id.startsWith('subject-')) {
        const subjectId = m.group_id.replace('subject-', '');
        if (!stats[subjectId]) stats[subjectId] = { count: 0, lastMessage: null, lastDate: null };
        stats[subjectId].count += 1;
        const msgDate = new Date(m.created_date);
        if (!stats[subjectId].lastDate || msgDate > stats[subjectId].lastDate) {
          stats[subjectId].lastDate = msgDate;
          stats[subjectId].lastMessage = m.body;
        }
      }
    });
    return stats;
  }, [recentMsgs]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s =>
      !search || s.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [subjects, search]);

  // My custom study groups
  const { data: myGroups = [] } = useQuery({
    queryKey: ['my-study-groups', user?.id],
    queryFn: () => db.entities.StudyGroup.filter({ status: 'active' }, '-last_message_at', 100),
    enabled: !!user?.id,
    staleTime: 30_000,
    select: (groups) => groups.filter(g =>
      g.creator_id === user?.id || (g.member_ids || []).includes(user?.id)
    ),
  });

  const handleCommunityClick = () => {
    navigate('/forums/community/chat', {
      state: {
        isCommunity: true,
        subject: { id: 'community', name: 'Chibondo Academy', slug: 'community' }
      }
    });
  };

  const handleSubjectClick = (subject) => {
    const slug = subject.slug || subject.name.toLowerCase().replace(/\s+/g, '-');
    navigate(`/forums/${slug}/chat`, { state: { subject } });
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

          {/* My Groups section */}
          {myGroups.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/30">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  My Groups
                </span>
              </div>
              <div className="divide-y divide-border">
                {myGroups.map(group => (
                  <div
                    key={group.id}
                    onClick={() => navigate(`/forums/group-${group.id}/chat`, { state: { group } })}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors bg-card"
                  >
                    <GroupAvatar src={group.icon_url} icon={group.icon} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground text-sm truncate">{group.name}</span>
                        {group.last_message_at && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {(() => {
                              const d = new Date(group.last_message_at);
                              const diff = Math.floor((Date.now() - d) / 60000);
                              if (diff < 1) return 'now';
                              if (diff < 60) return `${diff}m`;
                              if (diff < 1440) return `${Math.floor(diff/60)}h`;
                              return `${Math.floor(diff/1440)}d`;
                            })()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {group.last_message || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

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
                    <GroupAvatar icon={meta.icon} size={48} />
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
