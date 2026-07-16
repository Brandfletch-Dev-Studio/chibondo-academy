// src/pages/forums/SubjectGroupChat.jsx
// Polished WhatsApp-style group chat — ACA navy/gold theme
// Runs INSIDE the normal AppLayout (TopBar + BottomNav always visible)

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  ArrowLeft, MoreVertical, Camera, X, Users,
  Image as ImageIcon, Send, Smile, Palette, Check, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const NAVY = '#0d1b4b';
const GOLD = '#D4AF37';

// ── Chat themes ───────────────────────────────────────────────────────────────
const THEMES = {
  classic: {
    label: 'Classic',
    bg: '#E5DDD5',
    sent: '#DCF8C6',
    header: NAVY,
    inputBg: '#F0F2F5',
    pattern: null,
  },
  midnight: {
    label: 'Midnight',
    bg: '#1a1a2e',
    sent: '#16213e',
    received: '#0f3460',
    header: '#16213e',
    inputBg: '#16213e',
    textColor: '#e0e0e0',
    pattern: null,
  },
  ocean: {
    label: 'Ocean',
    bg: '#e8f4f8',
    sent: '#b3e5fc',
    header: '#0277bd',
    inputBg: '#e1f5fe',
    pattern: null,
  },
  forest: {
    label: 'Forest',
    bg: '#e8f5e9',
    sent: '#c8e6c9',
    header: '#2e7d32',
    inputBg: '#f1f8e9',
    pattern: null,
  },
  royal: {
    label: 'Royal',
    bg: '#f3e5f5',
    sent: '#e1bee7',
    header: '#6a1b9a',
    inputBg: '#fce4ec',
    pattern: null,
  },
  aca: {
    label: 'ACA Gold',
    bg: '#fdf8ee',
    sent: '#fff3cd',
    header: NAVY,
    inputBg: '#f5f0e8',
    pattern: null,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const SUBJECT_ICON = n => {
  const l = (n || '').toLowerCase();
  if (l.includes('bio'))   return { icon: '🧬', color: '#00897B' };
  if (l.includes('chem'))  return { icon: '⚗️', color: '#7B1FA2' };
  if (l.includes('phys'))  return { icon: '⚡', color: '#1565C0' };
  if (l.includes('math'))  return { icon: '📐', color: '#E65100' };
  if (l.includes('eng') || l.includes('lit')) return { icon: '📖', color: '#2E7D32' };
  if (l.includes('chich')) return { icon: '🗣️', color: '#00695C' };
  if (l.includes('agri'))  return { icon: '🌱', color: '#558B2F' };
  if (l.includes('geo'))   return { icon: '🌍', color: '#00838F' };
  if (l.includes('hist'))  return { icon: '📜', color: '#BF360C' };
  return { icon: '💬', color: NAVY };
};

const NAME_COLORS = ['#E91E63','#9C27B0','#2196F3','#009688','#FF5722','#795548','#00BCD4','#4CAF50'];
const nameColor = id => NAME_COLORS[(id || 'a').charCodeAt(0) % NAME_COLORS.length];

const fmtTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDate = iso => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// ── Theme Picker ──────────────────────────────────────────────────────────────
function ThemePicker({ current, onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          background: 'white', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: 480,
          padding: '20px 16px 32px', boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: NAVY }}>Chat Theme</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => { onSelect(key); onClose(); }}
              style={{
                border: current === key ? `2px solid ${NAVY}` : '2px solid transparent',
                borderRadius: 14, overflow: 'hidden', cursor: 'pointer', padding: 0,
                boxShadow: current === key ? `0 0 0 3px ${GOLD}66` : '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {/* Mini preview */}
              <div style={{ height: 60, background: theme.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '6px 8px', position: 'relative' }}>
                <div style={{ height: 10, background: theme.received || 'white', borderRadius: 6, width: '60%', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }} />
                <div style={{ height: 10, background: theme.sent, borderRadius: 6, width: '50%', alignSelf: 'flex-end', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }} />
                {current === key && (
                  <div style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check style={{ width: 10, height: 10, color: 'white' }} />
                  </div>
                )}
              </div>
              <div style={{ background: theme.header, padding: '5px 8px', textAlign: 'center' }}>
                <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>{theme.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Edit Icon Modal (admin/tutor) ─────────────────────────────────────────────
function EditIconModal({ group, onClose, onSaved }) {
  const [tab, setTab]       = useState('emoji');
  const [emoji, setEmoji]   = useState(group.icon || '💬');
  const [url, setUrl]       = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef             = useRef(null);

  const EMOJIS = ['💬','📚','⚡','🧬','⚗️','📐','📖','🌍','📜','🌱','🏆','🎯','🔥','💡','✏️','🎓','🦁','🚀','🌟','📊'];

  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `group-icons/${group.id}.${ext}`;
      await db.storage.upload('public', path, file);
      const { publicUrl } = db.storage.getPublicUrl('public', path);
      setUrl(publicUrl || '');
      toast.success('Image ready');
    } catch (e) {
      toast.error('Upload failed');
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = tab === 'upload' && url
        ? { icon_url: url, icon: null }
        : { icon: emoji, icon_url: null };
      await db.entities.StudyGroup.update(group.id, updates);
      onSaved({ ...group, ...updates });
      toast.success('Icon updated ✓');
      onClose();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Edit Group Icon</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          {['emoji', 'upload'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'none',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              borderBottom: tab === t ? `2px solid ${NAVY}` : '2px solid transparent',
              color: tab === t ? NAVY : '#999',
            }}>
              {t === 'emoji' ? '😊 Emoji' : '🖼️ Photo'}
            </button>
          ))}
        </div>
        <div style={{ padding: 16 }}>
          {tab === 'emoji' ? (
            <>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px' }}>Choose an emoji icon</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)} style={{
                    width: 42, height: 42, borderRadius: '50%', fontSize: 20, cursor: 'pointer',
                    border: emoji === e ? `2px solid ${NAVY}` : '1px solid #eee',
                    background: emoji === e ? `${NAVY}12` : '#fafafa',
                  }}>{e}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <button onClick={() => fileRef.current?.click()} style={{
                width: '100%', border: `2px dashed ${NAVY}`, borderRadius: 12, padding: '20px 0',
                background: `${NAVY}06`, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8, marginBottom: 12,
              }}>
                <ImageIcon style={{ width: 28, height: 28, color: NAVY, opacity: 0.6 }} />
                <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>Choose Photo</span>
              </button>
              {url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 10, marginBottom: 10 }}>
                  <img src={url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Image ready</span>
                </div>
              )}
            </>
          )}
          <button onClick={handleSave} disabled={saving || (tab === 'upload' && !url)} style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            background: (saving || (tab === 'upload' && !url)) ? '#ccc' : NAVY,
            color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 8,
          }}>
            {saving ? 'Saving…' : 'Save Icon'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showName, theme }) {
  const t         = THEMES[theme] || THEMES.classic;
  const color     = nameColor(msg.author_id);
  const isStaff   = msg.author_role === 'teacher' || msg.author_role === 'admin';
  const textColor = t.textColor || '#111';
  const receivedBg = t.received || 'white';

  return (
    <div style={{
      display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
      alignItems: 'flex-end', gap: 6, marginBottom: 3, padding: '0 10px',
    }}>
      {/* Avatar */}
      <div style={{ width: 28, flexShrink: 0 }}>
        {!isMine && showName && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'white', fontWeight: 700,
          }}>
            {(msg.author_name || '?')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%' }}>
        {msg.reply_preview && (
          <div style={{
            background: 'rgba(0,0,0,0.07)', borderLeft: `3px solid ${color}`,
            borderRadius: 6, padding: '3px 8px', marginBottom: 2, fontSize: 11, color: '#555',
          }}>
            <span style={{ fontWeight: 700, color }}>{msg.reply_author}: </span>
            {msg.reply_preview}
          </div>
        )}
        <div style={{
          background: isMine ? t.sent : receivedBg,
          borderRadius: isMine ? '14px 0 14px 14px' : '0 14px 14px 14px',
          padding: '7px 11px 6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
        }}>
          {!isMine && showName && (
            <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              {msg.author_name}
              {isStaff && (
                <span style={{
                  fontSize: 9, background: GOLD, color: NAVY,
                  borderRadius: 4, padding: '1px 5px', fontWeight: 800,
                }}>TUTOR ⭐</span>
              )}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 14, color: isMine ? '#111' : textColor, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {msg.body}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <span style={{ fontSize: 10, color: isMine ? '#888' : (theme === 'midnight' ? '#aaa' : '#aaa') }}>
              {fmtTime(msg.created_date)}
            </span>
            {isMine && <span style={{ fontSize: 11, color: '#53bdeb' }}>✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SubjectGroupChat() {
  const { subjectSlug }    = useParams();
  const navigate           = useNavigate();
  const location           = useLocation();
  const { user }           = useOutletContext() ?? {};
  const qc                 = useQueryClient();

  const [text, setText]         = useState('');
  const [replyTo, setReplyTo]   = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditIcon, setShowEditIcon] = useState(false);
  const [showTheme, setShowTheme]       = useState(false);
  const [localGroup, setLocalGroup]     = useState(null);

  // Theme persisted to localStorage per-group
  const themeKey = `chat-theme-${subjectSlug}`;
  const [theme, setTheme] = useState(() => localStorage.getItem(themeKey) || 'classic');

  const t = THEMES[theme] || THEMES.classic;
  const isPrivileged = user?.role === 'admin' || user?.role === 'teacher';

  const endRef      = useRef(null);
  const textareaRef = useRef(null);
  const menuRef     = useRef(null);

  // Passed-in subject / group from navigation state
  const navSubject = location.state?.subject;
  const navGroup   = location.state?.group;

  useEffect(() => {
    if (!showMenu) return;
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  const saveTheme = key => {
    setTheme(key);
    localStorage.setItem(themeKey, key);
  };

  // ── Load subjects / group ──────────────────────────────────────────────────
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-chat'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 300_000,
    initialData: navSubject ? [navSubject] : undefined,
  });

  const subject = useMemo(() =>
    subjects.find(s =>
      s.name.toLowerCase().replace(/\s+/g, '-') === subjectSlug ||
      s.id === subjectSlug || s.slug === subjectSlug
    ) || navSubject,
    [subjects, subjectSlug, navSubject]
  );

  const subjectMeta = useMemo(() => subject ? SUBJECT_ICON(subject.name) : { icon: '💬', color: NAVY }, [subject]);

  const virtualGroup = useMemo(() => subject ? ({
    id          : `subject-${subject.id}`,
    name        : `${subject.name} Chat`,
    icon        : subjectMeta.icon,
    icon_url    : null,
    member_count: subject.enrollment_count || null,
    type        : 'subject',
  }) : navGroup, [subject, subjectMeta, navGroup]);

  const { data: dbGroups = [] } = useQuery({
    queryKey: ['studyGroup-subject', subject?.id],
    queryFn: () => subject ? db.entities.StudyGroup.filter({ subject_id: subject.id, status: 'active' }, 'created_date', 1) : [],
    enabled: !!subject?.id,
    staleTime: 60_000,
  });

  const group = useMemo(() => localGroup || navGroup || dbGroups[0] || virtualGroup, [localGroup, navGroup, dbGroups, virtualGroup]);

  // ── Messages ───────────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['groupChat', group?.id],
    queryFn: () => group ? db.entities.GroupChatMessage.filter({ group_id: group.id }, 'created_date', 300) : [],
    enabled: !!group?.id,
    refetchInterval: 3000,
    staleTime: 0,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length < 4 ? 'instant' : 'smooth' });
  }, [messages.length]);

  const grouped = useMemo(() => {
    const result = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      if (!prev || !sameDay(prev.created_date, msg.created_date)) {
        result.push({ type: 'date', label: fmtDate(msg.created_date), key: `d-${i}` });
      }
      const showName = !prev || prev.author_id !== msg.author_id || !sameDay(prev.created_date, msg.created_date);
      result.push({ type: 'msg', msg, showName, key: msg.id });
    });
    return result;
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: payload => db.entities.GroupChatMessage.create(payload),
    onMutate: async payload => {
      await qc.cancelQueries({ queryKey: ['groupChat', group.id] });
      const prev = qc.getQueryData(['groupChat', group.id]) || [];
      qc.setQueryData(['groupChat', group.id], [
        ...prev,
        { ...payload, id: `tmp-${Date.now()}`, created_date: new Date().toISOString() },
      ]);
      return { prev };
    },
    onError: (_, __, ctx) => {
      qc.setQueryData(['groupChat', group.id], ctx.prev);
      toast.error('Message failed');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['groupChat', group.id] }),
  });

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id || !group) return;
    sendMutation.mutate({
      group_id   : group.id,
      author_id  : user.id,
      author_name: user.full_name || user.email?.split('@')[0] || 'Student',
      author_role: user.role || 'student',
      body       : trimmed,
      deleted    : false,
      ...(replyTo ? { reply_to_id: replyTo.id, reply_preview: replyTo.body.slice(0, 80), reply_author: replyTo.author_name } : {}),
    });
    setText('');
    setReplyTo(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, user, group, replyTo, sendMutation]);

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleTextChange = e => {
    setText(e.target.value);
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
  };

  if (!group) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ textAlign: 'center', color: '#aaa' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>💬</div>
          <p style={{ fontWeight: 600 }}>Loading chat…</p>
        </div>
      </div>
    );
  }

  const headerColor = t.header;

  return (
    <>
      {showTheme && <ThemePicker current={theme} onSelect={saveTheme} onClose={() => setShowTheme(false)} />}
      {showEditIcon && (
        <EditIconModal group={group} onClose={() => setShowEditIcon(false)} onSaved={setLocalGroup} />
      )}

      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100dvh - 112px)', /* fills between TopBar (56px) and BottomNav (56px) */
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        margin: '-8px -8px 0',
        maxWidth: '100%',
        background: t.bg,
      }}>

        {/* ── Header ── */}
        <div style={{
          flexShrink: 0, height: 58, background: headerColor,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 10px', zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <button onClick={() => navigate('/forums')} style={{
            background: 'none', border: 'none', color: 'white', cursor: 'pointer',
            padding: '6px', borderRadius: 8, display: 'flex', alignItems: 'center',
            flexShrink: 0,
          }}>
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </button>

          {/* Avatar */}
          <div
            onClick={isPrivileged ? () => setShowEditIcon(true) : undefined}
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
              background: subjectMeta.color || 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, border: `2px solid ${GOLD}66`,
              cursor: isPrivileged ? 'pointer' : 'default',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {(localGroup || group).icon_url
              ? <img src={(localGroup || group).icon_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <span>{(localGroup || group).icon || subjectMeta.icon}</span>
            }
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(localGroup || group).name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users style={{ width: 10, height: 10 }} />
              {group.member_count ? `${group.member_count} members` : 'Group chat'}
            </div>
          </div>

          {/* ⋮ Menu */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button onClick={() => setShowMenu(v => !v)} style={{
              background: 'none', border: 'none', color: 'white', cursor: 'pointer',
              padding: '6px', borderRadius: 8, display: 'flex', alignItems: 'center',
            }}>
              <MoreVertical style={{ width: 20, height: 20 }} />
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                background: 'white', borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)', minWidth: 190, zIndex: 200,
                overflow: 'hidden',
              }}>
                <button onClick={() => { setShowTheme(true); setShowMenu(false); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: 'none', border: 'none',
                  fontSize: 13, cursor: 'pointer', color: '#333', textAlign: 'left',
                }}>
                  <Palette style={{ width: 15, height: 15, color: '#888' }} /> Change Theme
                </button>
                {isPrivileged && (
                  <button onClick={() => { setShowEditIcon(true); setShowMenu(false); }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', background: 'none', border: 'none',
                    fontSize: 13, cursor: 'pointer', color: '#333', textAlign: 'left',
                    borderTop: '1px solid #f5f5f5',
                  }}>
                    <Camera style={{ width: 15, height: 15, color: '#888' }} /> Edit Group Icon
                  </button>
                )}
                <button onClick={() => { navigate('/forums'); setShowMenu(false); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: 'none', border: 'none',
                  fontSize: 13, cursor: 'pointer', color: '#333', textAlign: 'left',
                  borderTop: '1px solid #f5f5f5',
                }}>
                  <ArrowLeft style={{ width: 15, height: 15, color: '#888' }} /> Back to Chats
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', WebkitOverflowScrolling: 'touch' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 32, color: '#aaa', fontSize: 13 }}>Loading messages…</div>
          )}
          {!isLoading && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: theme === 'midnight' ? '#aaa' : '#999' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{(localGroup || group).icon || subjectMeta.icon}</div>
              <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>{(localGroup || group).name}</p>
              <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>No messages yet — say hello! 👋</p>
            </div>
          )}
          {grouped.map(item =>
            item.type === 'date' ? (
              <div key={item.key} style={{ textAlign: 'center', margin: '10px 0' }}>
                <span style={{
                  background: 'rgba(255,255,255,0.88)', padding: '3px 14px',
                  borderRadius: 12, fontSize: 11,
                  color: '#555', boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                }}>
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageBubble
                key={item.key}
                msg={item.msg}
                isMine={item.msg.author_id === user?.id}
                showName={item.showName}
                theme={theme}
              />
            )
          )}
          <div ref={endRef} style={{ height: 8 }} />
        </div>

        {/* ── Reply preview ── */}
        {replyTo && (
          <div style={{
            flexShrink: 0, background: 'rgba(255,255,255,0.95)',
            borderTop: '2px solid #25D366', padding: '7px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#25D366' }}>{replyTo.author_name}</span>
              <p style={{ margin: 0, fontSize: 12, color: '#555', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 260 }}>
                {replyTo.body}
              </p>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa' }}>×</button>
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{
          flexShrink: 0,
          background: t.inputBg || '#F0F2F5',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          padding: '8px 10px',
          display: 'flex', alignItems: 'flex-end', gap: 8,
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            rows={1}
            style={{
              flex: 1, borderRadius: 24, border: '1px solid rgba(0,0,0,0.1)',
              padding: '9px 14px', fontSize: 14, resize: 'none',
              background: 'white', outline: 'none', lineHeight: 1.4,
              maxHeight: 120, overflowY: 'auto', fontFamily: 'inherit',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: text.trim() ? '#25D366' : '#ccc',
              border: 'none', cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s, transform 0.1s',
              transform: text.trim() ? 'scale(1)' : 'scale(0.9)',
              boxShadow: text.trim() ? '0 2px 8px rgba(37,211,102,0.4)' : 'none',
            }}
          >
            <Send style={{ color: 'white', width: 18, height: 18, marginLeft: 2 }} />
          </button>
        </div>
      </div>
    </>
  );
}
