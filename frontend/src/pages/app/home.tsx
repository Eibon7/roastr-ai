import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AppHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bienvenido a Roastr.ai</h1>
        <p className="text-muted-foreground">
          Gestiona tus cuentas y configura tus integraciones
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Cuentas</CardTitle>
            <CardDescription>Gestiona tus cuentas de redes sociales</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Conecta y configura tus plataformas para comenzar a recibir comentarios
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>Personaliza tu experiencia</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ajusta tus preferencias y configura tu persona de Roastr
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

