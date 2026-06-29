import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Download, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function AssignmentSubmissionView({ assignment, onSubmit }) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [newAttachment, setNewAttachment] = useState({ name: '', url: '' });

  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: existingSubmission } = useQuery({
    queryKey: ['assignmentSubmission', assignment.id, user?.id],
    queryFn: () => base44.entities.AssignmentSubmission.filter({
      assignment_id: assignment.id,
      student_id: user?.id,
    }).then(subs => subs[0]),
    enabled: !!assignment.id && !!user?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async (submissionData) => {
      if (existingSubmission) {
        return base44.entities.AssignmentSubmission.update(existingSubmission.id, submissionData);
      }
      return base44.entities.AssignmentSubmission.create(submissionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignmentSubmission'] });
      toast.success('Assignment submitted successfully!');
      onSubmit?.();
    },
  });

  const handleAddAttachment = () => {
    if (!newAttachment.name || !newAttachment.url) return;
    setAttachments([...attachments, { ...newAttachment }]);
    setNewAttachment({ name: '', url: '' });
  };

  const handleSubmit = () => {
    if (!content.trim() && attachments.length === 0) {
      toast.error('Please add content or attachments');
      return;
    }
    submitMutation.mutate({
      assignment_id: assignment.id,
      student_id: user.id,
      student_name: user.full_name,
      content,
      attachments,
      status: 'submitted',
    });
  };

  if (existingSubmission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            Submission Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant={existingSubmission.status === 'graded' ? 'default' : 'secondary'}>
            {existingSubmission.status === 'graded' ? 'Graded' : 'Submitted'}
          </Badge>
          {existingSubmission.marks !== undefined && (
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-2xl font-bold text-primary">{existingSubmission.marks}/{assignment.total_marks}</p>
              <p className="text-sm text-muted-foreground">Marks Obtained</p>
            </div>
          )}
          {existingSubmission.feedback && (
            <div>
              <p className="text-sm font-medium mb-2">Teacher Feedback</p>
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">{existingSubmission.feedback}</p>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Your Submission</p>
            {existingSubmission.content && (
              <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">{existingSubmission.content}</div>
            )}
            {existingSubmission.attachments?.map((att, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <FileText className="w-4 h-4 text-primary" />
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  {att.name}
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Your Work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="content">Your Answer</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your answer here..."
            className="min-h-[200px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Attachments (Optional)</Label>
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm flex-1">{att.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}>
                Remove
              </Button>
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="File name (e.g., solution.pdf)"
              value={newAttachment.name}
              onChange={(e) => setNewAttachment({ ...newAttachment, name: e.target.value })}
            />
            <Input
              placeholder="File URL"
              value={newAttachment.url}
              onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })}
            />
            <Button variant="outline" onClick={handleAddAttachment}>
              <Upload className="w-4 h-4 mr-2" />
              Add File
            </Button>
          </div>
        </div>

        <Button onClick={handleSubmit} className="w-full" disabled={submitMutation.isPending}>
          {submitMutation.isPending ? 'Submitting...' : 'Submit Assignment'}
        </Button>
      </CardContent>
    </Card>
  );
}