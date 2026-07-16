// src/pages/forums/SubjectGroupChat.jsx
// WhatsApp-style group chat — lives INSIDE the normal app layout.
// The chat fills the available vertical space between TopBar and BottomNav.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { ArrowLeft, MoreVertical, Camera, X, Users, Lock, Globe, Image as ImageIcon, Send } from 'lucide-react';
import { toast } from 'sonner';

const WA_BG   = '#E5DDD5';
const WA_SENT = '#DCF8C6';
const NAVY    = '#0d1b4b';
const GOLD    = '#D4AF37';

// ── helpers ──────────────────────────────────────────────────────────────────
const SUBJECT_ICON = n => {
  const l = (n||'').toLowerCase();
  if (l.includes('bio'))   return '🧬';
  if (l.includes('chem'))  return '⚗️';
  if (l.includes('phys'))  return '⚡';
  if (l.includes('math'))  return '📐';
  if (l.includes('eng') || l.includes('lit')) return '📖';
  if (l.includes('chich')) return '🗣️';
  if (l.includes('agri'))  return '🌱';
  if (l.includes('geo'))   return '🌍';
  if (l.includes('hist'))  return '📜';
  return '💬';
};

const NAME_COLORS = ['#E91E63','#9C27B0','#2196F3','#009688','#FF5722','#795548','#00BCD4','#4CAF50'];
const nameColor  = id => NAME_COLORS[(id||'a').charCodeAt(0) % NAME_COLORS.length];

const fmtTime  = iso => new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const fmtDate  = iso => {
  const d    = new Date(iso);
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
};
const sameDay  = (a,b) => { const da=new Date(a),db=new Date(b); return da.toDateString()===db.toDateString(); };

