// src/pages/forums/SubjectGroupChat.jsx\n// WhatsApp-style group chat — subject chats + student-created study groups\n\nimport React, { useState, useEffect, useRef, useMemo } from 'react';\nimport { useParams, useNavigate, useLocation } from 'react-router-dom';\nimport { useOutletContext } from 'react-router-dom';\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { db } from '@/api/supabaseClient';\nimport {\n  ArrowLeft, Send, X, Plus, Users, Lock, Globe,\n  ChevronRight, Search, Check, UserPlus, Trash2, LogOut\n} from 'lucide-react';\n\n// ── Helpers ─────────────────────────────────────────────────────────────────\nfunction formatTime(iso) {\n  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });\n}\nfunction formatDateLabel(iso) {\n  const d = new Date(iso);\n  const today = new Date();\n  const yesterday = new Date();\n  yesterday.setDate(today.getDate() - 1);\n  if (d.toDateString() === today.toDateString()) return 'Today';\n  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';\n  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });\n}\nfunction sameDay(a, b) {\n  return new Date(a).toDateString() === new Date(b).toDateString();\n}\nconst WA_BG    = '#E5DDD5';\nconst WA_GREEN = '#075E54';\nconst WA_SENT  = '#DCF8C6';\nconst WA_SEND_BTN = '#25D366';\n\n// ── Avatar ───────────────────────────────────────────────────────────────────\nfunction Avatar({ name = '?', src, size = 8, textSize = 'text-xs' }) {\n  const colors = ['#25D366','#128C7E','#075E54','#34B7F1','#ECB22E','#E01E5A'];\n  const bg = colors[(name.charCodeAt(0) || 0) % colors.length];\n  if (src) return <img src={src} alt={name} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />;\n  return (\n    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 ${textSize} font-bold text-white`}\n      style={{ background: bg }}>\n      {name.charAt(0).toUpperCase()}\n    </div>\n  );\n}\n\n// ── Message bubble ────────────────────────────────────────────────────────────\nfunction Bubble({ msg, isMine, showAvatar, isTeacher }) {\n  const nameColor = isTeacher ? '#B8860B' : '#128C7E';\n  return (\n    <div className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>\n      {/* Left avatar — received messages only */}\n      {!isMine && (\n        <div className="w-7 flex-shrink-0 flex items-end pb-1">\n          {showAvatar && <Avatar name={msg.author_name} src={msg.author_avatar} size={7} textSize="text-[10px]" />}\n        </div>\n      )}\n\n      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>\n        {/* Reply preview */}\n        {msg.reply_to_id && (\n          <div className={`px-3 py-1.5 rounded-lg text-[11px] border-l-4 mb-0.5 max-w-full`}\n            style={{ background: isMine ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.06)', borderColor: WA_GREEN }}>\n            <p className="font-semibold" style={{ color: WA_GREEN }}>{msg.reply_author}</p>\n            <p className="text-gray-600 truncate">{msg.reply_preview}</p>\n          </div>\n        )}\n\n        {/* Bubble */}\n        <div\n          className={`px-3 py-2 shadow-sm ${\n            isMine\n              ? 'rounded-tl-2xl rounded-br-2xl rounded-bl-2xl'\n              : 'rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'\n          }`}\n          style={{ background: isMine ? WA_SENT : 'white' }}\n        >\n          {/* Sender name (received only, first bubble in run) */}\n          {!isMine && showAvatar && (\n            <p className="text-[11px] font-semibold mb-0.5" style={{ color: nameColor }}>\n              {msg.author_name}\n              {isTeacher && <span className="ml-1 text-[9px] opacity-70">⭐ Tutor</span>}\n            </p>\n          )}\n\n          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>\n\n          <div className="flex items-center justify-end gap-1 mt-1">\n            <span className="text-[9px] text-gray-400">{formatTime(msg.created_date)}</span>\n            {isMine && <span className="text-[10px] text-blue-400">✓✓</span>}\n          </div>\n        </div>\n      </div>\n    </div>\n  );\n}\n\n// ── Chat view for a single group ──────────────────────────────────────────────\nfunction ChatView({ group, user, onBack, subjects, onNewGroupClick }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, body, author_name }
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['groupChat', group.id],
    queryFn: () => db.entities.GroupChatMessage.filter({ group_id: group.id, deleted: false }, 'created_date', 200),
    refetchInterval: 3000,
    staleTime: 0,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length < 3 ? 'instant' : 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (payload) => db.entities.GroupChatMessage.create(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['groupChat', group.id] });
      // Update group last_message cache using the sent body (text is already cleared)
      db.entities.StudyGroup.update(group.id, {
        last_message: (variables.body || '').slice(0, 60),
        last_message_at: new Date().toISOString(),
      }).catch(() => {});
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id) return;
    const payload = {
      group_id: group.id,
      author_id: user.id,
      author_name: user.full_name || user.email?.split('@')[0] || 'Student',
      author_avatar: user.avatar_url || '',
      author_role: user.role || 'student',
      body: trimmed,
      deleted: false,
    };
    if (replyTo) {
      payload.reply_to_id = replyTo.id;
      payload.reply_preview = replyTo.body.slice(0, 80);
      payload.reply_author = replyTo.author_name;
    }
    sendMutation.mutate(payload);
    setText('');
    setReplyTo(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Build grouped messages with date separators
  const grouped = useMemo(() => {
    const result = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      if (!prev || !sameDay(prev.created_date, msg.created_date)) {
        result.push({ type: 'date', label: formatDateLabel(msg.created_date), key: `date-${i}` });
      }
      const showAvatar = !prev || prev.author_id !== msg.author_id || !sameDay(prev.created_date, msg.created_date);
      result.push({ type: 'msg', msg, showAvatar, key: msg.id });
    });
    return result;
  }, [messages]);

  const isMember = group.id === 'community-global' || group.member_ids?.includes(user?.id) || group.creator_id === user?.id;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 64px)',background:'#E5DDD5',overflow:'hidden'}}>
      {/* Header bar (first child, flex-shrink:0, ~56px) */}
      <div style={{background:'#1A237E',color:'white',display:'flex',alignItems:'center',gap:10,padding:'0 12px',height:56,flexShrink:0,position:'sticky',top:0,zIndex:10}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:'white',fontSize:22,cursor:'pointer',padding:'0 6px'}}>←</button>
        {/* Group avatar */}
        <div style={{width:38,height:38,borderRadius:'50%',background:'#2E7D32',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0,overflow:'hidden'}}>
          {group.icon_url ? <img src={group.icon_url} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span>{group.icon || '💬'}</span>}
        </div>
        {/* Title block */}
        <div style={{flex:1,overflow:'hidden'}}>
          <div style={{fontWeight:600,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{group.name}</div>
          <div style={{fontSize:12,opacity:0.75}}>{group.member_count ? `${group.member_count} members` : 'Group chat'}</div>
        </div>
        {/* Menu */}
        <button style={{background:'none',border:'none',color:'white',fontSize:22,cursor:'pointer',padding:'0 6px'}}>⋮</button>
      </div>

      {/* Messages area */}
      <div style={{flex:1,overflowY:'auto',padding:'12px 8px 8px'}}>
        {isLoading && (
          <div className="text-center text-sm text-gray-500 py-8">Loading messages…</div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">👋</div>
            <p className="text-sm text-gray-500 font-medium">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">Be the first to say something!</p>
          </div>
        )}
        {grouped.map(item =>
          item.type === 'date' ? (
            <div key={item.key} className="flex justify-center my-3">
              <span className="text-[11px] text-gray-500 bg-white/70 px-3 py-1 rounded-full shadow-sm">{item.label}</span>
            </div>
          ) : (
            <div key={item.key} onDoubleClick={() => { setReplyTo(item.msg); inputRef.current?.focus(); }}>
              <Bubble
                msg={item.msg}
                isMine={item.msg.author_id === user?.id}
                showAvatar={item.showAvatar}
                isTeacher={item.msg.author_role === 'teacher' || item.msg.author_role === 'admin'}
              />
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div style={{flexShrink:0,background:'#F0F0F0',padding:'8px 10px',display:'flex',alignItems:'flex-end',gap:8,borderTop:'1px solid #ddd'}}>
        {/* Reply preview if any */}
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border-l-4 w-full"
            style={{ background: '#f0f0f0', borderColor: WA_GREEN }}>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: WA_GREEN }}>{replyTo.author_name}</p>
              <p className="text-xs text-gray-500 truncate">{replyTo.body}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 rounded-full hover:bg-gray-200">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        )}

        {!user?.id ? (
          <div className="text-center text-sm text-gray-500 py-2 w-full">
            <a href="/login" className="font-semibold underline" style={{ color: WA_GREEN }}>Log in</a> to join the conversation
          </div>
        ) : !isMember ? (
          <div className="text-center text-sm text-gray-500 py-2 w-full">
            Join this group to send messages
          </div>
        ) : (
          <>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              style={{flex:1,borderRadius:20,border:'1px solid #ccc',padding:'8px 12px',fontSize:14,resize:'none',maxHeight:100,background:'white',outline:'none'}}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sendMutation.isPending}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                color: 'white',
                fontSize: 16
              }}
            >
              ➤
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Create group modal ────────────────────────────────────────────────────────
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
        name: name.trim(),
        description: description.trim(),
        icon,
        subject_id: subjectId || null,
        subject_name: subject?.name || null,
        creator_id: user.id,
        creator_name: user.full_name || user.email,
        member_ids: [user.id],
        member_names: [user.full_name || user.email],
        member_count: 1,
        is_private: isPrivate,
        status: 'active',
      });
      onCreate(group);
      onClose();
    } catch (e) {
      console.error('Create group failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: WA_GREEN }}>
          <button onClick={onClose}><X className="w-5 h-5 text-white" /></button>
          <p className="font-bold text-white text-sm">New Study Group</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Icon picker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Group Icon</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(e => (
                <button key={e} onClick={() => setIcon(e)}
                  className={`w-9 h-9 rounded-full text-lg flex items-center justify-center transition-all ${icon === e ? 'scale-110' : 'hover:scale-105'}`}
                  style={icon === e ? { boxShadow: `0 0 0 2px ${WA_GREEN}`, background: '#e8f5e9' } : { background: '#f5f5f5' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Group Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Form 4 Biology Squad"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500"
              maxLength={60}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Description (optional)</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this group about?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500"
              maxLength={120}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Subject (optional)</label>
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500 bg-white"
            >
              <option value="">— No specific subject —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Privacy */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
            <div className="flex items-center gap-2">
              {isPrivate ? <Lock className="w-4 h-4 text-gray-500" /> : <Globe className="w-4 h-4 text-gray-500" />}
              <div>
                <p className="text-sm font-medium text-gray-800">{isPrivate ? 'Private' : 'Public'}</p>
                <p className="text-[11px] text-gray-400">{isPrivate ? 'Invite only' : 'Anyone can join'}</p>
              </div>
            </div>
            <button
              onClick={() => setIsPrivate(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-40"
            style={{ background: WA_GREEN }}>
            {saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SubjectGroupChat() {
  const navigate = useNavigate();
  const { subjectSlug } = useParams();
  const location = useLocation();
  const { user } = useOutletContext() ?? {};
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const isCommunity = subjectSlug === 'community' || location.state?.isCommunity === true;

  // Subjects list for CreateGroupModal
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 300_000,
  });

  // Query for subject-based official group
  const { data: subjectGroupResult, isLoading: isGroupLoading } = useQuery({
    queryKey: ['subject-chat-group', subjectSlug, isCommunity],
    queryFn: async () => {
      if (isCommunity) {
        // Query by specific fixed group ID 'community-global'
        try {
          const existing = await db.entities.StudyGroup.get('community-global');
          if (existing && existing.status === 'active') {
            return existing;
          }
        } catch (e) {
          // If 404 or fails, we will create it below
        }

        // Try query filter in case id get lookup didn't work directly
        const list = await db.entities.StudyGroup.filter({ id: 'community-global' });
        if (list && list.length > 0) return list[0];

        // Create community-global study group if not exists
        return await db.entities.StudyGroup.create({
          id: 'community-global',
          name: 'Chibondo Academy',
          description: 'Official global community group chat',
          icon: '🎓',
          creator_id: 'system',
          creator_name: 'System',
          member_ids: user?.id ? [user.id] : [],
          member_names: user?.id ? [user.full_name || user.email] : [],
          member_count: user?.id ? 1 : 0,
          is_private: false,
          status: 'active',
        });
      } else {
        const subject = location.state?.subject;
        if (!subject) return null;

        // Query by subject_id to ensure a stable key and no duplicates
        const existingList = await db.entities.StudyGroup.filter({ subject_id: subject.id, status: 'active' });
        if (existingList && existingList.length > 0) {
          return existingList[0];
        }

        // Auto-create on first visit
        return await db.entities.StudyGroup.create({
          name: `${subject.name} Group`,
          description: `Official study group for ${subject.name}`,
          icon: '📚',
          subject_id: subject.id,
          subject_name: subject.name,
          creator_id: user?.id || 'system',
          creator_name: user ? (user.full_name || user.email) : 'System',
          member_ids: user?.id ? [user.id] : [],
          member_names: user?.id ? [user.full_name || user.email] : [],
          member_count: user?.id ? 1 : 0,
          is_private: false,
          status: 'active',
        });
      }
    },
    enabled: isCommunity || (!!subjectSlug && !!location.state?.subject),
    staleTime: 30_000,
  });

  // Auto-join membership hook/logic when the group is active
  useEffect(() => {
    if (!subjectGroupResult || !user?.id) return;
    const memberIds = subjectGroupResult.member_ids || [];
    if (!memberIds.includes(user.id)) {
      const updatedIds = [...memberIds, user.id];
      const updatedNames = [...(subjectGroupResult.member_names || []), user.full_name || user.email];
      db.entities.StudyGroup.update(subjectGroupResult.id, {
        member_ids: updatedIds,
        member_names: updatedNames,
        member_count: updatedIds.length,
      }).catch(err => {
        console.error('Silent auto-join failed:', err);
      });
    }
  }, [subjectGroupResult, user?.id]);

  // Keep activeGroup state synced or initialized to subjectGroupResult
  useEffect(() => {
    if (subjectGroupResult) {
      setActiveGroup(subjectGroupResult);
    }
  }, [subjectGroupResult]);

  if (isGroupLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
        <p className="text-sm">Loading Forum Chat...</p>
      </div>
    );
  }

  // Handle case where activeGroup is determined
  const displayedGroup = activeGroup || subjectGroupResult;

  if (displayedGroup) {
    return (
      <>
        <ChatView
          group={displayedGroup}
          user={user}
          onBack={() => navigate('/forums')}
          subjects={subjects}
          onNewGroupClick={() => setShowCreateGroup(true)}
        />
        {showCreateGroup && (
          <CreateGroupModal
            user={user}
            subjects={subjects}
            onClose={() => setShowCreateGroup(false)}
            onCreate={(newGroup) => {
              // On success, go to forums home where 'My Groups' section will display it
              navigate('/forums');
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-8 text-center text-gray-500">
      <p className="text-lg font-semibold">Chat room not found</p>
      <button
        onClick={() => navigate('/forums')}
        className="mt-4 px-4 py-2 text-white rounded-lg text-sm font-medium"
        style={{ background: WA_GREEN }}
      >
        Go to Forums
      </button>
    </div>
  );
}