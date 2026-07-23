import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, Phone, School, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherApplications() {
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: applications = [] } = useQuery({queryKey: ['teacherApplications'],
    queryFn: async () => { try { return await db.entities.TeacherApplication.filter({}, '-created_date'); } catch(e) { console.error(e); return []; } },
    placeholderData: [],});

  const updateApplication = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const app = applications.find(a => a.id === id);
      await db.entities.TeacherApplication.update(id, {
        status,
        admin_notes: notes,
      });
      // If approved, update user role
      if (status === 'approved' && app?.user_id) {
        await db.entities.User.update(app.user_id, { role: 'teacher' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherApplications'] });
      setSelectedApp(null);
      setAdminNotes('');
      toast.success('Application updated');
    },
  });

  const handleApprove = () => {
    if (!selectedApp) return;
    updateApplication.mutate({
      id: selectedApp.id,
      status: 'approved',
      notes: adminNotes,
    });
  };

  const handleReject = () => {
    if (!selectedApp) return;
    updateApplication.mutate({
      id: selectedApp.id,
      status: 'rejected',
      notes: adminNotes,
    });
  };

  const pendingApps = applications.filter(a => a.status === 'pending');
  const processedApps = applications.filter(a => a.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Applications</h1>
        <p className="text-muted-foreground mt-1">Review and approve teacher registration requests</p>
      </div>

      {/* Pending Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Applications ({pendingApps.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingApps.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingApps.map((app) => (
                <Card key={app.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <p className="font-semibold">{app.full_name}</p>
                      <p className="text-sm text-muted-foreground">{app.email}</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span>{app.phone_number || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <School className="w-3 h-3 text-muted-foreground" />
                        <span>{app.school_or_institution || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3 h-3 text-muted-foreground" />
                        <span>{app.subjects?.join(', ') || 'N/A'}</span>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full" size="sm" onClick={() => setSelectedApp(app)}>
                          Review Application
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Review Teacher Application</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="text-sm font-medium">Full Name</p>
                              <p className="text-sm text-muted-foreground">{app.full_name}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Email</p>
                              <p className="text-sm text-muted-foreground">{app.email}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Phone</p>
                              <p className="text-sm text-muted-foreground">{app.phone_number}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Institution</p>
                              <p className="text-sm text-muted-foreground">{app.school_or_institution}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Subjects</p>
                            <div className="flex gap-1 flex-wrap mt-1">
                              {app.subjects?.map((s, i) => (
                                <Badge key={i}>{s}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Qualifications</p>
                            <p className="text-sm text-muted-foreground mt-1">{app.qualifications}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Admin Notes</label>
                            <Textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Add internal notes..."
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-4">
                          <Button variant="outline" onClick={() => setSelectedApp(null)}>
                            Cancel
                          </Button>
                          <Button variant="destructive" onClick={handleReject}>
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                          <Button onClick={handleApprove}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No pending applications
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Applications */}
      {processedApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processed Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {processedApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      {app.status === 'approved' ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{app.full_name}</p>
                      <p className="text-xs text-muted-foreground">{app.email}</p>
                    </div>
                  </div>
                  <Badge variant={app.status === 'approved' ? 'default' : 'destructive'}>
                    {app.status === 'approved' ? 'Approved' : 'Rejected'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}