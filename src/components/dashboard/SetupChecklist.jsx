import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  User, Camera, GraduationCap, BookOpen, CreditCard,
  CheckCircle2, Circle, ChevronDown, ChevronUp, X, ArrowRight, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const DISMISS_KEY = (userId) => `aca_checklist_dismissed_${userId}`;
const SNOOZE_KEY  = (userId) => `aca_checklist_snooze_${userId}`;
const SNOOZE_HOURS = 6; // re-surface after 6 hours

function useLocalDismiss(userId) {
  const isDismissed = () => {
    if (!userId) return false;
    // Fully done — never show again (stored in localStorage as permanent flag)
    if (localStorage.getItem(DISMISS_KEY(userId)) === 'done') return true;
    // Snoozed — check if snooze period expired
    const snooze = localStorage.getItem(SNOOZE_KEY(userId));
    if (snooze) {
      const until = new Date(snooze);
      if (new Date() < until) return true; // still snoozed
      localStorage.removeItem(SNOOZE_KEY(userId)); // expired
    }
    return false;
  };
  const snooze = () => {
    const until = new Date(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000);
    localStorage.setItem(SNOOZE_KEY(userId), until.toISOString());
  };
  const markDone = () => localStorage.setItem(DISMISS_KEY(userId), 'done');
  return { isDismissed, snooze, markDone };
}

