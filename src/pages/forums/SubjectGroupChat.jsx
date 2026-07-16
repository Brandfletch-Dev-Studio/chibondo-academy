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
function ChatView({ group, user, onBack, subjects, onNewGroupClick }) {
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

        {/* 'New Group' Button in the chat view header */}
        {user?.id && (
          <button
            onClick={onNewGroupClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition-colors mr-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Group</span>
          </button>
        )}

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
