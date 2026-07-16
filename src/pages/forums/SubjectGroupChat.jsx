// src/pages/forums/SubjectGroupChat.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { X, Lock, Globe } from 'lucide-react';

const WA_BG = '#E5DDD5';
const WA_SENT = '#DCF8C6';
const WA_NAVY = '#1A237E';
const WA_GREEN = '#25D366';

// Name colors for received bubbles
const NAME_COLORS = ['#E91E63','#9C27B0','#2196F3','#009688','#FF5722','#795548'];
function nameColor(id='') {
  return NAME_COLORS[id.charCodeAt(0) % NAME_COLORS.length];
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
function formatDateLabel(iso) {
  const d = new Date(iso), today = new Date();
  const diff = Math.floor((today - d)/86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
}
function sameDay(a, b) {
  const da = new Date(a), db2 = new Date(b);
  return da.getFullYear()===db2.getFullYear()&&da.getMonth()===db2.getMonth()&&da.getDate()===db2.getDate();
}
function getSubjectIcon(name='') {
  const n = name.toLowerCase();
  if(n.includes('bio')) return '🧬';
  if(n.includes('chem')) return '⚗️';
  if(n.includes('phys')) return '⚡';
  if(n.includes('math')) return '📐';
  if(n.includes('english')||n.includes('lit')) return '📖';
  if(n.includes('chichewa')) return '🗣️';
  if(n.includes('agri')) return '🌱';
  if(n.includes('geo')) return '🌍';
  if(n.includes('hist')) return '📜';
  return '💬';
}

// ── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showAvatar }) {
  const color = nameColor(msg.author_id);
  const isTeacher = msg.author_role === 'teacher' || msg.author_role === 'admin';
  return (
    <div style={{ display:'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems:'flex-end', gap:6, marginBottom:2 }}>
      {/* Avatar placeholder for spacing */}
      <div style={{ width:28, flexShrink:0 }}>
        {!isMine && showAvatar && (
          <div style={{ width:28, height:28, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'white', fontWeight:700 }}>
            {(msg.author_name||'?')[0].toUpperCase()}
          </div>
        )}
      </div>
      <div style={{ maxWidth:'75%' }}>
        {/* Reply preview */}
        {msg.reply_preview && (
          <div style={{ background:'rgba(0,0,0,0.06)', borderLeft:`3px solid ${color}`, borderRadius:4, padding:'3px 8px', marginBottom:2, fontSize:11, color:'#555', maxWidth:'100%' }}>
            <span style={{ fontWeight:600, color }}>{msg.reply_author}: </span>{msg.reply_preview}
          </div>
        )}
        <div style={{ background: isMine ? WA_SENT : 'white', borderRadius: isMine ? '12px 0 12px 12px' : '0 12px 12px 12px', padding:'6px 10px', boxShadow:'0 1px 2px rgba(0,0,0,0.12)' }}>
          {!isMine && showAvatar && (
            <div style={{ fontSize:11, fontWeight:700, color, marginBottom:2 }}>
              {msg.author_name}{isTeacher && <span style={{ fontSize:9, opacity:0.8, marginLeft:4 }}>⭐ Tutor</span>}
            </div>
          )}
          <p style={{ margin:0, fontSize:14, color:'#111', lineHeight:1.4, wordBreak:'break-word', whiteSpace:'pre-wrap' }}>{msg.body}</p>
          <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:3, marginTop:2 }}>
            <span style={{ fontSize:10, color:'#999' }}>{formatTime(msg.created_date)}</span>
            {isMine && <span style={{ fontSize:11, color:'#4FC3F7' }}>✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ChatView ─────────────────────────────────────────────────────────────────
function ChatView({ group, user, onBack }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['groupChat', group.id],
    queryFn: () => db.entities.GroupChatMessage.filter({ group_id: group.id, deleted: false }, 'created_date', 200),
    refetchInterval: 3000,
    staleTime: 0,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length < 5 ? 'instant' : 'smooth' });
  }, [messages.length]);

  // Auto-resize textarea
  const handleTextChange = (e) => {
    setText(e.target.value);
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
  };

  const sendMutation = useMutation({
    mutationFn: (payload) => db.entities.GroupChatMessage.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groupChat', group.id] }),
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id) return;
    const payload = {
      group_id: group.id,
      author_id: user.id,
      author_name: user.full_name || user.email?.split('@')[0] || 'Student',
      author_role: user.role || 'student',
      body: trimmed,
      deleted: false,
      ...(replyTo ? { reply_to_id: replyTo.id, reply_preview: replyTo.body.slice(0,80), reply_author: replyTo.author_name } : {}),
    };
    sendMutation.mutate(payload);
    setText('');
    setReplyTo(null);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const grouped = useMemo(() => {
    const result = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      if (!prev || !sameDay(prev.created_date, msg.created_date)) {
        result.push({ type: 'date', label: formatDateLabel(msg.created_date), key: `d-${i}` });
      }
      const showAvatar = !prev || prev.author_id !== msg.author_id || !sameDay(prev.created_date, msg.created_date);
      result.push({ type: 'msg', msg, showAvatar, key: msg.id });
    });
    return result;
  }, [messages]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', paddingBottom:'64px', background:WA_BG, overflow:'hidden' }}>
      {/* ── Header ── */}
      <div style={{ flexShrink:0, background:WA_NAVY, color:'white', display:'flex', alignItems:'center', gap:10, padding:'0 12px', height:56, zIndex:10 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'white', fontSize:22, cursor:'pointer', padding:'0 4px', lineHeight:1 }}>←</button>
        <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, overflow:'hidden' }}>
          {group.icon_url
            ? <img src={group.icon_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            : <span>{group.icon || '💬'}</span>
          }
        </div>
        <div style={{ flex:1, overflow:'hidden' }}>
          <div style={{ fontWeight:700, fontSize:15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{group.name}</div>
          <div style={{ fontSize:11, opacity:0.75 }}>{group.member_count ? `${group.member_count} members` : 'Group chat'}</div>
        </div>
        <button style={{ background:'none', border:'none', color:'white', fontSize:22, cursor:'pointer', padding:'0 4px' }}>⋮</button>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 8px 4px', WebkitOverflowScrolling:'touch' }}>
        {isLoading && (
          <div style={{ textAlign:'center', padding:24, color:'#999', fontSize:13 }}>Loading messages…</div>
        )}
        {!isLoading && messages.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:'#999', fontSize:13 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>💬</div>
            <p>No messages yet.<br/>Be the first to say something!</p>
          </div>
        )}
        {grouped.map(item =>
          item.type === 'date' ? (
            <div key={item.key} style={{ textAlign:'center', margin:'8px 0' }}>
              <span style={{ background:'rgba(255,255,255,0.85)', padding:'3px 10px', borderRadius:8, fontSize:11, color:'#666' }}>{item.label}</span>
            </div>
          ) : (
            <MessageBubble
              key={item.key}
              msg={item.msg}
              isMine={item.msg.author_id === user?.id}
              showAvatar={item.showAvatar}
            />
          )
        )}
        <div ref={endRef} />
      </div>

      {/* ── Reply preview ── */}
      {replyTo && (
        <div style={{ flexShrink:0, background:'#fff', borderTop:'2px solid '+WA_GREEN, padding:'6px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <span style={{ fontSize:11, fontWeight:700, color:WA_GREEN }}>{replyTo.author_name}</span>
            <p style={{ margin:0, fontSize:12, color:'#555', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:240 }}>{replyTo.body}</p>
          </div>
          <button onClick={()=>setReplyTo(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#999' }}>×</button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{ flexShrink:0, background:'#F0F0F0', borderTop:'1px solid #ddd', padding:'6px 8px', display:'flex', alignItems:'flex-end', gap:8 }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          style={{ flex:1, borderRadius:20, border:'1px solid #ddd', padding:'9px 14px', fontSize:14, resize:'none', background:'white', outline:'none', lineHeight:1.4, maxHeight:120, overflowY:'auto', fontFamily:'inherit' }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          style={{ width:42, height:42, borderRadius:'50%', background: text.trim() ? WA_GREEN : '#ccc', border:'none', cursor: text.trim() ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background 0.2s' }}
        >
          <span style={{ color:'white', fontSize:18, marginLeft:2 }}>➤</span>
        </button>
      </div>
    </div>
  );
}

// ── CreateGroupModal ─────────────────────────────────────────────────────────
function CreateGroupModal({ user, subjects, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('💬');
  const [subjectId, setSubjectId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const ICONS = ['💬','📚','⚡','🧬','⚗️','📐','📖','🌍','📜','🌱','🏆','🎯','🔥','💡','✏️'];

  const handleCreate = async () => {
    if (!name.trim() || !user?.id) return;
    setSaving(true);
    try {
      const subject = subjects.find(s => s.id === subjectId);
      const group = await db.entities.StudyGroup.create({
        name: name.trim(), description: description.trim(), icon,
        subject_id: subjectId || null, subject_name: subject?.name || null,
        creator_id: user.id, creator_name: user.full_name || user.email,
        member_ids: [user.id], member_names: [user.full_name || user.email],
        member_count: 1, is_private: isPrivate, status: 'active',
      });
      onCreate(group);
      onClose();
    } catch(e) { console.error('Create group failed:', e); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:400, overflow:'hidden', maxHeight:'85dvh', display:'flex', flexDirection:'column' }}>
        <div style={{ background:WA_GREEN, color:'white', display:'flex', alignItems:'center', gap:12, padding:'12px 16px', flexShrink:0 }}>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'white', fontSize:20, cursor:'pointer' }}>✕</button>
          <span style={{ fontWeight:700, fontSize:15 }}>New Study Group</span>
        </div>
        <div style={{ overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <p style={{ fontSize:12, fontWeight:600, color:'#666', marginBottom:6 }}>Group Icon</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {ICONS.map(e => (
                <button key={e} onClick={()=>setIcon(e)} style={{ width:36, height:36, borderRadius:'50%', border: icon===e ? `2px solid ${WA_GREEN}` : '1px solid #eee', background: icon===e ? '#e8f5e9' : '#f5f5f5', fontSize:18, cursor:'pointer' }}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Group Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Form 4 Biology Squad" maxLength={60}
              style={{ width:'100%', border:'1px solid #ddd', borderRadius:10, padding:'10px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Description (optional)</label>
            <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="What's this group about?" maxLength={120}
              style={{ width:'100%', border:'1px solid #ddd', borderRadius:10, padding:'10px 12px', fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Subject (optional)</label>
            <select value={subjectId} onChange={e=>setSubjectId(e.target.value)}
              style={{ width:'100%', border:'1px solid #ddd', borderRadius:10, padding:'10px 12px', fontSize:14, outline:'none', background:'white', boxSizing:'border-box' }}>
              <option value="">— No specific subject —</option>
              {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f9f9f9', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span>{isPrivate ? '🔒' : '🌐'}</span>
              <div>
                <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{isPrivate ? 'Private' : 'Public'}</p>
                <p style={{ margin:0, fontSize:11, color:'#888' }}>{isPrivate ? 'Invite only' : 'Anyone can join'}</p>
              </div>
            </div>
            <button onClick={()=>setIsPrivate(v=>!v)}
              style={{ width:44, height:24, borderRadius:12, background: isPrivate ? WA_GREEN : '#ccc', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s' }}>
              <span style={{ position:'absolute', top:2, left: isPrivate ? 22 : 2, width:20, height:20, borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
          <button onClick={handleCreate} disabled={!name.trim()||saving}
            style={{ width:'100%', padding:12, borderRadius:12, background: name.trim()&&!saving ? WA_GREEN : '#ccc', color:'white', border:'none', fontWeight:700, fontSize:14, cursor: name.trim()&&!saving ? 'pointer' : 'default' }}>
            {saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export — NO SPINNER for subject/community chats ─────────────────────
export default function SubjectGroupChat() {
  const navigate = useNavigate();
  const { subjectSlug } = useParams();
  const location = useLocation();
  const { user } = useOutletContext() ?? {};
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const isCommunity = subjectSlug === 'community' || location.state?.isCommunity;
  const isCustomGroup = !!location.state?.group;

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 300_000,
  });

  // Custom group from My Groups — use state directly
  if (isCustomGroup) {
    return (
      <>
        <ChatView group={location.state.group} user={user} onBack={() => navigate('/forums')} />
        {showCreateGroup && (
          <CreateGroupModal user={user} subjects={subjects} onClose={() => setShowCreateGroup(false)} onCreate={() => navigate('/forums')} />
        )}
      </>
    );
  }

  // Community chat — instant virtual group
  if (isCommunity) {
    const group = { id: 'community-global', name: 'ACA Community', icon: '🎓', icon_url: null, member_count: null, creator_id: 'system' };
    return (
      <>
        <ChatView group={group} user={user} onBack={() => navigate('/forums')} />
        {showCreateGroup && (
          <CreateGroupModal user={user} subjects={subjects} onClose={() => setShowCreateGroup(false)} onCreate={() => navigate('/forums')} />
        )}
      </>
    );
  }

  // Subject chat — look up subject then render instantly
  return <SubjectChatView subjectSlug={subjectSlug} locationState={location.state} user={user} subjects={subjects} navigate={navigate} showCreateGroup={showCreateGroup} setShowCreateGroup={setShowCreateGroup} />;
}

function SubjectChatView({ subjectSlug, locationState, user, subjects, navigate, showCreateGroup, setShowCreateGroup }) {
  const subjectFromState = locationState?.subject;
  const { data: subjectFromDB, isLoading } = useQuery({
    queryKey: ['subj-slug', subjectSlug],
    queryFn: async () => {
      const all = await db.entities.Subject.filter({ status: 'published' }, 'name', 100);
      const slug = (subjectSlug || '').toLowerCase();
      return all.find(s => s.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') === slug)
        || all.find(s => slug.includes(s.name.toLowerCase().split(' ').pop() || '__'))
        || null;
    },
    enabled: !subjectFromState,
    staleTime: 300_000,
  });
  const subject = subjectFromState || subjectFromDB;

  if (!subject && isLoading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100dvh', paddingBottom:64, gap:12 }}>
      <div style={{ width:28, height:28, borderRadius:'50%', border:'3px solid #25D366', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color:'#666', fontSize:13 }}>Opening chat…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!subject) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100dvh', paddingBottom:64, gap:16, padding:32, textAlign:'center' }}>
      <p style={{ fontWeight:600, color:'#333' }}>Subject not found</p>
      <button onClick={() => navigate('/forums')} style={{ padding:'10px 20px', background:WA_GREEN, color:'white', border:'none', borderRadius:12, fontSize:14, cursor:'pointer', fontWeight:600 }}>Back to Forums</button>
    </div>
  );

  const group = { id: `subject-${subject.id}`, name: subject.name, icon: getSubjectIcon(subject.name), icon_url: null, member_count: null, subject_name: subject.name, creator_id: 'system' };
  return (
    <>
      <ChatView group={group} user={user} onBack={() => navigate('/forums')} />
      {showCreateGroup && (
        <CreateGroupModal user={user} subjects={subjects} onClose={() => setShowCreateGroup(false)} onCreate={() => navigate('/forums')} />
      )}
    </>
  );
}
