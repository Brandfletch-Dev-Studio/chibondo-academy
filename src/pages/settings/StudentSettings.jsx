import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Lock, Bell, CreditCard, Sun, Moon } from 'lucide-react';

export default function StudentSettings() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['studentProfile', user?.id],
    queryFn: async () => {
      const r = await base44.entities.StudentProfile.filter({ user_id: user.id });
      return r[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: subscription } = useQuery({
    queryKey: ['mySubscription', user?.id],
    queryFn: async () => {
      const r = await base44.entities.Subscription.filter({ student_id: user.id }, '-created_date', 1);
      return r[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['myPayments', user?.id],
    queryFn: () => base44.entities.Payment.filter({ student_id: user.id }, '-created_date', 10),
    enabled: !!user?.id,
  });

  // Profile form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Notifications
  const [notifAssignments, setNotifAssignments] = useState(true);
  const [notifLessons, setNotifLessons] = useState(true);
  const [notifQuizzes, setNotifQuizzes] = useState(true);
  const [notifAnnouncements, setNotifAnnouncements] = useState(true);

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone_number || '');
      setSchoolName(profile.school_name || '');
    }
  }, [profile]);

  const handleTheme = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    await base44.auth.updateMe({ full_name: fullName.trim() });
    if (profile) {
      await base44.entities.StudentProfile.update(profile.id, {
        full_name: fullName.trim(),
        phone_number: phone,
        school_name: schoolName,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    queryClient.invalidateQueries({ queryKey: ['studentProfile'] });
    setProfileSaving(false);
    toast.success('Profile updated!');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-muted w-full justify-start flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile" className="gap-1.5"><User className="w-3.5 h-3.5" />Profile</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="w-3.5 h-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="w-3.5 h-3.5" />Billing</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5"><Sun className="w-3.5 h-3.5" />Appearance</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address</Label>
                <Input value={user?.email || ''} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+265 XXX XXX XXX" />
              </div>
              <div className="space-y-1.5">
                <Label>School Name</Label>
                <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Your school" />
              </div>
              <Button onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'New Assignments', desc: 'Get notified when a new assignment is posted', value: notifAssignments, onChange: setNotifAssignments },
                { label: 'New Lessons', desc: 'Get notified when new lesson content is added', value: notifLessons, onChange: setNotifLessons },
                { label: 'Quiz Results', desc: 'Get notified when your quiz is graded', value: notifQuizzes, onChange: setNotifQuizzes },
                { label: 'Course Announcements', desc: 'Receive announcements from your teachers', value: notifAnnouncements, onChange: setNotifAnnouncements },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch checked={n.value} onCheckedChange={n.onChange} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Current Plan</CardTitle></CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge className="capitalize">{subscription.plan}</Badge>
                    <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {subscription.status}
                    </Badge>
                  </div>
                  {subscription.end_date && (
                    <p className="text-sm text-muted-foreground">
                      Expires: {new Date(subscription.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active subscription.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment records found.</p>
              ) : (
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{p.description || 'Payment'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">MWK {p.amount?.toLocaleString()}</p>
                        <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'light', label: 'Light Mode', icon: Sun },
                  { value: 'dark', label: 'Dark Mode', icon: Moon },
                ].map(t => (
                  <button
                    key={t.value}
                    onClick={() => handleTheme(t.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      theme === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <t.icon className={`w-6 h-6 ${theme === t.value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${theme === t.value ? 'text-primary' : 'text-muted-foreground'}`}>{t.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}