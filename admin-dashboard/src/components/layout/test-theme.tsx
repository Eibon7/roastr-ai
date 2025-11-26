import { ThemeToggle } from './theme-toggle';
import { Button } from '@/components/ui/button';

/**
 * Componente de test para verificar que el tema funciona correctamente
 * Debe mostrarse correctamente en modo claro, oscuro y sistema
 */
export function TestTheme() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Roastr.AI Admin Dashboard</h1>

      <div className="flex gap-4 items-center">
        <p className="text-muted-foreground">Toggle del tema:</p>
        <ThemeToggle />
      </div>

      <div className="flex gap-4">
        <Button>Primary Button</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-4xl">
        <div className="p-6 rounded-lg bg-card border">
          <h3 className="font-semibold mb-2">Card Component</h3>
          <p className="text-sm text-muted-foreground">
            Este es un ejemplo de card con el tema aplicado correctamente.
          </p>
        </div>
        <div className="p-6 rounded-lg bg-primary text-primary-foreground">
          <h3 className="font-semibold mb-2">Primary Card</h3>
          <p className="text-sm">Card con colores primarios del tema.</p>
        </div>
        <div className="p-6 rounded-lg bg-secondary text-secondary-foreground">
          <h3 className="font-semibold mb-2">Secondary Card</h3>
          <p className="text-sm">Card con colores secundarios del tema.</p>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mt-8">
        ✅ Issue #1033: shadcn/ui + ThemeProvider configurado
      </div>
    </div>
  );
}
