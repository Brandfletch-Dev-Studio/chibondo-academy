import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { User, Bell, Sun, Moon, Briefcase, Wallet } from 'lucide-react';

export default function TeacherSettings() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  // Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Payout
  const [airtelMoney, setAirtelMoney] = useState('');
  const [tnmMpamba, setTnmMpamba] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);

  // Notifications
  const [notifAssignments, setNotifAssignments] = useState(true);
  const [notifStudents, setNotifStudents] = useState(true);
  const [notifAnnouncements, setNotifAnnouncements] = useState(true);

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone_number || '');
      setBio(user.bio || '');
      setQualifications(user.qualifications || '');
      setLinkedinUrl(user.linkedin_url || '');
      setAirtelMoney(user.airtel_money || '');
      setTnmMpamba(user.tnm_mpamba || '');
      setBankName(user.bank_name || '');
      setBankAccount(user.bank_account || '');
    }
  }, [user]);

  const handleTheme = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    await base44.auth.updateMe({
      full_name: fullName.trim(),
      phone_number: phone,
      bio,
      qualifications,
      linkedin_url: linkedinUrl,
    });
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    setProfileSaving(false);
    toast.success('Profile updated!');
  };

  const savePayout = async () => {
    setPayoutSaving(true);
    await base44.auth.updateMe({ airtel_money: airtelMoney, tnm_mpamba: tnmMpamba, bank_name: bankName, bank_account: bankAccount });
    setPayoutSaving(false);
    toast.success('Payout details saved!');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Teacher Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and teaching profile</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-muted w-full justify-start flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile" className="gap-1.5"><User className="w-3.5 h-3.5" />Profile</TabsTrigger>
          <TabsTrigger value="teaching" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" />Teaching</TabsTrigger>
          <TabsTrigger value="payout" className="gap-1.5"><Wallet className="w-3.5 h-3.5" />Payout</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="w-3.5 h-3.5" />Notifications</TabsTrigger>
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
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+265 XXX XXX XXX" />
              </div>
              <Button onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teaching Profile */}
        <TabsContent value="teaching" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Teaching Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Biography</Label>
                <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell students about yourself..." rows={4} />
              </div>
              <div className="space-y-1.5">
                <Label>Qualifications</Label>
                <Textarea value={qualifications} onChange={e => setQualifications(e.target.value)} placeholder="Your academic and professional qualifications..." rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>LinkedIn Profile URL</Label>
                <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourprofile" />
              </div>
              <Button onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save Teaching Profile'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout */}
        <TabsContent value="payout" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payout Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">These details will be used for future payout processing.</p>
              <div className="space-y-1.5">
                <Label>Airtel Money Number</Label>
                <Input value={airtelMoney} onChange={e => setAirtelMoney(e.target.value)} placeholder="+265 99X XXX XXX" />
              </div>
              <div className="space-y-1.5">
                <Label>TNM Mpamba Number</Label>
                <Input value={tnmMpamba} onChange={e => setTnmMpamba(e.target.value)} placeholder="+265 88X XXX XXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. National Bank of Malawi" />
              </div>
              <div className="space-y-1.5">
                <Label>Bank Account Number</Label>
                <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Account number" />
              </div>
              <Button onClick={savePayout} disabled={payoutSaving}>
                {payoutSaving ? 'Saving...' : 'Save Payout Details'}
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
                { label: 'New Assignment Submissions', desc: 'Notified when a student submits an assignment', value: notifAssignments, onChange: setNotifAssignments },
                { label: 'New Student Enrollments', desc: 'Notified when a student joins your course', value: notifStudents, onChange: setNotifStudents },
                { label: 'Announcements', desc: 'Receive platform-wide announcements', value: notifAnnouncements, onChange: setNotifAnnouncements },
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