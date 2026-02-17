'use client';

import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetPassword } from '@/hooks/useUsers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { Plus, UserX, KeyRound, Pencil } from 'lucide-react';

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  ADMIN: 'default',
  TRAINER: 'secondary',
  TRAINEE: 'outline',
};

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data: users, isLoading } = useUsers(
    Object.fromEntries(
      Object.entries({ role: roleFilter === 'all' ? '' : roleFilter, search }).filter(([_, v]) => v)
    )
  );
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'TRAINEE' as string });

  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwUserId, setPwUserId] = useState<string>('');
  const [pwUserName, setPwUserName] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');

  const handleSave = async () => {
    try {
      if (editUser) {
        await updateUser.mutateAsync({ id: editUser.id, name: form.name, role: form.role });
        toast({ title: 'User updated' });
      } else {
        await createUser.mutateAsync(form);
        toast({ title: 'User created' });
      }
      setDialogOpen(false);
      setEditUser(null);
      setForm({ email: '', password: '', name: '', role: 'TRAINEE' });
    } catch {
      toast({ title: 'Operation failed', variant: 'destructive' });
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deleteUser.mutateAsync(id);
      toast({ title: 'User deactivated' });
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const openResetPw = (user: any) => {
    setPwUserId(user.id);
    setPwUserName(user.name);
    setNewPassword('');
    setPwDialogOpen(true);
  };

  const handleResetPw = async () => {
    if (newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: pwUserId, password: newPassword });
      toast({ title: 'Password changed successfully' });
      setPwDialogOpen(false);
    } catch {
      toast({ title: 'Failed to change password', variant: 'destructive' });
    }
  };

  const openEdit = (user: any) => {
    setEditUser(user);
    setForm({ email: user.email, password: '', name: user.name, role: user.role });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ email: '', password: '', name: '', role: 'TRAINEE' });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage all platform users</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="TRAINER">Trainer</SelectItem>
            <SelectItem value="TRAINEE">Trainee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
              ) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No users found</TableCell></TableRow>
              ) : (
                users?.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant={roleBadgeVariant[user.role]}>{user.role}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openResetPw(user)} title="Change password">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeactivate(user.id)}>
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>{editUser ? 'Update user details.' : 'Add a new user to the platform.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!editUser && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@soc.local" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            {!editUser && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="TRAINER">Trainer</SelectItem>
                  <SelectItem value="TRAINEE">Trainee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editUser ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Set a new password for {pwUserName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                onKeyDown={(e) => e.key === 'Enter' && handleResetPw()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPw} disabled={resetPassword.isPending}>
              {resetPassword.isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
