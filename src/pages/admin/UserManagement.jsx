import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Mail, Shield, MoreVertical, Trash2, UserX, UserCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_COLORS = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  teacher: 'bg-accent/10 text-accent border-accent/20',
  student: 'bg-primary/10 text-primary border-primary/20',
  suspended: 'bg-muted text-muted-foreground border-border',
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  const [confirmDialog, setConfirmDialog] = useState(null); // { type, user }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      const messages = {
        suspended: 'User suspended',
        active: 'User reactivated',
        role: 'Role updated',
      };
      toast.success(messages[vars._action] || 'User updated');
      setConfirmDialog(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('User deleted');
      setConfirmDialog(null);
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    await base44.users.inviteUser(inviteEmail.trim(), inviteRole === 'admin' ? 'admin' : 'user');
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteOpen(false);
    setInviteEmail('');
  };

  const filteredUsers = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter || (roleFilter === 'suspended' && u.status === 'suspended');
    const matchSearch = !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const counts = {
    all: users.length,
    student: users.filter(u => u.role === 'student' || !u.role).length,
    teacher: users.filter(u => u.role === 'teacher').length,
    admin: users.filter(u => u.role === 'admin').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} total users</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> Invite User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Email Address</Label>
                <Input type="email" className="mt-1" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Teacher role is assigned after application approval</p>
              </div>
              <Button onClick={handleInvite} className="w-full"><Mail className="w-4 h-4 mr-1" /> Send Invitation</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Tabs value={roleFilter} onValueChange={setRoleFilter}>
          <TabsList>
            <TabsTrigger value="all">All <span className="ml-1 text-[10px] opacity-60">{counts.all}</span></TabsTrigger>
            <TabsTrigger value="student">Students <span className="ml-1 text-[10px] opacity-60">{counts.student}</span></TabsTrigger>
            <TabsTrigger value="teacher">Teachers <span className="ml-1 text-[10px] opacity-60">{counts.teacher}</span></TabsTrigger>
            <TabsTrigger value="admin">Admins <span className="ml-1 text-[10px] opacity-60">{counts.admin}</span></TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* User Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border">
          {isLoading && (
            <div className="text-center py-10 text-muted-foreground text-sm">Loading users...</div>
          )}
          {!isLoading && filteredUsers.map(u => {
            const isSuspended = u.status === 'suspended';
            return (
              <div key={u.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors ${isSuspended ? 'opacity-60' : ''}`}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {u.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{u.full_name || 'Unknown'}</p>
                    {isSuspended && <Badge className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0">suspended</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                {/* Role Badge */}
                <Badge className={`text-[10px] hidden sm:flex ${ROLE_COLORS[u.role || 'student']}`}>
                  <Shield className="w-2.5 h-2.5 mr-1" />{u.role || 'student'}
                </Badge>
                {/* Role Selector */}
                <Select
                  value={u.role || 'student'}
                  onValueChange={(role) => updateMutation.mutate({ id: u.id, data: { role }, _action: 'role' })}
                >
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isSuspended ? (
                      <DropdownMenuItem onClick={() => updateMutation.mutate({ id: u.id, data: { status: 'active' }, _action: 'active' })}>
                        <UserCheck className="w-4 h-4 mr-2 text-success" /> Reactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setConfirmDialog({ type: 'suspend', user: u })}>
                        <UserX className="w-4 h-4 mr-2 text-accent" /> Suspend
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDialog({ type: 'delete', user: u })}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          {!isLoading && filteredUsers.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">No users found</p>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === 'delete' ? 'Delete User' : 'Suspend User'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {confirmDialog?.type === 'delete'
              ? `Are you sure you want to permanently delete ${confirmDialog?.user?.full_name}? This cannot be undone.`
              : `Are you sure you want to suspend ${confirmDialog?.user?.full_name}? They will not be able to log in.`}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (confirmDialog?.type === 'delete') {
                  deleteMutation.mutate(confirmDialog.user.id);
                } else {
                  updateMutation.mutate({ id: confirmDialog.user.id, data: { status: 'suspended' }, _action: 'suspended' });
                }
              }}
            >
              {confirmDialog?.type === 'delete' ? 'Delete' : 'Suspend'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}