// src/pages/forums/SubjectGroupChat.jsx
// WhatsApp-style group chat — subject chats + student-created study groups

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  ArrowLeft, Send, X, Plus, Users, Lock, Globe,
  ChevronRight, Search, Check, UserPlus, Trash2, LogOut
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
const WA_BG    = '#E5DDD5';
const WA_GREEN = '#075E54';
const WA_SENT  = '#DCF8C6';
const WA_SEND_BTN = '#25D366';

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name = '?', src, size = 8, textSize = 'text-xs' }) {
  const colors = ['#25D366','#128C7E','#075E54','#34B7F1','#ECB22E','#E01E5A'];
  const bg = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (src) return <img src={src} alt={name} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 ${textSize} font-bold text-white`}
      style={{ background: bg }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, isMine, showAvatar, isTeacher }) {
  const nameColor = isTeacher ? '#B8860B' : '#128C7E';
  return (
    <div className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {/* Left avatar — received messages only */}
      {!isMine && (
        <div className="w-7 flex-shrink-0 flex items-end pb-1">
          {showAvatar && <Avatar name={msg.author_name} src={msg.author_avatar} size={7} textSize="text-[10px]" />}
        </div>
      )}

      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {/* Reply preview */}
        {msg.reply_to_id && (
          <div className={`px-3 py-1.5 rounded-lg text-[11px] border-l-4 mb-0.5 max-w-full`}
            style={{ background: isMine ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.06)', borderColor: WA_GREEN }}>
            <p className="font-semibold" style={{ color: WA_GREEN }}>{msg.reply_author}</p>
            <p className="text-gray-600 truncate">{msg.reply_preview}</p>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-3 py-2 shadow-sm ${
            isMine
              ? 'rounded-tl-2xl rounded-br-2xl rounded-bl-2xl'
              : 'rounded-tr-2xl rounded-br-2xl rounded-bl-2xl'
          }`}
          style={{ background: isMine ? WA_SENT : 'white' }}
        >
          {/* Sender name (received only, first bubble in run) */}
          {!isMine && showAvatar && (
            <p className="text-[11px] font-semibold mb-0.5" style={{ color: nameColor }}>
              {msg.author_name}
              {isTeacher && <span className="ml-1 text-[9px] opacity-70">⭐ Tutor</span>}
            </p>
          )}

          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>

          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[9px] text-gray-400">{formatTime(msg.created_date)}</span>
            {isMine && <span className="text-[10px] text-blue-400">✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chat view for a single group ──────────────────────────────────────────────
function ChatView({ group, user, onBack }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, body, author_name }
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['groupChat', group.id],
    queryFn: () => db.entities.GroupChatMessage.filter({ group_id: group.id, deleted: false }, 'created_date', 200),
    refetchInterval: 4000,
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

  const isMember = group.member_ids?.includes(user?.id) || group.creator_id === user?.id;

  return (
    <div className="flex flex-col" style={{ background: WA_BG, height: 'calc(100dvh - 0px)', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 flex-shrink-0 shadow-sm" style={{ background: WA_GREEN }}>
        <button onClick={onBack} className="p-1 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: '#128C7E' }}>
          {group.icon || '💬'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white leading-none truncate">{group.name}</p>
          <p className="text-[11px] text-white/60 mt-0.5">
            {group.member_count || 1} member{(group.member_count || 1) !== 1 ? 's' : ''}
            {group.subject_name ? ` · ${group.subject_name}` : ''}
          </p>
        </div>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 pb-4">
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

      {/* Input area */}
      <div className="flex-shrink-0 px-3 pb-[80px] pt-2 bg-white/80 backdrop-blur-sm border-t border-gray-200">
        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border-l-4"
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
          <div className="text-center text-sm text-gray-500 py-2">
            <a href="/login" className="font-semibold underline" style={{ color: WA_GREEN }}>Log in</a> to join the conversation
          </div>
        ) : !isMember ? (
          <div className="text-center text-sm text-gray-500 py-2">
            Join this group to send messages
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 rounded-2xl px-4 py-2.5 text-sm bg-white border border-gray-200 outline-none resize-none leading-relaxed"
              style={{ maxHeight: 120, overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sendMutation.isPending}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
              style={{ background: WA_SEND_BTN }}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
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

// ── Add members modal ─────────────────────────────────────────────────────────
function AddMembersModal({ group, user, onClose }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-add'],
    queryFn: () => db.entities.User.list('full_name', 200),
    staleTime: 60_000,
  });

  const eligible = useMemo(() => students.filter(s =>
    s.id !== user?.id &&
    !(group.member_ids || []).includes(s.id) &&
    (!search || (s.full_name || s.email || '').toLowerCase().includes(search.toLowerCase()))
  ), [students, group.member_ids, search, user?.id]);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAdd = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      const toAdd = students.filter(s => selected.includes(s.id));
      const newIds = [...(group.member_ids || []), ...selected];
      const newNames = [...(group.member_names || []), ...toAdd.map(s => s.full_name || s.email)];
      await db.entities.StudyGroup.update(group.id, {
        member_ids: newIds,
        member_names: newNames,
        member_count: newIds.length,
      });
      qc.invalidateQueries({ queryKey: ['studyGroups'] });
      qc.invalidateQueries({ queryKey: ['studyGroup', group.id] });
      onClose();
    } catch (e) {
      console.error('Add members failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: WA_GREEN }}>
          <button onClick={onClose}><X className="w-5 h-5 text-white" /></button>
          <p className="font-bold text-white text-sm">Add Members</p>
          {selected.length > 0 && (
            <span className="ml-auto text-xs text-white/80">{selected.length} selected</span>
          )}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none"
            />
          </div>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto">
          {eligible.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No students found</p>
          )}
          {eligible.map(s => (
            <button key={s.id} onClick={() => toggle(s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50">
              <Avatar name={s.full_name || s.email || '?'} src={s.avatar_url} size={9} />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.full_name || s.email}</p>
                {s.full_name && <p className="text-[11px] text-gray-400 truncate">{s.email}</p>}
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected.includes(s.id) ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                {selected.includes(s.id) && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Add button */}
        <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleAdd}
            disabled={!selected.length || saving}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            style={{ background: WA_GREEN }}>
            {saving ? 'Adding…' : `Add ${selected.length || ''} Member${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Groups list ───────────────────────────────────────────────────────────────
function GroupsList({ user, subjectSlug, onOpenChat }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [addMembersGroup, setAddMembersGroup] = useState(null);
  const [search, setSearch] = useState('');

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 300_000,
  });

  const { data: allGroups = [], isLoading } = useQuery({
    queryKey: ['studyGroups'],
    queryFn: () => db.entities.StudyGroup.filter({ status: 'active' }, '-last_message_at', 100),
    refetchInterval: 10_000,
    staleTime: 0,
  });

  // My groups = member + creator
  const myGroups = useMemo(() =>
    allGroups.filter(g =>
      g.creator_id === user?.id || (g.member_ids || []).includes(user?.id)
    ), [allGroups, user?.id]);

  // Discover = public groups I haven't joined
  const discoverGroups = useMemo(() =>
    allGroups.filter(g =>
      !g.is_private &&
      g.creator_id !== user?.id &&
      !(g.member_ids || []).includes(user?.id)
    ), [allGroups, user?.id]);

  const filtered = (list) => !search ? list : list.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.subject_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleJoin = async (group) => {
    if (!user?.id) return;
    try {
      const newIds = [...(group.member_ids || []), user.id];
      const newNames = [...(group.member_names || []), user.full_name || user.email];
      await db.entities.StudyGroup.update(group.id, {
        member_ids: newIds,
        member_names: newNames,
        member_count: newIds.length,
      });
      qc.invalidateQueries({ queryKey: ['studyGroups'] });
    } catch (e) {
      console.error('Join failed:', e);
    }
  };

  const handleLeave = async (group) => {
    if (!user?.id) return;
    try {
      const newIds = (group.member_ids || []).filter(id => id !== user.id);
      const newNames = (group.member_names || []).filter((_, i) => (group.member_ids || [])[i] !== user.id);
      await db.entities.StudyGroup.update(group.id, {
        member_ids: newIds,
        member_names: newNames,
        member_count: newIds.length,
      });
      qc.invalidateQueries({ queryKey: ['studyGroups'] });
    } catch (e) {
      console.error('Leave failed:', e);
    }
  };

  const GroupCard = ({ group }) => {
    const isCreator = group.creator_id === user?.id;
    const isMember = (group.member_ids || []).includes(user?.id);
    return (
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => onOpenChat(group)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: '#e8f5e9' }}>
            {group.icon || '💬'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm text-gray-900 truncate">{group.name}</p>
              {group.is_private && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
            </div>
            {group.subject_name && (
              <p className="text-[11px] text-green-700 font-medium">{group.subject_name}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {group.last_message || (isCreator ? 'You created this group' : 'No messages yet')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[10px] text-gray-400">
              {group.member_count || 1} member{(group.member_count || 1) !== 1 ? 's' : ''}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </button>

        {/* Action row */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-50 bg-gray-50/50">
          {isCreator && (
            <button
              onClick={() => setAddMembersGroup(group)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
              style={{ background: WA_GREEN }}>
              <UserPlus className="w-3 h-3" /> Add Members
            </button>
          )}
          {!isCreator && isMember && (
            <button
              onClick={() => handleLeave(group)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-red-600 bg-red-50">
              <LogOut className="w-3 h-3" /> Leave
            </button>
          )}
          {!isMember && !group.is_private && (
            <button
              onClick={() => handleJoin(group)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
              style={{ background: WA_SEND_BTN }}>
              <Plus className="w-3 h-3" /> Join
            </button>
          )}
          <span className="ml-auto text-[10px] text-gray-400">
            By {group.creator_name?.split(' ')[0]}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col" style={{ background: '#F0F2F5', height: 'calc(100dvh - 0px)', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 shadow-sm" style={{ background: WA_GREEN }}>
        <p className="font-bold text-white text-base flex-1">Study Groups</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Group
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none bg-gray-50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[80px]">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* My groups */}
            {myGroups.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">My Groups</p>
                <div className="space-y-3">
                  {filtered(myGroups).map(g => <GroupCard key={g.id} group={g} />)}
                </div>
              </div>
            )}

            {/* Discover */}
            {discoverGroups.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Discover Groups</p>
                <div className="space-y-3">
                  {filtered(discoverGroups).map(g => <GroupCard key={g.id} group={g} />)}
                </div>
              </div>
            )}

            {/* Empty */}
            {myGroups.length === 0 && discoverGroups.length === 0 && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">💬</div>
                <p className="font-semibold text-gray-700 mb-1">No groups yet</p>
                <p className="text-sm text-gray-400 mb-5">Create a study group and invite your classmates!</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
                  style={{ background: WA_GREEN }}>
                  Create First Group
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateGroupModal
          user={user}
          subjects={subjects}
          onClose={() => setShowCreate(false)}
          onCreate={(group) => {
            qc.invalidateQueries({ queryKey: ['studyGroups'] });
            onOpenChat(group);
          }}
        />
      )}
      {addMembersGroup && (
        <AddMembersModal
          group={addMembersGroup}
          user={user}
          onClose={() => setAddMembersGroup(null)}
        />
      )}
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

  // If coming from a subject forum, auto-open/create the subject's official group
  const { data: subjectGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['studyGroups-subject', subjectSlug],
    queryFn: async () => {
      const subject = location.state?.subject;
      if (!subject) return [];
      return db.entities.StudyGroup.filter({ subject_id: subject.id, status: 'active' }, '-created_date', 10);
    },
    enabled: !!subjectSlug && !!location.state?.subject,
    staleTime: 30_000,
  });

  const createdGroupRef = useRef(false);

  // If a subject is provided, create the official subject group on first load if it doesn't exist
  useEffect(() => {
    const subject = location.state?.subject;
    if (!subject || !user?.id || groupsLoading) return;
    if (subjectGroups.length > 0) {
      // Auto-open the first official group for this subject
      if (!activeGroup) setActiveGroup(subjectGroups[0]);
      return;
    }
    if (createdGroupRef.current) return; // prevent duplicate creation
    // Create the official group for this subject
    const createOfficialGroup = async () => {
      try {
        const g = await db.entities.StudyGroup.create({
          name: `${subject.name} Group`,
          description: `Official study group for ${subject.name}`,
          icon: '📚',
          subject_id: subject.id,
          subject_name: subject.name,
          creator_id: user.id,
          creator_name: user.full_name || user.email,
          member_ids: [user.id],
          member_names: [user.full_name || user.email],
          member_count: 1,
          is_private: false,
          status: 'active',
        });
        setActiveGroup(g);
      } catch (e) {
        console.error('Create official group failed:', e);
      }
    };
    if (subjectGroups.length === 0) {
      createdGroupRef.current = true;
      createOfficialGroup();
    }
  }, [subjectGroups, groupsLoading, location.state?.subject, user?.id, activeGroup]);

  if (activeGroup) {
    return (
      <ChatView
        group={activeGroup}
        user={user}
        onBack={() => setActiveGroup(null)}
      />
    );
  }

  return (
    <GroupsList
      user={user}
      subjectSlug={subjectSlug}
      onOpenChat={setActiveGroup}
    />
  );
}
