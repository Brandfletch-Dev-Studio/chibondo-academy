import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Send, Users, User, Megaphone, BookOpen, CreditCard, Trash2, CheckCheck, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TYPE_OPTIONS = [
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
  { value: 'system',       label: 'System',        icon: Bell },
  { value: 'lesson',       label: 'Lesson',        icon: BookOpen },
  { value: 'subscription', label: 'Subscription',  icon: CreditCard },
];

const AUDIENCE_OPTIONS = [
  { value: 'all',      label: 'All Students' },
  { value: 'specific', label: 'Specific Student' },
];

export default function AdminNotifications() {
  const queryClient = useQueryClient();

  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [type, setType]         = useState('announcement');
  const [audience, setAudience] = useState('all');
  const [targetId, setTargetId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  const { data: students = [] } = useQuery({
    queryKey: ['allStudentProfiles'],
    queryFn: () => base44.entities.StudentProfile.filter({}, 'full_name', 200),
  });

  const { data: allNotifications = [], isLoading } = useQuery({
    queryKey: ['admin-all-notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 200),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !message.trim()) throw new Error('Title and message are required');

      if (audience === 'all') {
        // Send to every student
        const profiles = await base44.entities.StudentProfile.filter({});
        const userIds = profiles.map(p => p.user_id).filter(Boolean);
        await Promise.all(
          userIds.map(uid =>
            base44.entities.Notification.create({ user_id: uid, title: title.trim(), message: message.trim(), type, is_read: false })
          )
        );
        return userIds.length;
      } else {
        if (!targetId) throw new Error('Please select a student');
        const profile = students.find(s => s.id === targetId);
        if (!profile?.user_id) throw new Error('Student not found');
        await base44.entities.Notification.create({ user_id: profile.user_id, title: title.trim(), message: message.trim(), type, is_read: false });
        return 1;
      }
    },
    onSuccess: (count) => {
      toast.success(`Notification sent to ${count} student${count !== 1 ? 's' : ''}!`);
      setTitle(''); setMessage(''); setType('announcement'); setAudience('all'); setTargetId('');
      queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] }),
  });

  const filteredStudents = students.filter(s =>
    !studentSearch || (s.full_name || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredHistory = allNotifications.filter(n =>
    !historySearch ||
    n.title.toLowerCase().includes(historySearch.toLowerCase()) ||
    (n.message || '').toLowerCase().includes(historySearch.toLowerCase())
  );

  const stats = {
    total: allNotifications.length,
    unread: allNotifications.filter(n => !n.is_read).length,
    announcements: allNotifications.filter(n => n.type === 'announcement').length,
    today: allNotifications.filter(n => {
      const d = new Date(n.created_date);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" /> Notifications Control Centre
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Send and manage in-app notifications to students</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sent',     value: stats.total,         icon: Bell,      color: 'text-primary' },
          { label: 'Unread',         value: stats.unread,        icon: Bell,      color: 'text-destructive' },
          { label: 'Announcements',  value: stats.announcements, icon: Megaphone, color: 'text-accent-foreground' },
          { label: 'Sent Today',     value: stats.today,         icon: Send,      color: 'text-success' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
            <p className="text-xl font-bold font-display">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Compose Panel */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Compose Notification</h2>
            </div>
            <div className="p-5 space-y-4">

              {/* Audience */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Send To</label>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAudience(opt.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all
                        ${audience === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                    >
                      {opt.value === 'all' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student selector */}
              {audience === 'specific' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Student</label>
                  <div className="relative mb-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Search student..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-8 h-9 text-sm" />
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                    {filteredStudents.slice(0, 20).map(s => (
                      <button
                        key={s.id}
                        onClick={() => setTargetId(s.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors
                          ${targetId === s.id ? 'bg-primary/5 text-primary font-medium' : ''}`}
                      >
                        {s.full_name || 'Unknown'} <span className="text-xs text-muted-foreground">· {s.form}</span>
                      </button>
                    ))}
                    {filteredStudents.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No students found</p>
                    )}
                  </div>
                </div>
              )}

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
                <Input placeholder="Notification title..." value={title} onChange={e => setTitle(e.target.value)} className="h-10" />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
                <Textarea
                  placeholder="Write your message here..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="resize-none h-28"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || !title.trim() || !message.trim()}
              >
                {sendMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> {audience === 'all' ? `Send to All Students` : 'Send to Student'}</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* History Panel */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <CheckCheck className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Notification History</h2>
              <span className="text-xs text-muted-foreground ml-auto">{allNotifications.length} total</span>
            </div>
            <div className="px-4 pt-3 pb-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search notifications..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
            </div>
            <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-16">
                  <Bell className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                filteredHistory.map(n => {
                  const typeConf = TYPE_OPTIONS.find(t => t.value === n.type);
                  const Icon = typeConf?.icon || Bell;
                  return (
                    <div key={n.id} className="flex items-start gap-3 px-5 py-3.5 group hover:bg-muted/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{n.title}</p>
                          <Badge variant="outline" className="text-[10px] capitalize">{n.type}</Badge>
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(n.created_date), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}