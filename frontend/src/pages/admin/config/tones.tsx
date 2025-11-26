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
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
import { adminApi } from '@/lib/api';

interface Tone {
  id: string;
  name: string;
  description: string;
  descriptionEn: string;
  intensity: number;
  example: string;
  status: 'active' | 'inactive';
}

export default function TonesPage() {
  const [tones, setTones] = React.useState<Tone[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [selectedTone, setSelectedTone] = React.useState<Tone | null>(null);

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    descriptionEn: '',
    intensity: 3,
    example: '',
    status: 'active' as 'active' | 'inactive'
  });

  React.useEffect(() => {
    loadTones();
  }, [searchQuery]);

  const loadTones = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getTones();

      if (response.success && response.data) {
        // Transform backend data to frontend format
        const transformedTones: Tone[] = response.data.map((tone: any) => ({
          id: tone.id || tone.name,
          name: tone.name,
          description: tone.description || tone.descriptionEs || '',
          descriptionEn: tone.descriptionEn || tone.description_en || '',
          intensity: tone.intensity || 3,
          example: tone.example || '',
          status: tone.status || (tone.active !== false ? 'active' : 'inactive')
        }));

        let filtered = transformedTones;

        if (searchQuery) {
          filtered = filtered.filter(
            (tone) =>
              tone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tone.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tone.example.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        setTones(filtered);
      }
    } catch (error: any) {
      console.error('Failed to load tones:', error);
      setTones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTone) return;

    try {
      // Note: Tones are typically not deleted, just disabled
      // This is a placeholder - actual implementation depends on backend
      console.log('Delete tone:', selectedTone.id);
      alert('Tone deletion not yet implemented. Tones are managed in code (src/config/tones.js).');
      setDeleteDialogOpen(false);
      setSelectedTone(null);
    } catch (error: any) {
      console.error('Failed to delete tone:', error);
      alert(error.message || 'Failed to delete tone');
    }
  };

  const handleEdit = (tone: Tone) => {
    setSelectedTone(tone);
    setFormData({
      name: tone.name,
      description: tone.description,
      descriptionEn: tone.descriptionEn,
      intensity: tone.intensity,
      example: tone.example,
      status: tone.status
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTone) return;

    try {
      // Note: Tone updates require code changes
      // This is a placeholder for future dynamic tone management
      await adminApi.updateTone(selectedTone.id, {
        name: formData.name,
        description: formData.description,
        descriptionEn: formData.descriptionEn,
        intensity: formData.intensity,
        example: formData.example,
        active: formData.status === 'active'
      });

      // Reload tones to get fresh data
      await loadTones();
      setEditDialogOpen(false);
      setSelectedTone(null);
      setFormData({
        name: '',
        description: '',
        descriptionEn: '',
        intensity: 3,
        example: '',
        status: 'active'
      });
    } catch (error: any) {
      console.error('Failed to update tone:', error);
      alert(error.message || 'Failed to update tone');
    }
  };

  const handleAdd = () => {
    setSelectedTone(null);
    setFormData({
      name: '',
      description: '',
      descriptionEn: '',
      intensity: 3,
      example: '',
      status: 'active'
    });
    setAddDialogOpen(true);
  };

  const handleSaveAdd = async () => {
    try {
      // Note: Creating tones typically requires database migration
      // This is a placeholder for future dynamic tone management
      console.log('Create tone:', formData);
      alert(
        'Tone creation requires database migration. Tones are currently managed in code (src/config/tones.js).'
      );
      setAddDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        descriptionEn: '',
        intensity: 3,
        example: '',
        status: 'active'
      });
    } catch (error: any) {
      console.error('Failed to create tone:', error);
      alert(error.message || 'Failed to create tone');
    }
  };

  const filteredTones = tones.filter(
    (tone) =>
      !searchQuery ||
      tone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tone.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tone.example.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Tonos</h1>
          <p className="text-muted-foreground">Gestiona los tonos disponibles para los roasts</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Tono
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, descripción o ejemplo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Nota Importante</CardTitle>
          <CardDescription>
            Los tonos están definidos en código (src/config/tones.js) como constantes. Esta página
            muestra la configuración actual para referencia. Las modificaciones requieren cambios en
            el código fuente.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Tones Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción (ES)</TableHead>
              <TableHead>Descripción (EN)</TableHead>
              <TableHead>Intensidad</TableHead>
              <TableHead>Ejemplo</TableHead>
              <TableHead>Estado</TableHead>
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
            ) : filteredTones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron tonos
                </TableCell>
              </TableRow>
            ) : (
              filteredTones.map((tone) => (
                <TableRow key={tone.id}>
                  <TableCell className="font-medium">{tone.name}</TableCell>
                  <TableCell>{tone.description}</TableCell>
                  <TableCell>{tone.descriptionEn}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{tone.intensity}/5</Badge>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-2 w-2 rounded-full ${
                              i < tone.intensity ? 'bg-primary' : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md truncate">{tone.example}</TableCell>
                  <TableCell>
                    <Badge variant={tone.status === 'active' ? 'default' : 'secondary'}>
                      {tone.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(tone)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedTone(tone);
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tono?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el tono{' '}
              <strong>{selectedTone?.name}</strong>.
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Tono</DialogTitle>
            <DialogDescription>
              Actualiza la información del tono. Nota: Los cambios en código requieren actualización
              del backend.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripción (ES) *</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description-en">Descripción (EN) *</Label>
              <Input
                id="edit-description-en"
                value={formData.descriptionEn}
                onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-intensity">Intensidad (1-5) *</Label>
              <Select
                value={formData.intensity.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, intensity: parseInt(value, 10) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <SelectItem key={level} value={level.toString()}>
                      {level}/5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-example">Ejemplo *</Label>
              <Textarea
                id="edit-example"
                value={formData.example}
                onChange={(e) => setFormData({ ...formData, example: e.target.value })}
                rows={3}
              />
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
            <DialogTitle>Añadir Tono</DialogTitle>
            <DialogDescription>
              Crea un nuevo tono. Nota: Esto requiere actualización del código backend.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Nombre *</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description">Descripción (ES) *</Label>
              <Input
                id="add-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description-en">Descripción (EN) *</Label>
              <Input
                id="add-description-en"
                value={formData.descriptionEn}
                onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-intensity">Intensidad (1-5) *</Label>
              <Select
                value={formData.intensity.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, intensity: parseInt(value, 10) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <SelectItem key={level} value={level.toString()}>
                      {level}/5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-example">Ejemplo *</Label>
              <Textarea
                id="add-example"
                value={formData.example}
                onChange={(e) => setFormData({ ...formData, example: e.target.value })}
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAdd}>Crear Tono</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
