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

  const isMember = group.id === 'community-global' || group.member_ids?.includes(user?.id) || group.creator_id === user?.id;

  return (
    <div className="flex flex-col" style={{ background: WA_BG, height: 'calc(100dvh - 0px)', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 flex-shrink-0 shadow-sm" style={{ background: WA_GREEN }}>
        <button onClick={onBack} className="p-1 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <GroupAvatar src={group.icon_url} icon={group.icon} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white leading-none truncate">{group.name}</p>
          <p className="text-[11px] text-white/60 mt-0.5">
            {group.id === 'community-global'
              ? 'Official community · All members'
              : `${group.member_count || 1} member${(group.member_count || 1) !== 1 ? 's' : ''}${group.subject_name ? ' · ' + group.subject_name : ''}`
            }
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
      <div className="flex-shrink-0 px-3 pt-2 bg-white/80 backdrop-blur-sm border-t border-gray-200" style={{ paddingBottom: 'max(80px, env(safe-area-inset-bottom, 80px))' }}>
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
  const [iconUrl, setIconUrl] = useState(null);
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
            <p className="text-xs font-semibold text-gray-500 mb-2">Group Photo</p>
            <div className="flex items-center gap-3 mb-3">
              <IconUploadButton
                currentIcon={icon}
                currentIconUrl={iconUrl}
                onUploaded={(url) => setIconUrl(url)}
                size={48}
              />
              <p className="text-xs text-gray-400">Tap to upload a group photo, or pick an emoji below</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(e => (
                <button key={e} onClick={() => { setIcon(e); setIconUrl(null); }}
                  className={`w-9 h-9 rounded-full text-lg flex items-center justify-center transition-all ${icon === e && !iconUrl ? 'scale-110' : 'hover:scale-105'}`}
                  style={icon === e && !iconUrl ? { boxShadow: `0 0 0 2px ${WA_GREEN}`, background: '#e8f5e9' } : { background: '#f5f5f5' }}>
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

// ── Avatar helper ────────────────────────────────────────────────────────────
// Default: WhatsApp-style group icon SVG if no image set
function GroupAvatar({ src, icon, size = 40, className = '' }) {
  if (src) {
    return (
      <img
        src={src}
        alt="group"
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  if (icon && icon !== '📚' && icon.length <= 4) {
    return (
      <div
        className={`rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size, background: '#128C7E', fontSize: size * 0.45 }}
      >
        {icon}
      </div>
    );
  }
  // Default WhatsApp-style generic group SVG
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: '#DFE5E7' }}
    >
      <svg viewBox="0 0 212 212" style={{ width: size * 0.65, height: size * 0.65 }}>
        <path fill="#BEC5C9" d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z"/>
        <path fill="#FFF" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.023-7.030c-1.741-.99-3.528-1.929-5.358-2.809-.872-.41-1.750-.81-2.634-1.195a44.34 44.34 0 0 0-1.793-.762 38.713 38.713 0 0 0-2.374-.897 30.038 30.038 0 0 0-2.399-.666 25.792 25.792 0 0 0-2.427-.438 22.956 22.956 0 0 0-2.458-.21 22.2 22.2 0 0 0-2.491.042 21.86 21.86 0 0 0-2.526.317 23.28 23.28 0 0 0-2.562.597 27.29 27.29 0 0 0-2.601.893 32.63 32.63 0 0 0-2.641 1.208 38.63 38.63 0 0 0-2.682 1.543 44.92 44.92 0 0 0-2.723 1.907c-.456.345-.905.699-1.350 1.064-.225.182-.447.368-.667.558-.22.19-.438.382-.655.577-.216.195-.43.393-.643.593-.43.403-.853.815-1.267 1.234-.211.21-.42.422-.627.637-.207.215-.412.433-.614.653-.202.220-.402.442-.599.666-.196.224-.390.450-.581.678-.192.230-.380.462-.566.696-.186.234-.369.470-.549.709-.180.239-.356.480-.530.724-.174.244-.344.490-.511.739-.167.249-.330.500-.490.754-.160.254-.316.510-.469.769-.153.259-.302.520-.447.784-.146.264-.287.530-.426.799-.138.269-.273.540-.404.815-.131.275-.258.552-.382.832-.124.280-.245.562-.363.847a62.79 62.79 0 0 0-.642 1.712 63.53 63.53 0 0 0-.571 1.77 60.97 60.97 0 0 0-.5 1.826 57.31 57.31 0 0 0-.43 1.882 54.47 54.47 0 0 0-.357 1.934 51.48 51.48 0 0 0-.285 1.984 48.95 48.95 0 0 0-.213 2.033 47.13 47.13 0 0 0-.14 2.080 46.01 46.01 0 0 0-.066 2.125c-.012.71-.013 1.420.0 2.130h141.922c.013-.71.012-1.420 0-2.130a46.01 46.01 0 0 0-.066-2.125 47.13 47.13 0 0 0-.140-2.080 48.95 48.95 0 0 0-.213-2.033 51.48 51.48 0 0 0-.285-1.984 54.47 54.47 0 0 0-.357-1.934 57.31 57.31 0 0 0-.43-1.882 60.97 60.97 0 0 0-.5-1.826 63.53 63.53 0 0 0-.571-1.770 62.79 62.79 0 0 0-.642-1.712c-.118-.285-.239-.567-.363-.847-.124-.280-.251-.557-.382-.832-.131-.275-.266-.546-.404-.815-.139-.269-.280-.535-.426-.799-.146-.264-.294-.525-.447-.784-.153-.259-.309-.515-.469-.769-.160-.254-.323-.505-.490-.754-.167-.249-.337-.495-.511-.739-.174-.244-.350-.485-.530-.724-.186-.234-.374-.466-.566-.696-.191-.230-.385-.456-.581-.678-.197-.224-.397-.446-.599-.666-.202-.220-.407-.438-.614-.653-.207-.215-.416-.427-.627-.637-.414-.419-.837-.831-1.267-1.234-.213-.200-.427-.398-.643-.593-.217-.195-.435-.387-.655-.577-.220-.190-.444-.376-.667-.558-.445-.365-.894-.719-1.350-1.064a44.92 44.92 0 0 0-2.723-1.907 38.63 38.63 0 0 0-2.682-1.543 32.63 32.63 0 0 0-2.641-1.208 27.29 27.29 0 0 0-2.601-.893 23.28 23.28 0 0 0-2.562-.597 21.86 21.86 0 0 0-2.526-.317 22.2 22.2 0 0 0-2.491-.042 22.956 22.956 0 0 0-2.458.210 25.792 25.792 0 0 0-2.427.438 30.038 30.038 0 0 0-2.399.666 38.713 38.713 0 0 0-2.374.897 44.34 44.34 0 0 0-1.793.762c-.884.385-1.762.785-2.634 1.195-1.830.880-3.617 1.819-5.358 2.809a72.458 72.458 0 0 0-10.023 7.030 71.097 71.097 0 0 0-5.924 5.470 70.112 70.112 0 0 0-3.184 3.527 67.7 67.7 0 0 0-2.608 3.299 62.767 62.767 0 0 0-2.065 2.955z"/>
        <path fill="#FFF" d="M106.25 93.75c14.912 0 27-12.088 27-27s-12.088-27-27-27-27 12.088-27 27 12.088 27 27 27z"/>
      </svg>
    </div>
  );
}

// ── Image upload helper ───────────────────────────────────────────────────────
function IconUploadButton({ currentIcon, currentIconUrl, onUploaded, size = 40 }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await db.storage.upload('group-icons', `${Date.now()}-${file.name}`, file);
      const url = db.storage.getPublicUrl('group-icons', uploaded.path || uploaded.Key || uploaded.key);
      onUploaded(url);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="relative inline-block cursor-pointer" onClick={() => inputRef.current?.click()}>
      <GroupAvatar src={currentIconUrl} icon={currentIcon} size={size} />
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
        style={{ borderRadius: '50%' }}
      >
        {uploading
          ? <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
          : <Camera className="w-4 h-4 text-white" />
        }
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
// Architecture: subject chats and community chat need NO StudyGroup record.
// group_id for subject chat = "subject-{subject.id}"
// group_id for community    = "community-global"  
// Only user-created custom groups have a StudyGroup record.
export default function SubjectGroupChat() {
  const navigate = useNavigate();
  const { subjectSlug } = useParams();
  const location = useLocation();
  const { user } = useOutletContext() ?? {};
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const isCommunity = subjectSlug === 'community' || location.state?.isCommunity;
  const isCustomGroup = !!location.state?.group;

  // Subjects list for CreateGroupModal
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 300_000,
  });

  // ── Resolve which group we're in ─────────────────────────────────────────────
  // Custom group from My Groups — use directly from state
  if (isCustomGroup) {
    const group = location.state.group;
    return (
      <>
        <ChatView group={group} user={user} onBack={() => navigate('/forums')}
          subjects={subjects} onNewGroupClick={() => setShowCreateGroup(true)} />
        {showCreateGroup && (
          <CreateGroupModal user={user} subjects={subjects}
            onClose={() => setShowCreateGroup(false)} onCreate={() => navigate('/forums')} />
        )}
      </>
    );
  }

  // Community or Subject chat — build a virtual group object without DB lookup
  // This is instant — no async, no spinner
  return (
    <SubjectChatLoader
      subjectSlug={subjectSlug}
      isCommunity={isCommunity}
      locationState={location.state}
      user={user}
      subjects={subjects}
      navigate={navigate}
      showCreateGroup={showCreateGroup}
      setShowCreateGroup={setShowCreateGroup}
    />
  );
}

// ── SubjectChatLoader — resolves subject info then renders immediately ────────
function SubjectChatLoader({ subjectSlug, isCommunity, locationState, user, subjects, navigate, showCreateGroup, setShowCreateGroup }) {
  // If subject was passed via state, use it immediately — no DB lookup needed
  const subjectFromState = locationState?.subject;

  // Fallback: look up subject by slug when navigating directly by URL
  const { data: subjectFromDB, isLoading: subjectLoading } = useQuery({
    queryKey: ['subject-by-slug', subjectSlug],
    queryFn: async () => {
      const all = await db.entities.Subject.filter({ status: 'published' }, 'name', 100);
      const slug = subjectSlug.toLowerCase();
      return all.find(s =>
        s.name.toLowerCase().replace(/\s+/g, '-') === slug ||
        s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug ||
        slug.includes(s.name.toLowerCase().split(' ')[1]?.toLowerCase() || '__')
      ) || all.find(s => s.name.toLowerCase().includes(slug.split('-')[0])) || null;
    },
    enabled: !isCommunity && !subjectFromState,
    staleTime: 300_000,
  });

  const subject = subjectFromState || subjectFromDB;

  // Build the virtual group object (no DB write needed for system chats)
  let group = null;
  if (isCommunity) {
    group = {
      id: 'community-global',
      name: 'Chibondo Academy',
      icon: '🎓',
      icon_url: null,
      member_count: null, // shows "All members"
      subject_name: null,
      creator_id: 'system',
    };
  } else if (subject) {
    group = {
      id: `subject-${subject.id}`,
      name: `${subject.name} Group`,
      icon: getSubjectIcon(subject.name),
      icon_url: null,
      member_count: null,
      subject_name: subject.name,
      subject_id: subject.id,
      creator_id: 'system',
    };
  }

  // Still resolving subject from DB
  if (!isCommunity && !subject && subjectLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: WA_GREEN }} />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  // Subject not found
  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <p className="text-base font-semibold text-gray-600">Subject not found</p>
        <button onClick={() => navigate('/forums')}
          className="px-4 py-2 text-white rounded-xl text-sm font-semibold"
          style={{ background: WA_GREEN }}>
          Back to Forums
        </button>
      </div>
    );
  }

  return (
    <>
      <ChatView group={group} user={user} onBack={() => navigate('/forums')}
        subjects={subjects} onNewGroupClick={() => setShowCreateGroup(true)} />
      {showCreateGroup && (
        <CreateGroupModal user={user} subjects={subjects}
          onClose={() => setShowCreateGroup(false)} onCreate={() => navigate('/forums')} />
      )}
    </>
  );
}

// Helper: pick emoji for subject
function getSubjectIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('bio')) return '🧬';
  if (n.includes('chem')) return '⚗️';
  if (n.includes('phys')) return '⚡';
  if (n.includes('math')) return '📐';
  if (n.includes('english') || n.includes('literature')) return '📖';
  if (n.includes('chichewa')) return '🗣️';
  if (n.includes('agri')) return '🌱';
  if (n.includes('geo')) return '🌍';
  if (n.includes('hist')) return '📜';
  return '💬';
}
