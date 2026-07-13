import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useOnboardingState } from "@/hooks/use-onboarding";

/**
 * Redirects an authenticated user with incomplete onboarding back to the
 * wizard instead of letting them reach the rest of the app freely. Renders
 * children (fail-open) if the onboarding state can't be determined (e.g. a
 * transient API error) rather than trapping the user on an error.
 */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { state, loading } = useOnboardingState(session?.access_token);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (state !== null && state !== "done") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
