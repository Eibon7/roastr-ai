import { Link } from "react-router-dom";
import { ArrowLeft, Fingerprint } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { PersonaForm } from "@/components/persona/PersonaForm";

export function PersonaSettingsPage() {
  const { session } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          to="/settings"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a ajustes
        </Link>
        <div className="flex items-center gap-3">
          <Fingerprint className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Roastr Persona</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ayuda a Shield y a los roasts a entender quién eres. Cifrado, invisible incluso para el equipo de Roastr.
        </p>
      </div>

      <Card>
        <CardContent>
          {session?.access_token && <PersonaForm token={session.access_token} />}
        </CardContent>
      </Card>
    </div>
  );
}
