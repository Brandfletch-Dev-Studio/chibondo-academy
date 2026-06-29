import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, UserPlus, Shield, MoreVertical, Trash2, UserX, UserCheck,
  Users, GraduationCap, BookOpen, CalendarDays, TrendingUp, X,
  Loader2, ChevronDown, Mail, AlertTriangle, CheckSquare, Square,
  RefreshCw, Download, Tag
} from 'lucide-react';
import { toast } from 'sonner';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Role values as stored in DB: "admin" | "teacher" | "user"
const ROLE_CONFIG = {
  admin:   { label: 'Admin',   color: 'bg-destructive/10 text-destructive border-destructive/20' },
  teacher: { label: 'Tutor',   color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  user:    { label: 'Student', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
};
const roleLabel = (role) => ROLE_CONFIG[role]?.label ?? 'Student';
const roleColor = (role) => ROLE_CONFIG[role]?.color ?? ROLE_CONFIG.user.color;

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center font-bold text-primary flex-shrink-0 select-none`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value ?? '—'}</p>
        <p className="text-xs font-medium text-foreground/80 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── BULK ACTION BAR ─────────────────────────────────────────────────────────
function BulkBar({ selected, total, onSelectAll, onClearAll, onBulkSuspend, onBulkReactivate, onBulkChangeRole, onBulkDelete, onExport }) {
  const count = selected.size;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
      <button onClick={count === total ? onClearAll : onSelectAll}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
        {count === total ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        {count === total ? 'Deselect all' : 'Select all'}
      </button>
      <span className="text-xs text-muted-foreground">
        <strong className="text-foreground">{count}</strong> selected
      </span>
      <div className="flex-1" />
      {/* Actions */}
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-amber-600 border-amber-400/40 hover:bg-amber-50"
        onClick={onBulkSuspend}>
        <UserX className="w-3.5 h-3.5" /> Suspend
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-emerald-600 border-emerald-400/40 hover:bg-emerald-50"
        onClick={onBulkReactivate}>
        <UserCheck className="w-3.5 h-3.5" /> Reactivate
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Change Role <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onBulkChangeRole('user')}>Set as Student</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onBulkChangeRole('teacher')}>Set as Tutor</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onBulkChangeRole('admin')}>Set as Admin</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
        onClick={onExport}>
        <Download className="w-3.5 h-3.5" /> Export CSV
      </Button>
      <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5"
        onClick={onBulkDelete}>
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </Button>
    </div>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, description, onConfirm, onCancel, loading, destructive = false }) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="w-4 h-4 text-destructive" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── USER DETAIL DIALOG ───────────────────────────────────────────────────────
function UserDetailDialog({ user, open, onClose, onUpdate, onDelete }) {
  if (!user) return null;
  const userSub = user._has_active_sub ? { plan: user._sub_plan, status: 'active' } : null;
  const enrollCount = user._enrollment_count ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
            <Avatar name={user.full_name} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{user.full_name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={`text-[10px] ${roleColor(user.role)}`}>
                  <Shield className="w-2.5 h-2.5 mr-1" />{roleLabel(user.role)}
                </Badge>
                {user.status === 'suspended' && (
                  <Badge className="text-[10px] bg-muted text-muted-foreground">Suspended</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xl font-bold">{enrollCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Enrolled</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xl font-bold">{user.total_learning_hours ?? 0}h</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Learning</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xl font-bold" style={{ color: userSub ? 'hsl(160 60% 40%)' : undefined }}>
                {userSub ? '✓' : '✗'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Subscribed</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium truncate ml-4">{user.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Joined</span>
              <span className="font-medium">
                {new Date(user.created_date).toLocaleDateString('en-MW', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Subscription</span>
              <span className="font-medium capitalize">{userSub ? `${userSub.plan} (active)` : 'None'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Role</span>
              <Select value={user.role || 'user'} onValueChange={role => onUpdate(user.id, { role })}>
                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Student</SelectItem>
                  <SelectItem value="teacher">Tutor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {user.status === 'suspended' ? (
              <Button variant="outline" size="sm" className="flex-1 text-emerald-600 border-emerald-400/30 hover:bg-emerald-50"
                onClick={() => { onUpdate(user.id, { status: 'active' }); onClose(); }}>
                <UserCheck className="w-4 h-4 mr-1.5" /> Reactivate
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="flex-1 text-amber-600 border-amber-500/30 hover:bg-amber-50"
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

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const qc = useQueryClient();

  // ── Filters & search ──
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch]         = useState('');

  // ── Selection (bulk actions) ──
  const [selected, setSelected] = useState(new Set());

  // ── Dialogs ──
  const [selectedUser, setSelectedUser]   = useState(null);
  const [inviteOpen, setInviteOpen]       = useState(false);
  const [inviteEmail, setInviteEmail]     = useState('');
  const [inviteRole, setInviteRole]       = useState('user');
  const [inviting, setInviting]           = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, desc, action }
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Data: try getAdminUsers (asServiceRole) first, fall back to direct entity query ──
  const { data: adminData, isLoading, refetch } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      try {
        const result = await base44.functions.invoke('getAdminUsers', {});
        // If function returned an error object or no users array, fall back
        if (!result || result.error || !Array.isArray(result.users)) {
          console.warn('getAdminUsers failed, falling back to direct entity query:', result?.error);
          const users = await base44.entities.User.list('-created_date', 2000);
          const enrollments = await base44.entities.Enrollment.filter({}).catch(() => []);
          const activeSubs = await base44.entities.Subscription.filter({ status: 'active' }).catch(() => []);
          const activeSubByUser = {};
          activeSubs.forEach(s => { if (s.student_id) activeSubByUser[s.student_id] = s; });
          const enrollCountByUser = {};
          enrollments.forEach(e => { if (e.student_id) enrollCountByUser[e.student_id] = (enrollCountByUser[e.student_id] || 0) + 1; });
          const enriched = users.map(u => ({
            ...u,
            _enrollment_count: enrollCountByUser[u.id] || 0,
            _has_active_sub: !!activeSubByUser[u.id],
            _sub_plan: activeSubByUser[u.id]?.plan || null,
          }));
          return {
            users: enriched,
            total: users.length,
            students: users.filter(u => u.role === 'user' || !u.role).length,
            teachers: users.filter(u => u.role === 'teacher').length,
            admins: users.filter(u => u.role === 'admin').length,
            subscribed: Object.keys(activeSubByUser).length,
            enrollments: enrollments.length,
          };
        }
        return result;
      } catch (e) {
        console.error('UserManagement data fetch error:', e);
        // Last resort: direct entity query
        const users = await base44.entities.User.list('-created_date', 2000);
        return { users, total: users.length, students: 0, teachers: 0, admins: 0, subscribed: 0, enrollments: 0 };
      }
    },
    staleTime: 30_000,
    retry: 2,
  });

  // getAdminUsers returns { users, total, students, teachers, admins, subscribed, enrollments }
  const users = adminData?.users ?? [];

  // ── Filtered list ──
  const filteredUsers = users.filter(u => {
    const matchRole =
      roleFilter === 'all'
      || (roleFilter === 'suspended' && u.status === 'suspended')
      || (roleFilter === 'user'  && (u.role === 'user'  || !u.role))
      || (roleFilter === u.role);
    const q = search.toLowerCase();
    const matchSearch = !q
      || u.full_name?.toLowerCase().includes(q)
      || u.email?.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  // ── Counts ──
  const counts = {
    all:       adminData?.total     ?? users.length,
    user:      adminData?.students  ?? users.filter(u => u.role === 'user' || !u.role).length,
    teacher:   adminData?.teachers  ?? users.filter(u => u.role === 'teacher').length,
    admin:     adminData?.admins    ?? users.filter(u => u.role === 'admin').length,
    suspended: users.filter(u => u.status === 'suspended').length,
  };

  const newThisMonth = users.filter(u => {
    const d = new Date(u.created_date), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  // ── Mutations ──
  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminUsers'] }); toast.success('User updated'); },
    onError:   () => toast.error('Update failed'),
  });

  const deleteUser = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminUsers'] }); toast.success('User deleted'); },
    onError:   () => toast.error('Delete failed'),
  });

  // ── Selection helpers ──
  const toggleOne = useCallback((id, e) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll  = () => setSelected(new Set(filteredUsers.map(u => u.id)));
  const clearAll   = () => setSelected(new Set());

  // ── Bulk helpers ──
  const runConfirm = (title, desc, action) =>
    setConfirmDialog({ title, desc, action });

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    setConfirmLoading(true);
    try { await confirmDialog.action(); }
    finally { setConfirmLoading(false); setConfirmDialog(null); }
  };

  const bulkSuspend = () => runConfirm(
    `Suspend ${selected.size} users`,
    'Selected users will be suspended and lose access.',
    async () => {
      await Promise.all([...selected].map(id => base44.entities.User.update(id, { status: 'suspended' })));
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(`${selected.size} users suspended`);
      clearAll();
    }
  );

  const bulkReactivate = () => runConfirm(
    `Reactivate ${selected.size} users`,
    'Selected users will have their access restored.',
    async () => {
      await Promise.all([...selected].map(id => base44.entities.User.update(id, { status: 'active' })));
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(`${selected.size} users reactivated`);
      clearAll();
    }
  );

  const bulkChangeRole = (role) => runConfirm(
    `Change role to ${roleLabel(role)}`,
    `${selected.size} users will be assigned the ${roleLabel(role)} role.`,
    async () => {
      await Promise.all([...selected].map(id => base44.entities.User.update(id, { role })));
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(`${selected.size} users updated to ${roleLabel(role)}`);
      clearAll();
    }
  );

  const bulkDelete = () => runConfirm(
    `Delete ${selected.size} users?`,
    'This is permanent and cannot be undone. All user data will be lost.',
    async () => {
      await Promise.all([...selected].map(id => base44.entities.User.delete(id)));
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success(`${selected.size} users deleted`);
      clearAll();
    }
  );

  // ── CSV export ──
  const exportCSV = () => {
    const cols = ['full_name', 'email', 'role', 'status', 'created_date', 'subscription_plan'];
    const rows = filteredUsers
      .filter(u => selected.size === 0 || selected.has(u.id))
      .map(u => cols.map(c => `"${String(u[c] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV downloaded');
  };

  // ── Invite ──
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole === 'admin' ? 'admin' : 'user');
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail('');
    } catch { toast.error('Could not send invite'); }
    finally { setInviting(false); }
  };

  const FILTERS = [
    { key: 'all',       label: 'All',      count: counts.all },
    { key: 'user',      label: 'Students', count: counts.user },
    { key: 'teacher',   label: 'Tutors',   count: counts.teacher },
    { key: 'admin',     label: 'Admins',   count: counts.admin },
    { key: 'suspended', label: 'Suspended',count: counts.suspended },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? 'Loading…' : `${counts.all} registered users`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-9 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)} className="h-9 gap-1.5">
            <UserPlus className="w-4 h-4" /> Invite User
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users}        label="Total Users"   value={counts.all}             sub={`+${newThisMonth} this month`}           color="bg-primary/10 text-primary" />
        <StatCard icon={BookOpen}     label="Students"      value={counts.user}             sub={`${adminData?.subscribed ?? 0} subscribed`} color="bg-sky-500/10 text-sky-600" />
        <StatCard icon={GraduationCap} label="Tutors"       value={counts.teacher}          sub="Active educators"                         color="bg-amber-500/10 text-amber-600" />
        <StatCard icon={TrendingUp}   label="Enrollments"   value={adminData?.enrollments ?? 0} sub="Total course enrollments"            color="bg-emerald-500/10 text-emerald-600" />
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            className="pl-9 h-9"
            value={search}
            onChange={e => { setSearch(e.target.value); clearAll(); }}
          />
          {search && (
            <button onClick={() => { setSearch(''); clearAll(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setRoleFilter(f.key); clearAll(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                roleFilter === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}>
              {f.label}
              <span className={`ml-1.5 text-[10px] ${roleFilter === f.key ? 'opacity-70' : 'opacity-50'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar (appears when rows are selected) ── */}
      {selected.size > 0 && (
        <BulkBar
          selected={selected}
          total={filteredUsers.length}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          onBulkSuspend={bulkSuspend}
          onBulkReactivate={bulkReactivate}
          onBulkChangeRole={bulkChangeRole}
          onBulkDelete={bulkDelete}
          onExport={exportCSV}
        />
      )}

      {/* ── User table ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[40px_40px_1fr_130px_110px_90px_64px] gap-3 px-5 py-3 bg-muted/30 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          <div className="flex items-center">
            <Checkbox
              checked={filteredUsers.length > 0 && selected.size === filteredUsers.length}
              onCheckedChange={v => v ? selectAll() : clearAll()}
              aria-label="Select all"
            />
          </div>
          <span />
          <span>User</span>
          <span>Role</span>
          <span>Joined</span>
          <span>Courses</span>
          <span />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
          </div>
        )}

        {/* Empty */}
        {!isLoading && filteredUsers.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {search ? `No users matching "${search}"` : 'No users found'}
          </div>
        )}

        {/* Rows */}
        <div className="divide-y divide-border">
          {!isLoading && filteredUsers.map(u => {
            const isSuspended = u.status === 'suspended';
            const isSelected  = selected.has(u.id);
            const enrollCount = u._enrollment_count ?? 0;

            return (
              <div
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`
                  grid grid-cols-[40px_40px_1fr] sm:grid-cols-[40px_40px_1fr_130px_110px_90px_64px]
                  gap-3 items-center px-5 py-3.5 cursor-pointer transition-colors
                  ${isSelected ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-muted/20'}
                  ${isSuspended ? 'opacity-60' : ''}
                `}
              >
                {/* Checkbox */}
                <div onClick={e => toggleOne(u.id, e)} className="flex items-center">
                  <Checkbox checked={isSelected} onCheckedChange={() => {}} aria-label={`Select ${u.full_name}`} />
                </div>

                {/* Avatar */}
                <Avatar name={u.full_name} />

                {/* Name + email */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-medium text-sm truncate">{u.full_name || 'Unknown'}</p>
                    {isSuspended && (
                      <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-300 px-1.5 py-0">suspended</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>

                {/* Role */}
                <div className="hidden sm:flex">
                  <Badge className={`text-[10px] ${roleColor(u.role)}`}>
                    <Shield className="w-2.5 h-2.5 mr-1" />
                    {roleLabel(u.role)}
                  </Badge>
                </div>

                {/* Joined */}
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="w-3 h-3 flex-shrink-0" />
                  {new Date(u.created_date).toLocaleDateString('en-MW', { day: 'numeric', month: 'short', year: '2-digit' })}
                </div>

                {/* Courses */}
                <div className="hidden sm:flex">
                  {enrollCount > 0 ? (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {enrollCount} course{enrollCount !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>

                {/* Row menu */}
                <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setSelectedUser(u)}>
                        <Users className="w-4 h-4 mr-2" /> View Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {isSuspended ? (
                        <DropdownMenuItem onClick={() => updateUser.mutate({ id: u.id, data: { status: 'active' } })}>
                          <UserCheck className="w-4 h-4 mr-2 text-emerald-500" /> Reactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => updateUser.mutate({ id: u.id, data: { status: 'suspended' } })}>
                          <UserX className="w-4 h-4 mr-2 text-amber-500" /> Suspend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => runConfirm(
                          'Delete user?',
                          `This will permanently delete ${u.full_name || u.email}. Cannot be undone.`,
                          async () => { deleteUser.mutate(u.id); }
                        )}
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

        {/* Footer count */}
        {!isLoading && filteredUsers.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <strong>{filteredUsers.length}</strong> of <strong>{counts.all}</strong> users
            </p>
            {filteredUsers.length < counts.all && (
              <button onClick={exportCSV}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <Download className="w-3 h-3" /> Export visible
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── User detail dialog ── */}
      <UserDetailDialog
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onUpdate={(id, data) => updateUser.mutate({ id, data })}
        onDelete={(id) => runConfirm(
          'Delete user?',
          `Permanently delete ${selectedUser?.full_name || selectedUser?.email}?`,
          async () => { deleteUser.mutate(id); setSelectedUser(null); }
        )}
      />

      {/* ── Invite dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Invite User
            </DialogTitle>
            <DialogDescription>They'll receive an email with a sign-up link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email address</label>
              <Input
                type="email"
                placeholder="student@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Student</SelectItem>
                  <SelectItem value="teacher">Tutor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generic confirm dialog ── */}
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.desc}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmDialog(null)}
        loading={confirmLoading}
        destructive={confirmDialog?.title?.toLowerCase().includes('delete')}
      />
    </div>
  );
}
