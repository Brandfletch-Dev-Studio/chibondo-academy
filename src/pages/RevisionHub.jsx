import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Library, FileText, Download, Lock, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SEO from '@/components/SEO';

const typeLabels = {
  past_paper:     'Past Paper',
  model_answer:   'Model Answer',
  revision_notes: 'Revision Notes',
  exam_tips:      'Exam Tips',
  mock_exam:      'Mock Exam',
};

const typeColors = {
  past_paper:     'bg-primary/10 text-primary',
  model_answer:   'bg-success/10 text-success',
  revision_notes: 'bg-accent/10 text-accent',
  exam_tips:      'bg-destructive/10 text-destructive',
  mock_exam:      'bg-muted text-muted-foreground',
};

export default function RevisionHub() {
  const { user } = useOutletContext();
  const [typeFilter, setTypeFilter] = useState('all');
  const [formFilter, setFormFilter] = useState('all');

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const results = await base44.entities.Subscription.filter({ student_id: user.id, status: 'active' });
      const sub = results[0];
      if (!sub) return null;
      if (sub.end_date && new Date(sub.end_date) < new Date()) return null;
      return sub;
    },
    enabled: !!user?.id,
  });
  const hasPaidFees = !!subscription;

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['revisionResources'],
    queryFn: () => base44.entities.RevisionResource.filter({ status: 'published' }, '-created_date', 200),
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: () => base44.entities.AcademicForm.filter({ status: 'active' }, 'order', 50),
  });

  const filtered = resources.filter(r => {
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    const matchForm = formFilter === 'all' || r.form_id === formFilter;
    return matchType && matchForm;
  });

  return (
    <>
      <SEO
        title="MSCE Revision Hub"
        description="MSCE revision resources - past papers, model answers, revision notes, and exam tips for Form 3 and Form 4 students in Malawi."
        canonical={`${window.location.origin}/revision`}
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">MSCE Revision Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Past papers, model answers, and exam preparation resources</p>
        </div>

        {/* Subscription gate */}
        {!hasPaidFees ? (
          <div
            className="rounded-2xl border-2 border-accent/40 p-6 sm:p-8 text-center"
            style={{ background: 'linear-gradient(135deg, hsl(222 47% 14%), hsl(43 74% 52% / 0.08))' }}
          >
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                  <Lock className="w-3 h-3" style={{ color: 'hsl(222 47% 11%)' }} />
                </div>
              </div>
            </div>
            <h3 className="text-lg font-display font-bold mb-2">Pay Fees to Access Revision Resources</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              Past papers, model answers, revision notes, and mock exams are available to students who have paid their school fees.
            </p>
            <Link to="/subscription">
              <Button className="px-8 font-semibold" size="lg">Pay Fees Now</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={formFilter} onValueChange={setFormFilter}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Form" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Forms</SelectItem>
                  {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Resource grid */}
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-40 bg-card rounded-xl border animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Library className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground">No resources found</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(resource => (
                  <div
                    key={resource.id}
                    className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`text-[10px] ${typeColors[resource.type] || 'bg-muted text-muted-foreground'}`}>
                        {typeLabels[resource.type] || resource.type}
                      </Badge>
                      {resource.year && (
                        <span className="text-xs text-muted-foreground">{resource.year}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm">{resource.title}</h3>
                    {resource.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs text-muted-foreground">
                        {resource.subject_name} · {resource.form_name}
                      </div>
                      {resource.file_url && (
                        <a
                          href={resource.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs font-medium flex items-center gap-1 hover:underline"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
