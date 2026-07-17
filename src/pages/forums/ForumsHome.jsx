// src/pages/forums/ForumsHome.jsx
// Polished WhatsApp-style community list — ACA navy/gold theme

import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { Search, Plus, Users, Pin } from 'lucide-react';

const NAVY = '#0d1b4b';
const GOLD = '#D4AF37';

const SUBJECT_META = {
  biology:                  { icon: '🧬', color: '#00897B' },
  chemistry:                { icon: '⚗️', color: '#7B1FA2' },
  physics:                  { icon: '⚡', color: '#1565C0' },
  mathematics:              { icon: '📐', color: '#E65100' },
  'additional mathematics': { icon: '∑',  color: '#880E4F' },
  english:                  { icon: '📖', color: '#2E7D32' },
  'english language':       { icon: '📖', color: '#2E7D32' },
  'english literature':     { icon: '📚', color: '#4527A0' },
  chichewa:                 { icon: '🗣️', color: '#00695C' },
  agriculture:              { icon: '🌱', color: '#558B2F' },
  geography:                { icon: '🌍', color: '#00838F' },
  history:                  { icon: '📜', color: '#BF360C' },
};

function getMeta(name = '') {
  return SUBJECT_META[name.toLowerCase()] || { icon: '💬', color: NAVY };
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1)    return 'now';
  if (diff < 60)   return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

