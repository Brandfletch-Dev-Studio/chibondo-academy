import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Upload, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function MyAssignments() {
  const { user } = useOutletContext() || {};

  // FIX 7: fetch the student's enrollments first so we can filter assignments
  // by the subjects they are actually enrolled in
  const { data: enrollments = [] } = useQuery({
    queryKey: ['myEnrollments', user?.id],
    queryFn: () => base44.entities.Enrollment.filter({ student_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const enrolledSubjectIds = useMemo(
    () => new Set(enrollments.map(e => e.subject_id)),
    [enrollments]
  );

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => base44.entities.Assignment.filter({ status: 'published' }, '-due_date', 100),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['mySubmissions', user?.id],
    queryFn: () => base44.entities.AssignmentSubmission.filter({ student_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const submissionMap = useMemo(() => {
    const m = {};
    submissions.forEach(s => { m[s.assignment_id] = s; });
    return m;
  }, [submissions]);

  // FIX 7: only show assignments whose subject the student is enrolled in
  // Fall back to showing all if no enrollments yet (new student) or if assignment has no subject_id
  const filteredAssignments = useMemo(() => {
    if (enrolledSubjectIds.size === 0) return assignments;
    return assignments.filter(a => !a.subject_id || enrolledSubjectIds.has(a.subject_id));
  }, [assignments, enrolledSubjectIds]);

  // Split into pending vs done for better UX
  const pending = filteredAssignments.filter(a => {
    const sub = submissionMap[a.id];
    return !sub || sub.status === 'submitted';
  });
  const completed = filteredAssignments.filter(a => {
    const sub = submissionMap[a.id];
    return sub?.status === 'graded';
  });

  const AssignmentCard = ({ a }) => {
    const submission = submissionMap[a.id];
    const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !submission;
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
            submission?.status === 'graded' ? 'bg-success/10' : isOverdue ? 'bg-destructive/10' : 'bg-primary/10'
          }`}>
            {submission?.status === 'graded' ? <CheckCircle2 className="w-5 h-5 text-success" /> :
             isOverdue ? <Clock className="w-5 h-5 text-destructive" /> :
             <FileText className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-sm">{a.title}</h3>
            {a.subject_name && (
              <p className="text-[11px] text-accent font-medium mt-0.5">{a.subject_name}</p>
            )}
            {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              {a.due_date && (
                <span className={`text-xs ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  Due: {format(new Date(a.due_date), 'MMM d, yyyy')}
                </span>
              )}
              <span className="text-xs text-muted-foreground">Total: {a.total_marks} marks</span>
            </div>
          </div>
          <div>
            {submission ? (
              <div className="text-right">
                <Badge className={`text-[10px] ${
                  submission.status === 'graded' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'
                }`}>
                  {submission.status}
                </Badge>
                {submission.marks != null && (
                  <p className="text-sm font-bold text-primary mt-1">{submission.marks}/{a.total_marks}</p>
                )}
              </div>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                <Upload className="w-2.5 h-2.5 mr-1" /> Pending
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl border animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">My Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''} across your enrolled subjects
        </p>
      </div>

      {filteredAssignments.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground font-medium">No assignments yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Assignments from your enrolled subjects will appear here</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pending · {pending.length}
              </h2>
              {pending.map(a => <AssignmentCard key={a.id} a={a} />)}
            </div>
          )}
          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Graded · {completed.length}
              </h2>
              {completed.map(a => <AssignmentCard key={a.id} a={a} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