// ── GroupAvatar ───────────────────────────────────────────────────────────────
function GroupAvatar({ src, icon, size=40, onClick, canEdit=false }) {
  return (
    <div
      onClick={onClick}
      style={{ width:size, height:size, borderRadius:'50%', flexShrink:0,
               background:'rgba(255,255,255,0.18)', overflow:'hidden',
               display:'flex', alignItems:'center', justifyContent:'center',
               cursor: canEdit ? 'pointer' : 'default', position:'relative' }}
    >
      {src
        ? <img src={src} alt="group" style={{width:'100%',height:'100%',objectFit:'cover'}} />
        : <span style={{fontSize:size*0.42,lineHeight:1}}>{icon||'💬'}</span>
      }
      {canEdit && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.35)', display:'flex',
                      alignItems:'center', justifyContent:'center', opacity:0,
                      transition:'opacity 0.15s' }}
             onMouseEnter={e=>e.currentTarget.style.opacity=1}
             onMouseLeave={e=>e.currentTarget.style.opacity=0}>
          <Camera style={{color:'white',width:14,height:14}} />
        </div>
      )}
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showName }) {
  const color     = nameColor(msg.author_id);
  const isTeacher = msg.author_role === 'teacher' || msg.author_role === 'admin';

  return (
    <div style={{ display:'flex', flexDirection: isMine ? 'row-reverse' : 'row',
                  alignItems:'flex-end', gap:6, marginBottom:3, paddingLeft:8, paddingRight:8 }}>
      {/* Avatar */}
      <div style={{width:28,flexShrink:0}}>
        {!isMine && showName && (
          <div style={{ width:28,height:28,borderRadius:'50%',background:color,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:11,color:'white',fontWeight:700,flexShrink:0 }}>
            {(msg.author_name||'?')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth:'78%' }}>
        {/* Reply quote */}
        {msg.reply_preview && (
          <div style={{ background:'rgba(0,0,0,0.07)', borderLeft:`3px solid ${color}`,
                        borderRadius:6, padding:'3px 8px', marginBottom:2, fontSize:11,
                        color:'#444', overflow:'hidden' }}>
            <span style={{fontWeight:700,color}}>{msg.reply_author}: </span>
            {msg.reply_preview}
          </div>
        )}
        <div style={{
          background   : isMine ? WA_SENT : 'white',
          borderRadius : isMine ? '12px 0 12px 12px' : '0 12px 12px 12px',
          padding      : '6px 10px 5px',
          boxShadow    : '0 1px 2px rgba(0,0,0,0.12)',
        }}>
          {!isMine && showName && (
            <div style={{ fontSize:11,fontWeight:700,color,marginBottom:2,display:'flex',alignItems:'center',gap:4 }}>
              {msg.author_name}
              {isTeacher && (
                <span style={{ fontSize:9, background:GOLD, color:NAVY,
                               borderRadius:4, padding:'1px 4px', fontWeight:700 }}>
                  TUTOR ⭐
                </span>
              )}
            </div>
          )}
          <p style={{ margin:0,fontSize:14,color:'#111',lineHeight:1.45,
                      wordBreak:'break-word',whiteSpace:'pre-wrap' }}>
            {msg.body}
          </p>
          <div style={{ display:'flex',justifyContent:'flex-end',alignItems:'center',
                        gap:3,marginTop:3 }}>
            <span style={{fontSize:10,color:'#aaa'}}>{fmtTime(msg.created_date)}</span>
            {isMine && <span style={{fontSize:11,color:'#53bdeb'}}>✓✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EditIconModal — admin / tutor only ────────────────────────────────────────
function EditIconModal({ group, onClose, onSaved }) {
  const [tab, setTab]       = useState('emoji'); // 'emoji' | 'upload'
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
      const result = await db.storage.upload('public', path, file);
      const { publicUrl } = db.storage.getPublicUrl('public', path);
      setUrl(publicUrl || result?.path || '');
      toast.success('Image uploaded');
    } catch(e) {
      toast.error('Upload failed: ' + (e.message||''));
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
      toast.success('Group icon updated');
      onClose();
    } catch(e) {
      toast.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.6)',
                  display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
      <div style={{ background:'white',borderRadius:20,width:'100%',maxWidth:380,
                    overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ background:NAVY,color:'white',display:'flex',
                      alignItems:'center',justifyContent:'space-between',padding:'14px 16px' }}>
          <span style={{fontWeight:700,fontSize:15}}>Edit Group Icon</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'white',cursor:'pointer'}}>
            <X style={{width:18,height:18}} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',borderBottom:'1px solid #eee' }}>
          {['emoji','upload'].map(t => (
            <button key={t} onClick={()=>setTab(t)}
              style={{ flex:1,padding:'10px 0',border:'none',background:'none',
                       fontWeight:600,fontSize:13,cursor:'pointer',
                       borderBottom: tab===t ? `2px solid ${NAVY}` : '2px solid transparent',
                       color: tab===t ? NAVY : '#888' }}>
              {t === 'emoji' ? '😊 Emoji' : '🖼️ Image'}
            </button>
          ))}
        </div>

        <div style={{padding:16}}>
          {tab === 'emoji' ? (
            <>
              <p style={{fontSize:12,color:'#888',marginBottom:10}}>Pick an emoji for the group</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={()=>setEmoji(e)}
                    style={{ width:42,height:42,borderRadius:'50%',border: emoji===e ? `2px solid ${NAVY}` : '1px solid #ddd',
                             background: emoji===e ? `${NAVY}15` : '#f9f9f9',fontSize:22,cursor:'pointer' }}>
                    {e}
                  </button>
                ))}
              </div>
              {/* Preview */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'#f5f5f5',borderRadius:10}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:NAVY,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{emoji}</div>
                <span style={{fontSize:13,color:'#555'}}>Preview of new group icon</span>
              </div>
            </>
          ) : (
            <>
              <p style={{fontSize:12,color:'#888',marginBottom:10}}>Upload a photo for the group</p>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFileChange} />
              <button onClick={()=>fileRef.current?.click()}
                style={{ width:'100%',border:`2px dashed ${NAVY}`,borderRadius:12,padding:'20px 16px',
                         background:`${NAVY}08`,cursor:'pointer',display:'flex',flexDirection:'column',
                         alignItems:'center',gap:8,marginBottom:12 }}>
                <ImageIcon style={{width:28,height:28,color:NAVY,opacity:0.7}} />
                <span style={{fontSize:13,color:NAVY,fontWeight:600}}>Choose Image</span>
                <span style={{fontSize:11,color:'#999'}}>JPG, PNG or WEBP</span>
              </button>
              {url && (
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f0fdf4',borderRadius:10,marginBottom:12}}>
                  <img src={url} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}} />
                  <span style={{fontSize:12,color:'#16a34a',fontWeight:600}}>✓ Image ready</span>
                </div>
              )}
            </>
          )}

          <button
            onClick={handleSave}
            disabled={saving || (tab==='upload' && !url)}
            style={{ width:'100%',padding:'12px 0',borderRadius:10,border:'none',
                     background: (saving||(tab==='upload'&&!url)) ? '#ccc' : NAVY,
                     color:'white',fontWeight:700,fontSize:14,cursor:'pointer',marginTop:8 }}>
            {saving ? 'Saving…' : 'Save Icon'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SubjectGroupChat() {
  const { subjectSlug }    = useParams();
  const navigate           = useNavigate();
  const { user }           = useOutletContext() ?? {};
  const qc                 = useQueryClient();
  const [text, setText]    = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditIcon, setShowEditIcon] = useState(false);
  const [localGroup, setLocalGroup] = useState(null);
  const endRef             = useRef(null);
  const textareaRef        = useRef(null);
  const menuRef            = useRef(null);

  const isPrivileged = user?.role === 'admin' || user?.role === 'teacher';

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // ── Load / resolve the StudyGroup for this subjectSlug ──
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-chat'],
    queryFn: () => db.entities.Subject.filter({ status: 'published' }, 'name', 100),
    staleTime: 300_000,
  });

  const subject = useMemo(() =>
    subjects.find(s =>
      s.name.toLowerCase().replace(/\s+/g,'-') === subjectSlug ||
      s.id === subjectSlug
    ), [subjects, subjectSlug]);

  // Virtual group for built-in subject chats (no DB record needed)
  const virtualGroup = useMemo(() => subject ? ({
    id          : `subject-${subject.id}`,
    name        : `${subject.name} Chat`,
    icon        : SUBJECT_ICON(subject.name),
    icon_url    : null,
    member_count: subject.enrollment_count || null,
    type        : 'subject',
    subject_id  : subject.id,
  }) : null, [subject]);

  // Try to find a real StudyGroup for this subject
  const { data: dbGroups = [] } = useQuery({
    queryKey: ['studyGroup-subject', subject?.id],
    queryFn: () => subject ? db.entities.StudyGroup.filter({ subject_id: subject.id, status: 'active' }, 'created_date', 1) : [],
    enabled: !!subject?.id,
    staleTime: 60_000,
  });

  const group = useMemo(() => localGroup || dbGroups[0] || virtualGroup, [localGroup, dbGroups, virtualGroup]);

  // ── Messages ──────────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['groupChat', group?.id],
    queryFn: () => group ? db.entities.GroupChatMessage.filter({ group_id: group.id }, 'created_date', 300) : [],
    enabled: !!group?.id,
    refetchInterval: 3000,
    staleTime: 0,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length < 4 ? 'instant' : 'smooth' });
  }, [messages.length]);

  // ── Group message items with date separators ──────────────────────────────
  const grouped = useMemo(() => {
    const result = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      if (!prev || !sameDay(prev.created_date, msg.created_date)) {
        result.push({ type:'date', label: fmtDate(msg.created_date), key:`d-${i}` });
      }
      const showName = !prev || prev.author_id !== msg.author_id ||
        !sameDay(prev.created_date, msg.created_date);
      result.push({ type:'msg', msg, showName, key: msg.id });
    });
    return result;
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: payload => db.entities.GroupChatMessage.create(payload),
    onMutate: async payload => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['groupChat', group.id] });
      const prev = qc.getQueryData(['groupChat', group.id]) || [];
      qc.setQueryData(['groupChat', group.id], [
        ...prev,
        { ...payload, id: `tmp-${Date.now()}`, created_date: new Date().toISOString() }
      ]);
      return { prev };
    },
    onError: (_, __, ctx) => {
      qc.setQueryData(['groupChat', group.id], ctx.prev);
      toast.error('Message failed to send');
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
      ...(replyTo ? { reply_to_id:replyTo.id, reply_preview:replyTo.body.slice(0,80), reply_author:replyTo.author_name } : {}),
    });
    setText('');
    setReplyTo(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, user, group, replyTo, sendMutation]);

  const handleKey = e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleTextChange = e => {
    setText(e.target.value);
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
  };

  if (!group) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-3">💬</div>
          <p className="font-semibold">Loading group…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // The chat fills the vertical space left by TopBar + BottomNav.
  // We use a flex column that occupies full height of the page content area.
  // The messages div is flex:1 and scrolls; the input bar is pinned at the bottom.
  return (
    <>
      {showEditIcon && (
        <EditIconModal
          group={group}
          onClose={() => setShowEditIcon(false)}
          onSaved={updated => setLocalGroup(updated)}
        />
      )}

      {/*
        Chat container: fills height of the main content area.
        The parent <main> in AppLayout has padding, so we use negative margin to
        bleed to the edges, then clip to create a clean inset chat look.
      */}
      <div style={{
        display        : 'flex',
        flexDirection  : 'column',
        height         : 'calc(100dvh - 112px)', /* 56px TopBar + 56px BottomNav */
        borderRadius   : 16,
        overflow       : 'hidden',
        border         : '1px solid rgba(0,0,0,0.08)',
        boxShadow      : '0 2px 16px rgba(0,0,0,0.10)',
        background     : WA_BG,
        margin         : '-8px -8px 0', /* bleed to layout edge on mobile */
        maxWidth       : '100%',
      }}>

        {/* ── Chat Header (navy, WhatsApp style) ── */}
        <div style={{
          flexShrink : 0,
          background : NAVY,
          color      : 'white',
          display    : 'flex',
          alignItems : 'center',
          gap        : 10,
          padding    : '0 12px',
          height     : 56,
          zIndex     : 10,
        }}>
          <button
            onClick={() => navigate('/forums')}
            style={{ background:'none',border:'none',color:'white',cursor:'pointer',
                     padding:'4px 6px',borderRadius:8,display:'flex',alignItems:'center' }}
          >
            <ArrowLeft style={{width:20,height:20}} />
          </button>

          {/* Group avatar — clickable for admin/tutor */}
          <GroupAvatar
            src={group.icon_url}
            icon={group.icon}
            size={38}
            canEdit={isPrivileged}
            onClick={isPrivileged ? () => setShowEditIcon(true) : undefined}
          />

          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontWeight:700,fontSize:15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
              {group.name}
            </div>
            <div style={{ fontSize:11,opacity:0.72,display:'flex',alignItems:'center',gap:4 }}>
              <Users style={{width:10,height:10}} />
              {group.member_count ? `${group.member_count} members` : 'Group chat'}
              {isPrivileged && (
                <span style={{ marginLeft:6, fontSize:9, background:GOLD, color:NAVY,
                               borderRadius:4, padding:'1px 5px', fontWeight:700 }}>
                  TUTOR
                </span>
              )}
            </div>
          </div>

          {/* ⋮ Menu */}
          <div style={{ position:'relative' }} ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{ background:'none',border:'none',color:'white',cursor:'pointer',
                       padding:'6px',borderRadius:8,display:'flex',alignItems:'center' }}
            >
              <MoreVertical style={{width:18,height:18}} />
            </button>
            {showMenu && (
              <div style={{ position:'absolute',right:0,top:'calc(100% + 4px)',background:'white',
                            borderRadius:12,boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
                            minWidth:180,zIndex:100,overflow:'hidden' }}>
                {isPrivileged && (
                  <button onClick={()=>{setShowEditIcon(true);setShowMenu(false);}}
                    style={{ width:'100%',display:'flex',alignItems:'center',gap:10,
                             padding:'11px 16px',background:'none',border:'none',
                             fontSize:14,cursor:'pointer',color:'#333',textAlign:'left' }}>
                    <Camera style={{width:15,height:15,color:'#666'}} /> Edit Group Icon
                  </button>
                )}
                <button onClick={()=>{navigate('/forums');setShowMenu(false);}}
                  style={{ width:'100%',display:'flex',alignItems:'center',gap:10,
                           padding:'11px 16px',background:'none',border:'none',
                           fontSize:14,cursor:'pointer',color:'#333',textAlign:'left' }}>
                  <ArrowLeft style={{width:15,height:15,color:'#666'}} /> Back to Forums
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Messages — scrollable middle section ── */}
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden',
                      padding:'8px 0', WebkitOverflowScrolling:'touch' }}>
          {isLoading && (
            <div style={{ textAlign:'center',padding:32,color:'#999',fontSize:13 }}>
              Loading messages…
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <div style={{ textAlign:'center',padding:48,color:'#999' }}>
              <div style={{fontSize:44,marginBottom:10}}>💬</div>
              <p style={{margin:0,fontWeight:600,fontSize:14}}>No messages yet</p>
              <p style={{margin:'4px 0 0',fontSize:12}}>Be the first to say something!</p>
            </div>
          )}
          {grouped.map(item =>
            item.type === 'date' ? (
              <div key={item.key} style={{ textAlign:'center',margin:'10px 0' }}>
                <span style={{ background:'rgba(255,255,255,0.85)',padding:'3px 12px',
                               borderRadius:10,fontSize:11,color:'#666',boxShadow:'0 1px 2px rgba(0,0,0,.08)' }}>
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageBubble
                key={item.key}
                msg={item.msg}
                isMine={item.msg.author_id === user?.id}
                showName={item.showName}
              />
            )
          )}
          <div ref={endRef} style={{height:8}} />
        </div>

        {/* ── Reply preview ── */}
        {replyTo && (
          <div style={{ flexShrink:0,background:'#fff',
                        borderTop:`2px solid #25D366`,padding:'6px 12px',
                        display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div style={{overflow:'hidden'}}>
              <span style={{fontSize:11,fontWeight:700,color:'#25D366'}}>{replyTo.author_name}</span>
              <p style={{margin:0,fontSize:12,color:'#555',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',maxWidth:240}}>
                {replyTo.body}
              </p>
            </div>
            <button onClick={()=>setReplyTo(null)}
              style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#aaa',flexShrink:0}}>×</button>
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{
          flexShrink  : 0,
          background  : '#F0F2F5',
          borderTop   : '1px solid rgba(0,0,0,0.08)',
          padding     : '8px 10px',
          display     : 'flex',
          alignItems  : 'flex-end',
          gap         : 8,
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            rows={1}
            style={{
              flex        : 1,
              borderRadius: 22,
              border      : '1px solid #ddd',
              padding     : '9px 14px',
              fontSize    : 14,
              resize      : 'none',
              background  : 'white',
              outline     : 'none',
              lineHeight  : 1.4,
              maxHeight   : 120,
              overflowY   : 'auto',
              fontFamily  : 'inherit',
              boxShadow   : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            style={{
              width      : 44,
              height     : 44,
              borderRadius:'50%',
              background  : text.trim() ? '#25D366' : '#ccc',
              border      : 'none',
              cursor      : text.trim() ? 'pointer' : 'default',
              display     : 'flex',
              alignItems  : 'center',
              justifyContent:'center',
              flexShrink  : 0,
              transition  : 'background 0.15s, transform 0.1s',
              transform   : text.trim() ? 'scale(1)' : 'scale(0.92)',
            }}
          >
            <Send style={{color:'white',width:18,height:18,marginLeft:2}} />
          </button>
        </div>
      </div>
    </>
  );
}