// Avatar for subject/group chats
function ChatAvatar({ src, icon, color, size = 50 }) {
  if (src) {
    return (
      <img src={src} alt="chat" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color || NAVY,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      {icon || '💬'}
    </div>
  );
}

// Unread badge
function Badge({ count }) {
  if (!count) return null;
  return (
    <div style={{
      minWidth: 20, height: 20, borderRadius: 10, background: GOLD, color: NAVY,
      fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '0 5px',
    }}>
      {count > 99 ? '99+' : count}
    </div>
  );
}

export default function ForumsHome() {
  const navigate = useNavigate();
  const { user } = useOutletContext() ?? {};
  const [search, setSearch] = useState('');

  const { data: subjects = [], isLoading } = useQuery({queryKey: ['forum-subjects'],
    queryFn: async () => { try { return await db.entities.Subject.filter({ status: 'published' }, 'name', 100); } catch(e) { console.error(e); return []; } },
    staleTime: 120_000,
    placeholderData: [],
  });

  const { data: recentMsgs = [] } = useQuery({queryKey: ['forum-recent-msgs'],
    queryFn: async () => { try { return await db.entities.GroupChatMessage.filter({}, '-created_date', 200); } catch(e) { console.error(e); return []; } },
    staleTime: 30_000,
    placeholderData: [],
  });

  // Per-subject: last message + count
  const subjectStats = useMemo(() => {
    const stats = {};
    recentMsgs.forEach(m => {
      if (m.group_id?.startsWith('subject-')) {
        const sid = m.group_id.replace('subject-', '');
        if (!stats[sid]) stats[sid] = { count: 0, lastMsg: null, lastDate: null };
        stats[sid].count += 1;
        const d = new Date(m.created_date);
        if (!stats[sid].lastDate || d > stats[sid].lastDate) {
          stats[sid].lastDate = d;
          stats[sid].lastMsg = m.body;
          stats[sid].lastTime = m.created_date;
        }
      }
    });
    return stats;
  }, [recentMsgs]);

  const { data: myGroups = [] } = useQuery({queryKey: ['my-study-groups', user?.id],
    queryFn: async () => { try { return await db.entities.StudyGroup.filter({ status: 'active' }, '-created_date', 100); } catch(e) { console.error(e); return []; } },
    enabled: !!user?.id,
    staleTime: 30_000,
    select: groups => groups.filter(g =>
      g.creator_id === user?.id || (g.member_ids || []).includes(user?.id)
    ),
    placeholderData: [],
  });

  const filteredSubjects = useMemo(() =>
    subjects.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())),
    [subjects, search]
  );

  const goSubject = s => {
    const slug = s.slug || s.name.toLowerCase().replace(/\s+/g, '-');
    navigate(`/forums/${slug}/chat`, { state: { subject: s } });
  };
  const goCommunity = () => navigate('/forums/community/chat', {
    state: { isCommunity: true, subject: { id: 'community', name: 'Chibondo Academy', slug: 'community' } }
  });
  const goGroup = g => navigate(`/forums/group-${g.id}/chat`, { state: { group: g } });

  return (
    <>
      <SEO title="Chats | Chibondo Academy" description="Connect with peers and tutors." />

      {/* Full-page container — sits inside AppLayout's main content area */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: '#f0f2f5',
        fontFamily: 'inherit',
        minHeight: '100%',
      }}>

        {/* ── Top header bar ── */}
        <div style={{
          background: NAVY, color: 'white', padding: '14px 16px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: 0.3 }}>Community</h1>
            <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.65 }}>
              {subjects.length} subject groups · {myGroups.length} study groups
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/forums/community/chat', { state: { createGroup: true } })}
              style={{
                background: `${GOLD}22`, border: `1px solid ${GOLD}55`,
                borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                color: GOLD, fontSize: 12, fontWeight: 700,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> New Group
            </button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div style={{
          background: NAVY, paddingBottom: 12, paddingLeft: 12, paddingRight: 12,
        }}>
          <div style={{ position: 'relative' }}>
            <Search style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 15, height: 15, color: '#aaa',
            }} />
            <input
              type="text"
              placeholder="Search chats…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '9px 14px 9px 36px',
                borderRadius: 24, border: 'none', background: 'white',
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            />
          </div>
        </div>

        {/* ── List ── */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>

          {/* Pinned: Academy Community Chat */}
          <div
            onClick={goCommunity}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
              cursor: 'pointer', background: `${GOLD}08`,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${GOLD}15`}
            onMouseLeave={e => e.currentTarget.style.background = `${GOLD}08`}
          >
            {/* Gold ring on pinned avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%',
                background: `linear-gradient(135deg, ${NAVY} 0%, #1a2f7a 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, border: `2px solid ${GOLD}`,
                boxShadow: `0 0 0 2px ${GOLD}44`,
              }}>
                🎓
              </div>
              <div style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 16, height: 16, borderRadius: '50%',
                background: GOLD, border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Pin style={{ width: 8, height: 8, color: NAVY }} />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>Chibondo Academy</span>
                <span style={{ fontSize: 11, color: '#aaa' }}>Pinned</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888', overflow: 'hidden',
                           whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                Official community — all students & tutors
              </p>
            </div>
          </div>

          {/* Section: Subject Chats */}
          {filteredSubjects.length > 0 && (
            <>
              <div style={{
                padding: '8px 16px', background: '#f8f8f8',
                borderBottom: '1px solid #eee', borderTop: '1px solid #eee',
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Subject Groups · {filteredSubjects.length}
                </span>
              </div>

              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#eee' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 13, background: '#eee', borderRadius: 6, width: '55%', marginBottom: 8 }} />
                      <div style={{ height: 11, background: '#f5f5f5', borderRadius: 6, width: '80%' }} />
                    </div>
                  </div>
                ))
              ) : filteredSubjects.map(subject => {
                const meta  = getMeta(subject.name);
                const stats = subjectStats[subject.id] || {};
                const slug  = subject.slug || subject.name.toLowerCase().replace(/\s+/g, '-');

                return (
                  <div
                    key={subject.id}
                    onClick={() => goSubject(subject)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <ChatAvatar icon={meta.icon} color={meta.color} size={50} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {subject.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {relativeTime(stats.lastTime)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#888', overflow: 'hidden',
                                     whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                          {stats.lastMsg || 'Tap to join the conversation'}
                        </p>
                        <Badge count={stats.count} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Section: My Study Groups */}
          {myGroups.length > 0 && (
            <>
              <div style={{
                padding: '8px 16px', background: '#f8f8f8',
                borderBottom: '1px solid #eee', borderTop: '1px solid #eee',
              }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase' }}>
                  My Study Groups · {myGroups.length}
                </span>
              </div>

              {myGroups.map(group => (
                <div
                  key={group.id}
                  onClick={() => goGroup(group)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px', borderBottom: '1px solid #f5f5f5',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <ChatAvatar src={group.icon_url} icon={group.icon || '💬'} color="#128C7E" size={50} />
                    {group.is_private && (
                      <div style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#555', border: '2px solid white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9,
                      }}>🔒</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#111', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {group.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {relativeTime(group.last_message_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#888', overflow: 'hidden',
                                   whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                        {group.last_message || group.description || 'Study group'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <Users style={{ width: 10, height: 10, color: '#bbb' }} />
                        <span style={{ fontSize: 10, color: '#bbb' }}>{group.member_count || 1}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Empty state */}
          {!isLoading && filteredSubjects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#aaa' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#555', margin: '0 0 4px' }}>No chats found</p>
              <p style={{ fontSize: 13, margin: 0 }}>Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
