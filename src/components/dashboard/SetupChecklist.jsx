import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import {
  GraduationCap, BookOpen, CreditCard,
  CheckCircle2, Circle, ChevronDown, ChevronUp, X, ArrowRight, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const DISMISS_KEY  = (uid) => `aca_checklist_dismissed_${uid}`;
const SNOOZE_KEY   = (uid) => `aca_checklist_snooze_${uid}`;
const SNOOZE_HOURS = 6;

function useLocalDismiss(userId) {
  const isDismissed = () => {
    if (!userId) return false;
    if (localStorage.getItem(DISMISS_KEY(userId)) === 'done') return true;
    const snooze = localStorage.getItem(SNOOZE_KEY(userId));
    if (snooze) {
      const until = new Date(snooze);
      if (new Date() < until) return true;
      localStorage.removeItem(SNOOZE_KEY(userId));
    }
    return false;
  };
  const snooze   = () => {
    const until = new Date(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000);
    localStorage.setItem(SNOOZE_KEY(userId), until.toISOString());
  };
  const markDone = () => localStorage.setItem(DISMISS_KEY(userId), 'done');
  return { isDismissed, snooze, markDone };
}

export default function SetupChecklist({ user }) {
  const navigate               = useNavigate();
  const qc                     = useQueryClient();
  const userId                 = user?.id;
  const { isDismissed, snooze, markDone } = useLocalDismiss(userId);

  const [visible,   setVisible]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ── Remote data ────────────────────────────────────────────────────────────
  const { data: studentProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['studentProfile', userId],
    queryFn:  () => db.entities.StudentProfile.filter({ user_id: userId }, 'created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
    staleTime: 0,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn:  () => db.entities.Enrollment.filter({ student_id: userId }, '-created_date', 100),
    enabled:  !!userId,
    staleTime: 0,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    queryFn:  () => db.entities.Subscription.filter({ student_id: userId, status: 'active' }, '-created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
    staleTime: 0,
  });

  // ── Derived checklist state ────────────────────────────────────────────────
  // hasPhoto checks the live photoPreview (optimistic) OR user?.avatar_url (from context)
  const hasClass  = !!(studentProfile?.form);
  const hasEnroll = enrollments.length > 0;
  const hasFees   = !!(subscription);

  const items = [
    { id: 'class',   done: hasClass,   label: 'Select your class',            icon: GraduationCap, action: () => navigate('/settings?tab=academic') },
    { id: 'enroll',  done: hasEnroll,  label: 'Choose subjects to enroll in', icon: BookOpen,      action: () => navigate('/enroll-subjects') },
    { id: 'fees',    done: hasFees,    label: 'Pay fees to start learning',   icon: CreditCard,    action: () => navigate('/subscription') },
  ];

  const doneCount = items.filter(i => i.done).length;
  const allDone   = doneCount === items.length;
  const pct       = Math.round((doneCount / items.length) * 100);

  useEffect(() => {
    if (!userId) return;
    if (allDone) { markDone(); setVisible(false); return; }
    setVisible(!isDismissed());
  }, [userId, allDone, doneCount]);

  // Keep local previews in sync when context user changes (e.g. after settings page saves)
  useEffect(() => { setPhotoPreview(user?.avatar_url || ''); }, [user?.avatar_url]);
  useEffect(() => { setNameVal(user?.full_name || ''); },      [user?.full_name]);

  // ── Photo upload ───────────────────────────────────────────────────────────
  const handlePhotoFile = async (e) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected if needed
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Image must be under 5 MB'); return; }

    // Optimistic preview
    const localUrl = URL.createObjectURL(file);
    setPhotoPreview(localUrl);
    setUploading(true);

    try {
      // 1. Upload to Supabase storage
      const url = await uploadImage(file);

      // 2. Update User record (avatar_url used by navbar, forums, everywhere)
      await db.auth.updateMe({ avatar_url: url });

      // 3. Sync StudentProfile (used by teacher views, leaderboard, etc.)
      if (studentProfile?.id) {
        await db.entities.StudentProfile.update(studentProfile.id, { avatar_url: url });
      } else {
        await db.entities.StudentProfile.create({ user_id: userId, avatar_url: url });
      }

      // 4. Confirm preview with real CDN URL
      setPhotoPreview(url);

      // 5. Refresh global user context so navbar + forums + everywhere updates instantly
      await checkUserAuth();

      // 6. Invalidate all related queries so any other component re-fetches
      qc.invalidateQueries({ queryKey: ['studentProfile', userId] });
      qc.invalidateQueries({ queryKey: ['studentProfile'] });
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      qc.invalidateQueries({ queryKey: ['user', userId] });

      toast.success('Profile picture updated!');
    } catch (err) {
      console.error('Photo upload failed:', err);
      toast.error('Upload failed. Please try again.');
      // Revert optimistic preview
      setPhotoPreview(user?.avatar_url || '');
    } finally {
      setUploading(false);
    }
  };

  if (!visible || !userId) return null;

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground overflow-hidden">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoFile}
          />

          {items.map(item => (
            <ChecklistItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ item }) {
  const Icon = item.icon;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
        item.done
          ? 'opacity-50 cursor-default'
          : 'hover:bg-muted cursor-pointer active:bg-muted/70'
      }`}
      onClick={item.done ? undefined : item.action}
    >
      {/* Tick / circle */}
      <div className="flex-shrink-0 w-5">
        {item.done
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle       className="w-5 h-5 text-muted-foreground/40" />}
      </div>

      {/* Icon badge */}
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Label */}
      <p className={`flex-1 text-sm font-medium truncate ${
        item.done ? 'line-through text-muted-foreground' : 'text-foreground'
      }`}>
        {item.label}
      </p>

      {/* Arrow */}
      {!item.done && <ArrowRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
    </div>
  );
}
