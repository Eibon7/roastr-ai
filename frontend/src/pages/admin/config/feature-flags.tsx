import * as React from 'react';
import { Plus, Search, Edit, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/api';

interface FeatureFlag {
  id: string;
  flag_key: string;
  flag_name: string;
  description?: string;
  is_enabled: boolean;
  flag_type: 'boolean' | 'string' | 'number' | 'json';
  flag_value: any;
  category: string;
  created_at: string;
  updated_at: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = React.useState<FeatureFlag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [selectedFlag, setSelectedFlag] = React.useState<FeatureFlag | null>(null);
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const [formData, setFormData] = React.useState<{
    flag_key: string;
    flag_name: string;
    description: string;
    is_enabled: boolean;
    flag_type: 'boolean' | 'string' | 'number' | 'json';
    flag_value: boolean | string | number;
    category: string;
  }>({
    flag_key: '',
    flag_name: '',
    description: '',
    is_enabled: false,
    flag_type: 'boolean',
    flag_value: false,
    category: 'general',
  });

  React.useEffect(() => {
    loadFlags();
  }, [page, searchQuery, categoryFilter]);

  const loadFlags = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getFeatureFlags(
        categoryFilter !== 'all' ? categoryFilter : undefined
      );
      
      if (response.success && response.data) {
        let allFlags = response.data.flags || [];
        
        // Apply search filter on frontend if needed
        if (searchQuery) {
          allFlags = allFlags.filter(
            (flag: FeatureFlag) =>
              flag.flag_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
              flag.flag_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              flag.description?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        
        setFlags(allFlags);
      }
    } catch (error: any) {
      console.error('Failed to load feature flags:', error);
      setFlags([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      const newValue = !flag.is_enabled;
      await adminApi.updateFeatureFlag(flag.flag_key, {
        is_enabled: newValue,
        flag_value: newValue,
      });
      
      // Reload flags to get fresh data
      await loadFlags();
    } catch (error: any) {
      console.error('Failed to toggle flag:', error);
      alert(error.message || 'Failed to toggle feature flag');
    }
  };

  const handleDelete = async () => {
    if (!selectedFlag) return;
    
    try {
      // Note: Feature flags are typically not deleted, just disabled
      // Disable the flag instead
      await adminApi.updateFeatureFlag(selectedFlag.flag_key, {
        is_enabled: false,
        flag_value: false,
      });
      
      // Reload flags to get fresh data
      await loadFlags();
      setDeleteDialogOpen(false);
      setSelectedFlag(null);
    } catch (error: any) {
      console.error('Failed to delete flag:', error);
      alert(error.message || 'Failed to disable feature flag');
    }
  };

  const handleEdit = (flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setFormData({
      flag_key: flag.flag_key,
      flag_name: flag.flag_name,
      description: flag.description || '',
      is_enabled: flag.is_enabled,
      flag_type: flag.flag_type,
      flag_value: flag.flag_value,
      category: flag.category,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedFlag) return;

    try {
      await adminApi.updateFeatureFlag(selectedFlag.flag_key, {
        is_enabled: formData.is_enabled,
        flag_value: formData.flag_value,
        description: formData.description,
      });
      
      // Reload flags to get fresh data
      await loadFlags();
      setEditDialogOpen(false);
      setSelectedFlag(null);
      setFormData({
        flag_key: '',
        flag_name: '',
        description: '',
        is_enabled: false,
        flag_type: 'boolean',
        flag_value: false,
        category: 'general',
      });
    } catch (error: any) {
      console.error('Failed to update flag:', error);
      alert(error.message || 'Failed to update feature flag');
    }
  };

  const handleAdd = () => {
    setSelectedFlag(null);
    setFormData({
      flag_key: '',
      flag_name: '',
      description: '',
      is_enabled: false,
      flag_type: 'boolean',
      flag_value: false,
      category: 'general',
    });
    setAddDialogOpen(true);
  };

  const handleSaveAdd = async () => {
    try {
      // Note: Creating feature flags typically requires database migration
      // This is a placeholder for future implementation
      console.log('Create feature flag:', formData);
      alert('Feature flag creation requires database migration. Please create flags through database migrations.');
      setAddDialogOpen(false);
      setFormData({
        flag_key: '',
        flag_name: '',
        description: '',
        is_enabled: false,
        flag_type: 'boolean',
        flag_value: false,
        category: 'general',
      });
    } catch (error: any) {
      console.error('Failed to create flag:', error);
      alert(error.message || 'Failed to create feature flag');
    }
  };

  const categories = ['all', 'system', 'autopost', 'ui', 'experimental', 'general'];
  const filteredFlags = flags.filter(flag => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !flag.flag_key.toLowerCase().includes(query) &&
        !flag.flag_name.toLowerCase().includes(query) &&
        !flag.description?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    if (categoryFilter !== 'all' && flag.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  const paginatedFlags = filteredFlags.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.ceil(filteredFlags.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feature Flags</h1>
          <p className="text-muted-foreground">
            Gestiona las feature flags del sistema
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Feature Flag
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por key, nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.filter(c => c !== 'all').map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Flags Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flag Key</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última Modificación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginatedFlags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron feature flags
                </TableCell>
              </TableRow>
            ) : (
              paginatedFlags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-sm">{flag.flag_key}</TableCell>
                  <TableCell className="font-medium">{flag.flag_name}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {flag.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{flag.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={flag.is_enabled}
                        onCheckedChange={() => handleToggle(flag)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {flag.is_enabled ? 'Activado' : 'Desactivado'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(flag.updated_at).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(flag)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedFlag(flag);
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
            Mostrando {paginatedFlags.length} de {filteredFlags.length} feature flags
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
            <AlertDialogTitle>¿Eliminar feature flag?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el feature flag{' '}
              <strong>{selectedFlag?.flag_key}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Feature Flag</DialogTitle>
            <DialogDescription>
              Actualiza la configuración del feature flag. El flag_key no se puede modificar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-key">Flag Key</Label>
              <Input id="edit-key" value={formData.flag_key} disabled className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input
                id="edit-name"
                value={formData.flag_name}
                onChange={(e) => setFormData({ ...formData, flag_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c !== 'all').map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-type">Tipo</Label>
              <Select
                value={formData.flag_type}
                onValueChange={(value: 'boolean' | 'string' | 'number' | 'json') =>
                  setFormData({ ...formData, flag_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_enabled: checked, flag_value: checked })
                  }
                />
                <Label>Habilitado</Label>
              </div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Añadir Feature Flag</DialogTitle>
            <DialogDescription>
              Crea un nuevo feature flag en el sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-key">Flag Key *</Label>
              <Input
                id="add-key"
                value={formData.flag_key}
                onChange={(e) => setFormData({ ...formData, flag_key: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                placeholder="FLAG_KEY_NAME"
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Usa mayúsculas y guiones bajos (ej: ENABLE_NEW_FEATURE)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-name">Nombre *</Label>
              <Input
                id="add-name"
                value={formData.flag_name}
                onChange={(e) => setFormData({ ...formData, flag_name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description">Descripción</Label>
              <Textarea
                id="add-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-category">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c !== 'all').map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-type">Tipo</Label>
              <Select
                value={formData.flag_type}
                onValueChange={(value: 'boolean' | 'string' | 'number' | 'json') => {
                  let defaultValue: boolean | string | number;
                  if (value === 'boolean') {
                    defaultValue = false;
                  } else if (value === 'number') {
                    defaultValue = 0;
                  } else {
                    defaultValue = '';
                  }
                  setFormData({ ...formData, flag_type: value, flag_value: defaultValue });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_enabled: checked, flag_value: checked })
                  }
                />
                <Label>Habilitado</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAdd}>Crear Feature Flag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
