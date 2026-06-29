import React, { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseClient';
import SEO from '@/components/SEO';
import { BookOpen, Check, Loader2, ArrowRight, GraduationCap, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function EnrollSubjectsPage() {
  const { user }   = useOutletContext() ?? {};
  const userId     = user?.id;
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);

  /* ── Student profile — to detect their form ── */
  const { data: studentProfile } = useQuery({
    queryKey: ['studentProfile', userId],
    queryFn:  () => base44.entities.StudentProfile.filter({ user_id: userId }, 'created_date', 1).then(r => r[0] || null),
    enabled:  !!userId,
  });

  /* ── Forms ── */
  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn:  () => base44.entities.AcademicForm.filter({ status: 'active' }, 'order', 20),
  });

  /* ── All published subjects ── */
  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects-for-enroll'],
    queryFn:  () => base44.entities.Subject.filter({ status: 'published' }, 'name', 200),
    staleTime: 30_000,
  });

  /* ── Published lesson counts per subject ── */
  const { data: publishedLessons = [] } = useQuery({
    queryKey: ['lessons-published-count'],
    queryFn:  () => base44.entities.Lesson.filter({ status: 'published' }, 'subject_id', 500),
    staleTime: 60_000,
  });

  const lessonCountBySubject = useMemo(() => {
    const map = {};
    publishedLessons.forEach(l => {
      map[l.subject_id] = (map[l.subject_id] || 0) + 1;
    });
    return map;
  }, [publishedLessons]);

  /* ── Existing enrollments ── */
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn:  () => base44.entities.Enrollment.filter({ student_id: userId }, '-created_date', 200),
    enabled:  !!userId,
    staleTime: 0,
  });

  const enrolledIds = useMemo(() => new Set(enrollments.map(e => e.subject_id)), [enrollments]);

  /* ── Determine which forms to show based on student's class ── */
  const studentForm = studentProfile?.form || ''; // e.g. "Form 3" or "Form 4"

  // Map form names to IDs
  const formsByName = useMemo(() => {
    const m = {};
    forms.forEach(f => { m[f.name] = f; });
    return m;
  }, [forms]);

  // Decide which form IDs are relevant
  const relevantFormIds = useMemo(() => {
    if (!studentForm || forms.length === 0) return forms.map(f => f.id); // show all if form unknown
    const f4 = formsByName['Form 4'] || formsByName['form 4'];
    const f3 = formsByName['Form 3'] || formsByName['form 3'];
    if (studentForm === 'Form 4' && f4 && f3) return [f3.id, f4.id]; // Form 4 gets both
    const match = forms.find(f => f.name === studentForm);
    return match ? [match.id] : forms.map(f => f.id);
  }, [studentForm, forms, formsByName]);

  /* ── Filter subjects ── */
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const formOk   = relevantFormIds.includes(s.form_id);
      const searchOk = !search.trim() || s.name.toLowerCase().includes(search.toLowerCase());
      return formOk && searchOk;
    });
  }, [subjects, relevantFormIds, search]);

  /* ── Selection state — start with currently enrolled ── */
  const [selected, setSelected] = useState(null); // null = not initialised yet

  // Initialise selection once enrollments loaded
  React.useEffect(() => {
    if (selected === null && enrolledIds.size >= 0) {
      setSelected(new Set(enrolledIds));
    }
  }, [enrolledIds.size]);

  const toggleSubject = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll  = () => setSelected(new Set(filteredSubjects.map(s => s.id)));
  const clearAll   = () => setSelected(new Set([...selected].filter(id => !filteredSubjects.find(s => s.id === id))));

  const newlySelected  = selected ? [...selected].filter(id => !enrolledIds.has(id)) : [];
  const toUnenroll     = [...enrolledIds].filter(id => selected && !selected.has(id));

  /* ── Save enrollments ── */
  const handleSave = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      // Create new enrollments
      for (const subjectId of newlySelected) {
        const subj = subjects.find(s => s.id === subjectId);
        if (!subj) continue;
        await base44.entities.Enrollment.create({
          student_id:  userId,
          subject_id:  subjectId,
          subject_name: subj.name,
          form_id:     subj.form_id,
          form_name:   subj.form_name || '',
          progress_percentage: 0,
          status: 'active',
        });
        // Bump enrollment_count on subject
        try {
          await base44.entities.Subject.update(subjectId, {
            enrollment_count: (subj.enrollment_count || 0) + 1,
          });
        } catch(_) {}
      }
      qc.invalidateQueries({ queryKey: ['enrollments', userId] });
      toast.success(`Enrolled in ${newlySelected.length} subject${newlySelected.length !== 1 ? 's' : ''}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Group by form for display
  const subjectsByForm = useMemo(() => {
    const map = {};
    filteredSubjects.forEach(s => {
      const key = s.form_id || 'other';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [filteredSubjects]);

  const displayForms = forms.filter(f => relevantFormIds.includes(f.id) && subjectsByForm[f.id]?.length > 0);

  const selectedCount = selected ? [...selected].filter(id => filteredSubjects.find(s => s.id === id)).length : 0;

  return (
    <>
      <SEO title="Choose Subjects | Chibondo Academy" />
      <div className="space-y-5 pb-32">

        {/* Header */}
        <div className="rounded-2xl p-6" style={{ background: 'hsl(222 47% 14%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5" style={{ color: 'hsl(43 74% 66%)' }} />
            <span className="text-sm" style={{ color: 'hsl(43 74% 66% / 0.8)' }}>
              {studentForm ? `Your subjects — ${studentForm}` : 'Choose your subjects'}
            </span>
          </div>
          <h1 className="text-xl font-display font-bold mb-1 text-white">Enrol in Subjects</h1>
          <p className="text-sm text-white/70 mb-4">
            Tick all subjects you want to study. You'll be enrolled automatically.
            {studentForm === 'Form 4' && (
              <span className="block mt-1 text-xs" style={{ color: 'hsl(43 74% 52%)' }}>
                As a Form 4 student, you can enrol in both Form 3 and Form 4 subjects.
              </span>
            )}
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search subjects…"
              className="pl-9 bg-white/95 text-gray-900 placeholder:text-gray-400 border-0" />
          </div>
        </div>

        {/* Select / clear all */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedCount}</span> selected
          </p>
          <div className="flex gap-3">
            <button onClick={selectAll} className="text-xs font-medium text-primary hover:underline">
              Select all
            </button>
            <button onClick={clearAll} className="text-xs font-medium text-muted-foreground hover:underline">
              Clear
            </button>
          </div>
        </div>

        {/* Subject groups */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-card rounded-xl border border-border animate-pulse" />)}
          </div>
        ) : displayForms.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">No subjects found</p>
          </div>
        ) : (
          displayForms.map(form => (
            <div key={form.id}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                {form.name}
              </p>
              <div className="space-y-2">
                {(subjectsByForm[form.id] || []).map(subject => {
                  const isSelected = selected?.has(subject.id);
                  const isEnrolled = enrolledIds.has(subject.id);
                  return (
                    <button key={subject.id} onClick={() => toggleSubject(subject.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-150 text-left ${
                        isSelected
                          ? 'border-accent/60 bg-accent/8'
                          : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'
                      }`}>
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-primary/10">
                        {subject.cover_image
                          ? <img src={subject.cover_image} alt="" loading="lazy" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-5 h-5 text-primary/30" />
                            </div>
                        }
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{subject.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lessonCountBySubject[subject.id] || 0} lessons
                          {subject.teacher_name ? ` · ${subject.teacher_name}` : ''}
                        </p>
                        {isEnrolled && !isSelected && (
                          <p className="text-[10px] text-amber-500 mt-0.5">Will unenroll</p>
                        )}
                        {isEnrolled && isSelected && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Already enrolled</p>
                        )}
                      </div>
                      {/* Checkbox */}
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                        isSelected
                          ? 'border-accent bg-accent'
                          : 'border-muted-foreground/30 bg-transparent'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sticky save bar */}
      {selected && newlySelected.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 py-3 bg-background/95 backdrop-blur border-t border-border shadow-2xl lg:bottom-0">
          <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{newlySelected.length}</span> new {newlySelected.length === 1 ? 'subject' : 'subjects'} to enroll
            </p>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: 'hsl(43 74% 52%)', color: 'hsl(222 47% 11%)' }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {saving ? 'Enrolling…' : 'Enrol Now'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
