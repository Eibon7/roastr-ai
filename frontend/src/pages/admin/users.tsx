import * as React from 'react';
import { Plus, Search, Edit, Trash2, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { adminApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  is_admin?: boolean;
  active?: boolean;
  suspended?: boolean;
  plan?: string;
  created_at: string;
  last_activity_at?: string;
  handles?: string;
  usage?: {
    roasts: string;
    analysis: string;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const pageSize = 10;

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    password: '',
    is_admin: false,
    status: 'active' as 'active' | 'inactive'
  });

  React.useEffect(() => {
    loadUsers();
  }, [page, searchQuery]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getUsers({
        page,
        limit: pageSize,
        search: searchQuery || undefined
      });

      if (response.success && response.data) {
        // Transform backend data to frontend format
        const transformedUsers: User[] = response.data.users.map((user: any) => ({
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          is_admin: user.is_admin || false,
          active: user.active !== false,
          suspended: user.suspended || false,
          plan: user.plan,
          created_at: user.created_at,
          last_activity_at: user.last_activity_at,
          handles: user.handles,
          usage: user.usage
        }));
        setUsers(transformedUsers);

        // Update pagination info
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.total_pages || 1);
          setTotalUsers(response.data.pagination.total || 0);
        }
      }
    } catch (error: any) {
      console.error('Failed to load users:', error);
      // Fallback to empty array on error
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      // Note: There's no DELETE endpoint, so we suspend the user instead
      await adminApi.suspendUser(selectedUser.id, 'Deleted by admin');
      setUsers(
        users.map((u) => (u.id === selectedUser.id ? { ...u, suspended: true, active: false } : u))
      );
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      // Reload users to get fresh data
      loadUsers();
    } catch (error: any) {
      console.error('Failed to suspend user:', error);
      alert(error.message || 'Failed to suspend user');
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '',
      is_admin: user.is_admin || false,
      status: user.active && !user.suspended ? 'active' : 'inactive'
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    try {
      // Update admin status if changed
      if (formData.is_admin !== selectedUser.is_admin) {
        await adminApi.toggleUserAdmin(selectedUser.id);
      }

      // Update active status if changed
      const newActive = formData.status === 'active';
      if (newActive !== selectedUser.active && !selectedUser.suspended) {
        await adminApi.toggleUserActive(selectedUser.id);
      }

      // Reload users to get fresh data
      await loadUsers();
      setEditDialogOpen(false);
      setSelectedUser(null);
      setFormData({ name: '', email: '', password: '', is_admin: false, status: 'active' });
    } catch (error: any) {
      console.error('Failed to update user:', error);
      alert(error.message || 'Failed to update user');
    }
  };

  const handleAdd = () => {
    setSelectedUser(null);
    setFormData({ name: '', email: '', password: '', is_admin: false, status: 'active' });
    setAddDialogOpen(true);
  };

  const handleSaveAdd = async () => {
    try {
      // Note: Creating users is typically done through auth flow, not admin panel
      // This is a placeholder for future implementation
      console.log('Create user:', formData);
      alert(
        'User creation through admin panel is not yet implemented. Use the registration flow instead.'
      );
      setAddDialogOpen(false);
      setFormData({ name: '', email: '', password: '', is_admin: false, status: 'active' });
    } catch (error: any) {
      console.error('Failed to create user:', error);
      alert(error.message || 'Failed to create user');
    }
  };

  const handleImpersonate = async (user: User) => {
    try {
      // Note: Impersonation endpoint may not exist in backend
      // This is a placeholder for future implementation
      console.log('Impersonate user:', user.id);
      alert('Impersonation feature not yet implemented');
    } catch (error: any) {
      console.error('Failed to impersonate user:', error);
      alert(error.message || 'Failed to impersonate user');
    }
  };

  // Users are already filtered and paginated by the API
  const paginatedUsers = users;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground">Gestiona los usuarios del sistema</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Usuario
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name || '-'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="font-mono text-sm">{user.id}</TableCell>
                  <TableCell>
                    <Badge variant={user.active && !user.suspended ? 'default' : 'secondary'}>
                      {user.suspended ? 'Suspendido' : user.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.is_admin && <Badge variant="outline">Admin</Badge>}
                    {user.plan && (
                      <Badge variant="secondary" className="ml-1">
                        {user.plan}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleImpersonate(user)}
                        title="Entrar como usuario"
                      >
                        <LogIn className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(user)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setDeleteDialogOpen(true);
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {paginatedUsers.length} de {totalUsers} usuarios
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el usuario{' '}
              <strong>{selectedUser?.email}</strong> (ID: {selectedUser?.id}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Actualiza la información del usuario. El email y ID no se pueden modificar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={formData.email} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'inactive') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Usuario</DialogTitle>
            <DialogDescription>Crea un nuevo usuario en el sistema.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Nombre</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-password">Contraseña *</Label>
              <Input
                id="add-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'inactive') =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAdd}>Crear Usuario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
