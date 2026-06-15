import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search, UserPlus, Mail, Shield, MoreVertical, Trash2,
  UserX, UserCheck, Users, GraduationCap, BookOpen,
  CalendarDays, TrendingUp, ChevronDown, X, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin:   { label: 'Admin',   color: 'bg-destructive/10 text-destructive border-destructive/20' },
  teacher: { label: 'Tutor',   color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  student: { label: 'Student', color: 'bg-primary/10 text-primary border-primary/20' },
};

function roleColor(role) {
  return ROLE_CONFIG[role]?.color || ROLE_CONFIG.student.color;
}

function Avatar({ name, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center font-bold text-primary flex-shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold leading-none">{value}</p>
        <p className="text-xs font-medium text-foreground/80 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── USER DETAIL DRAWER ───────────────────────────────────────────────────────
function UserDetailDialog({ user, enrollments, subscriptions, open, onClose, onUpdate, onDelete }) {
  if (!user) return null;
  // Enrollment + sub data is pre-enriched on user object from getAdminUsers
  const userEnrollments = enrollments.filter(e => e.student_id === user.id);
  const userSub = user._has_active_sub ? { plan: user._sub_plan, status: 'active' } : subscriptions.find(s => s.student_id === user.id && s.status === 'active');
  const avgProgress = userEnrollments.length > 0
    ? Math.round(userEnrollments.reduce((s, e) => s + (e.progress_percentage || 0), 0) / userEnrollments.length)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Profile header */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            <Avatar name={user.full_name} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{user.full_name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={`text-[10px] ${roleColor(user.role)}`}>
                  <Shield className="w-2.5 h-2.5 mr-1" />{ROLE_CONFIG[user.role]?.label || 'Student'}
                </Badge>
                {user.status === 'suspended' && (
                  <Badge className="text-[10px] bg-muted text-muted-foreground">Suspended</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xl font-bold">{userEnrollments.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Enrolled</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xl font-bold">{avgProgress}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Progress</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xl font-bold">{userSub ? '✓' : '✗'}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Subscribed</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Joined</span>
              <span className="font-medium">{new Date(user.created_date).toLocaleDateString('en-MW', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Subscription</span>
              <span className="font-medium capitalize">{userSub ? `${userSub.plan} (active)` : 'None'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Role</span>
              <Select value={user.role || 'student'} onValueChange={(role) => { onUpdate(user.id, { role }); }}>
                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enrolled courses */}
          {userEnrollments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Enrolled Courses</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {userEnrollments.map(e => (
                  <div key={e.id} className="flex items-center justify-between text-sm bg-muted/20 px-3 py-2 rounded-lg">
                    <span className="truncate">{e.subject_name || 'Unknown Course'}</span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{e.progress_percentage || 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {user.status === 'suspended' ? (
              <Button variant="outline" size="sm" className="flex-1 text-success border-success/30 hover:bg-success/10"
                onClick={() => { onUpdate(user.id, { status: 'active' }); onClose(); }}>
                <UserCheck className="w-4 h-4 mr-1.5" /> Reactivate
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="flex-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => { onUpdate(user.id, { status: 'suspended' }); onClose(); }}>
                <UserX className="w-4 h-4 mr-1.5" /> Suspend
              </Button>
            )}
            <Button variant="destructive" size="sm" className="flex-1"
              onClick={() => { onDelete(user.id); onClose(); }}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: adminData, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => base44.functions.invoke('getAdminUsers', {}),
    staleTime: 30_000,
  });
  const users        = adminData?.users        || [];
  const enrollments  = adminData?.enrollments  ? [] : []; // pre-aggregated in function
  const subscriptions = []; // pre-aggregated in function

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('User updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('User deleted');
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail.trim(), inviteRole === 'admin' ? 'admin' : 'user');
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteOpen(false);
    setInviteEmail('');
    setInviting(false);
  };

  const filteredUsers = users.filter(u => {
    const matchRole = roleFilter === 'all'
      || (roleFilter === 'suspended' && u.status === 'suspended')
      || (roleFilter !== 'suspended' && u.role === roleFilter);
    const matchSearch = !search
      || u.full_name?.toLowerCase().includes(search.toLowerCase())
      || u.email?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const counts = {
    all:       adminData?.total    ?? users.length,
    student:   adminData?.students ?? users.filter(u => u.role === 'user' || u.role === 'student' || !u.role).length,
    teacher:   adminData?.teachers ?? users.filter(u => u.role === 'teacher').length,
    admin:     adminData?.admins   ?? users.filter(u => u.role === 'admin').length,
    suspended: users.filter(u => u.status === 'suspended').length,
  };

  const activeSubCount = adminData?.subscribed ?? 0;
  const newThisMonth = users.filter(u => {
    const d = new Date(u.created_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const FILTERS = [
    { key: 'all',      label: 'All',      count: counts.all },
    { key: 'student',  label: 'Students', count: counts.student },
    { key: 'teacher',  label: 'Tutors',   count: counts.teacher },
    { key: 'admin',    label: 'Admins',   count: counts.admin },
    { key: 'suspended',label: 'Suspended',count: counts.suspended },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} registered users</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={users.length} sub={`+${newThisMonth} this month`} color="bg-primary/10 text-primary" />
        <StatCard icon={BookOpen} label="Students" value={counts.student} sub={`${activeSubCount} subscribed`} color="bg-sky-500/10 text-sky-600" />
        <StatCard icon={GraduationCap} label="Tutors" value={counts.teacher} sub="Active educators" color="bg-amber-500/10 text-amber-600" />
        <StatCard icon={TrendingUp} label="Enrollments" value={adminData?.enrollments ?? 0} sub="Total course enrollments" color="bg-emerald-500/10 text-emerald-600" />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setRoleFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                roleFilter === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-[10px] ${roleFilter === f.key ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* User Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[auto_1fr_120px_100px_80px] gap-4 px-5 py-3 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="w-9" />
          <span>User</span>
          <span>Role</span>
          <span>Joined</span>
          <span />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-14 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading users...
          </div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div className="py-14 text-center text-sm text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No users found
          </div>
        )}

        <div className="divide-y divide-border">
          {!isLoading && filteredUsers.map(u => {
            const isSuspended = u.status === 'suspended';
            const userEnrollCount = u._enrollment_count ?? 0;
            return (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_120px_100px_80px] gap-4 items-center px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer ${isSuspended ? 'opacity-50' : ''}`}
              >
                <Avatar name={u.full_name} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{u.full_name || 'Unknown'}</p>
                    {isSuspended && <Badge className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0">suspended</Badge>}
                    {userEnrollCount > 0 && (
                      <span className="hidden lg:inline text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {userEnrollCount} course{userEnrollCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="hidden sm:flex">
                  <Badge className={`text-[10px] ${roleColor(u.role)}`}>
                    <Shield className="w-2.5 h-2.5 mr-1" />
                    {ROLE_CONFIG[u.role]?.label || 'Student'}
                  </Badge>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="w-3 h-3" />
                  {new Date(u.created_date).toLocaleDateString('en-MW', { day: 'numeric', month: 'short' })}
                </div>
                <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedUser(u)}>
                        <Users className="w-4 h-4 mr-2" /> View Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {isSuspended ? (
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: u.id, data: { status: 'active' } })}>
                          <UserCheck className="w-4 h-4 mr-2 text-success" /> Reactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: u.id, data: { status: 'suspended' } })}>
                          <UserX className="w-4 h-4 mr-2 text-amber-500" /> Suspend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteMutation.mutate(u.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Detail Dialog */}
      <UserDetailDialog
        user={selectedUser}
        enrollments={enrollments}
        subscriptions={subscriptions}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                className="mt-1"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Student</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Teacher role is assigned after application approval</p>
            </div>
            <Button onClick={handleInvite} className="w-full" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Mail className="w-4 h-4 mr-1.5" />}
              Send Invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}