export default function SetupChecklist({ user }) {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const userId      = user?.id;
  const { isDismissed, snooze, markDone } = useLocalDismiss(userId);

  const [visible,   setVisible]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Photo upload
  const fileRef       = useRef();
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(user?.avatar_url || '');

  // Form / name edit
  const [editingName,  setEditingName]  = useState(false);
  const [nameVal,      setNameVal]      = useState(user?.full_name || '');
  const [savingName,   setSavingName]   = useState(false);

  /* ── Data queries ── */
  const { data: studentProfile } = useQuery({
    queryKey: ['studentProfile', userId],
    queryFn:  () => base44.entities.StudentProfile.filter({ user_id: userId }, 'created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
    staleTime: 0,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn:  () => base44.entities.Enrollment.filter({ student_id: userId }, '-created_date', 100),
    enabled:  !!userId,
    staleTime: 0,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    queryFn:  () => base44.entities.Subscription.filter({ student_id: userId, status: 'active' }, '-created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
    staleTime: 0,
  });

  /* ── Checklist state ── */
  const hasName    = !!(user?.full_name?.trim() && user.full_name.trim() !== user.email);
  const hasPhoto   = !!(photoPreview || user?.avatar_url);
  const hasClass   = !!(studentProfile?.form);
  const hasEnroll  = enrollments.length > 0;
  const hasFees    = !!(subscription || user?.subscription_status === 'active' || user?.subscription_plan !== 'free');

  const items = [
    { id: 'name',    done: hasName,   label: 'Add your full name',           icon: User,          action: () => setEditingName(true) },
    { id: 'photo',   done: hasPhoto,  label: 'Upload a profile picture',     icon: Camera,        action: () => fileRef.current?.click() },
    { id: 'class',   done: hasClass,  label: 'Select your class',            icon: GraduationCap, action: () => navigate('/settings?tab=profile') },
    { id: 'enroll',  done: hasEnroll, label: 'Choose subjects to enroll in', icon: BookOpen,      action: () => navigate('/enroll-subjects') },
    { id: 'fees',    done: hasFees,   label: 'Pay fees to start learning',   icon: CreditCard,    action: () => navigate('/subscription') },
  ];

  const doneCount  = items.filter(i => i.done).length;
  const allDone    = doneCount === items.length;
  const pct        = Math.round((doneCount / items.length) * 100);

  /* ── Visibility logic ── */
  useEffect(() => {
    if (!userId) return;
    if (allDone) { markDone(); setVisible(false); return; }
    setVisible(!isDismissed());
  }, [userId, allDone, doneCount]);

  // Keep photo preview in sync with user
  useEffect(() => { setPhotoPreview(user?.avatar_url || ''); }, [user?.avatar_url]);
  useEffect(() => { setNameVal(user?.full_name || ''); }, [user?.full_name]);

  /* ── Photo upload ── */
  const handlePhotoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch(
        `/api/apps/${window.__appParams?.appId || ''}/storage/upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${window.__appParams?.token || ''}` }, body: fd }
      );
      if (!resp.ok) throw new Error('Upload failed');
      const json = await resp.json();
      const url  = json.url || json.file_url || '';
      setPhotoPreview(url);
      await base44.auth.updateMe({ avatar_url: url });
      if (studentProfile?.id) {
        await base44.entities.StudentProfile.update(studentProfile.id, { avatar_url: url });
      } else {
        await base44.entities.StudentProfile.create({ user_id: userId, avatar_url: url });
      }
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      qc.invalidateQueries({ queryKey: ['studentProfile', userId] });
      toast.success('Profile picture updated!');
    } catch { toast.error('Upload failed. Try again.'); setPhotoPreview(user?.avatar_url || ''); }
    finally  { setUploading(false); }
  };

  /* ── Save name ── */
  const saveName = async () => {
    if (!nameVal.trim()) return;
    setSavingName(true);
    try {
      await base44.auth.updateMe({ full_name: nameVal.trim() });
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      setEditingName(false);
      toast.success('Name saved!');
    } catch { toast.error('Could not save name.'); }
    finally  { setSavingName(false); }
  };

  if (!visible || !userId) return null;

  return (
    <div className="rounded-2xl border border-border overflow-hidden"
      style={{ background: 'hsl(222 47% 13%)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(43 74% 52% / 0.15)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'hsl(43 74% 52%)' }} />
          </div>
          <div>
            <p className="font-display font-bold text-sm">Set up your account</p>
            <p className="text-[11px] text-muted-foreground">{doneCount} of {items.length} complete</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button onClick={() => { snooze(); setVisible(false); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Remind me later">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'hsl(43 74% 52%)' }} />
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="px-3 pb-4 space-y-1">
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              editingName={editingName}
              nameVal={nameVal}
              setNameVal={setNameVal}
              saveName={saveName}
              savingName={savingName}
              setEditingName={setEditingName}
              uploading={uploading}
              photoPreview={photoPreview}
            />
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={handlePhotoFile} onClick={e => { e.target.value = ''; }} />
    </div>
  );
}

function ChecklistItem({ item, editingName, nameVal, setNameVal, saveName, savingName, setEditingName, uploading, photoPreview }) {
  const Icon = item.icon;
  return (
    <div className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
      item.done ? 'opacity-50' : 'hover:bg-white/5 cursor-pointer'
    }`}
      onClick={item.done ? undefined : item.action}>

      {/* Check / circle */}
      <div className="flex-shrink-0">
        {item.done ? (
          <CheckCircle2 className="w-5 h-5" style={{ color: 'hsl(160 60% 45%)' }} />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>

      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        item.done ? 'bg-white/5' : 'bg-white/8'
      }`}>
        {item.id === 'photo' && photoPreview && !item.done ? (
          <img src={photoPreview} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <Icon className={`w-4 h-4 ${item.done ? 'text-muted-foreground/40' : 'text-foreground/70'}`} />
        )}
      </div>

      {/* Label / inline edit */}
      <div className="flex-1 min-w-0">
        {item.id === 'name' && editingName && !item.done ? (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              className="flex-1 text-sm bg-white/10 rounded-lg px-2.5 py-1 outline-none border border-white/20 focus:border-accent/60 text-foreground"
              placeholder="Your full name"
            />
            <button onClick={saveName} disabled={savingName}
              className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
              style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
              {savingName ? '…' : 'Save'}
            </button>
          </div>
        ) : item.id === 'photo' && uploading ? (
          <p className="text-sm text-muted-foreground">Uploading…</p>
        ) : (
          <p className={`text-sm font-medium ${item.done ? 'line-through text-muted-foreground/50' : ''}`}>
            {item.label}
          </p>
        )}
      </div>

      {/* Arrow */}
      {!item.done && item.id !== 'name' && (
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
      )}
    </div>
  );
}
