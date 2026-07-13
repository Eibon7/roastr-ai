import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import {
  useOnboardingState,
  persistOnboardingState,
  isOnboardingState,
  type OnboardingState,
} from "@/hooks/use-onboarding";
import { PersonaForm } from "@/components/persona/PersonaForm";
import { PLAN_LIMITS, type Plan } from "@roastr/shared";

const STEPS = [
  { id: "welcome", label: "Bienvenida" },
  { id: "select_plan", label: "Elige plan" },
  { id: "payment", label: "Pago" },
  { id: "persona_setup", label: "Persona" },
  { id: "connect_accounts", label: "Conectar cuentas" },
] as const satisfies ReadonlyArray<{ id: OnboardingState; label: string }>;

const PLANS = (Object.keys(PLAN_LIMITS) as Plan[]).map((id) => ({
  id,
  price: PLAN_LIMITS[id].priceEur,
  analysis: PLAN_LIMITS[id].analysisLimit,
  accounts: PLAN_LIMITS[id].accountsPerPlatform,
  trial: PLAN_LIMITS[id].trialDays,
}));

function stepIndexForState(state: OnboardingState): number {
  const idx = STEPS.findIndex((s) => s.id === state);
  // "done" isn't a step in this wizard — callers should redirect away before
  // rendering it; falling back to the last step is a safe no-op otherwise.
  return idx >= 0 ? idx : STEPS.length - 1;
}

const CONNECT_ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Error al conectar. Inténtalo de nuevo.",
  access_denied: "Acceso denegado. Por favor, acepta los permisos para continuar.",
};

function mapConnectError(slug: string): string {
  return CONNECT_ERROR_MESSAGES[slug] ?? "Error al conectar. Inténtalo de nuevo.";
}

export function OnboardingWizard() {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const { state: fetchedState, loading: stateLoading } = useOnboardingState(token);
  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("starter");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Tracks whether `step` has been initialized from the backend/query param
  // yet, so the persist effect below doesn't fire a redundant POST for the
  // state we just read via GET.
  const initialized = useRef(false);

  async function finishOnboarding() {
    if (token) {
      await persistOnboardingState(token, "done").catch(() => {
        // Best-effort — if this fails, RequireOnboarding will send the user
        // back here on their next navigation and they can finish again.
      });
    }
    navigate("/dashboard", { replace: true });
  }

  useEffect(() => {
    if (initialized.current || stateLoading) return;

    if (fetchedState === "done") {
      navigate("/dashboard", { replace: true });
      return;
    }

    // Returning from the OAuth callback (see connect.tsx / oauth.controller.ts
    // — the authorize call is made with ?returnTo=onboarding so the provider
    // redirect lands back here instead of on /connect).
    const oauthSuccess = searchParams.get("success");
    const oauthError = searchParams.get("error");
    if (oauthSuccess === "youtube" || oauthSuccess === "x") {
      // Skip rendering connect_accounts — onboarding is complete the moment
      // at least one account is connected, so go straight to /dashboard.
      // Not calling setStep() here avoids a race between this "done" write
      // and the step-change effect's own persist for "connect_accounts".
      initialized.current = true;
      finishOnboarding();
      return;
    }
    if (oauthError) {
      setConnectError(mapConnectError(oauthError));
      setStep(stepIndexForState("connect_accounts"));
      initialized.current = true;
      return;
    }

    const stepParam = searchParams.get("step");
    const initialState: OnboardingState =
      stepParam && isOnboardingState(stepParam) ? stepParam : (fetchedState ?? "welcome");

    setStep(stepIndexForState(initialState));
    initialized.current = true;
  }, [fetchedState, stateLoading, searchParams, navigate]);

  // Persists the current step as the user's onboarding state whenever it
  // changes (after the initial load above), so a refresh or a later visit
  // resumes exactly where they left off instead of restarting from welcome.
  useEffect(() => {
    if (!initialized.current || !token) return;
    const current = STEPS[step]?.id;
    if (!current) return;
    persistOnboardingState(token, current).catch(() => {
      // Best-effort: a transient failure here shouldn't block the wizard UI;
      // the next step transition (or a page reload) will retry the write.
    });
  }, [step, token]);

  if (stateLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  const currentStepId = STEPS[step]?.id ?? "welcome";

  return (
    <div className="flex min-h-screen flex-col bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex gap-2" role="tablist" aria-label="Pasos del onboarding">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-disabled={i > step}
                disabled={i > step}
                onClick={() => { if (i <= step) setStep(i); }}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                } disabled:cursor-not-allowed`}
                aria-label={`Paso ${i + 1}: ${s.label}`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Paso {step + 1} de {STEPS.length}: {STEPS[step]?.label}
          </p>
        </div>

        <div className="rounded-lg border border-input bg-card p-6">
          {currentStepId === "welcome" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">
                Bienvenido a Roastr
              </h2>
              <p className="text-muted-foreground">
                Protege tus redes sociales con Shield. En unos pasos estarás listo.
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continuar
              </button>
            </div>
          )}

          {currentStepId === "select_plan" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Elige tu plan</h2>
              <p className="text-muted-foreground">
                Compara los planes y selecciona el que mejor se adapte a ti.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-input">
                      <th className="py-2 text-left font-medium">Plan</th>
                      <th className="py-2 text-left">Precio</th>
                      <th className="py-2 text-left">Análisis/mes</th>
                      <th className="py-2 text-left">Cuentas</th>
                      <th className="py-2 text-left">Trial</th>
                      <th className="py-2 text-left"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLANS.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-b border-input/50 ${
                          selectedPlan === p.id ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="py-3 font-medium capitalize">{p.id}</td>
                        <td className="py-3">€{p.price}/mes</td>
                        <td className="py-3">{p.analysis.toLocaleString()}</td>
                        <td className="py-3">{p.accounts}</td>
                        <td className="py-3">{p.trial ? `${p.trial} días` : "—"}</td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlan(p.id);
                              setStep(2);
                            }}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            Elegir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-sm text-muted-foreground underline"
              >
                Atrás
              </button>
            </div>
          )}

          {currentStepId === "payment" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Pago</h2>
              <p className="text-muted-foreground">
                Plan <span className="font-medium capitalize">{selectedPlan}</span>. Serás redirigido a Polar para completar el pago.
              </p>
              {checkoutError && (
                <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {checkoutError}
                </div>
              )}
              <button
                type="button"
                disabled={checkoutLoading || !session}
                onClick={async () => {
                  if (!session?.access_token) {
                    setCheckoutError("Debes iniciar sesión para continuar.");
                    return;
                  }
                  setCheckoutLoading(true);
                  setCheckoutError(null);
                  try {
                    const { url } = await apiFetch<{ url: string }>("/billing/checkout", {
                      method: "POST",
                      token: session.access_token,
                      body: JSON.stringify({ plan: selectedPlan }),
                    });
                    if (url) window.location.href = url;
                    else setCheckoutError("No se pudo crear el checkout. Configura Polar.");
                  } catch (e) {
                    setCheckoutError(e instanceof Error ? e.message : "Error al crear checkout");
                  } finally {
                    setCheckoutLoading(false);
                  }
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {checkoutLoading ? "Redirigiendo..." : "Ir a Polar checkout"}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-4 text-sm text-muted-foreground underline"
              >
                Cambiar plan
              </button>
            </div>
          )}

          {currentStepId === "persona_setup" && token && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Configura tu Roastr Persona</h2>
              <p className="text-muted-foreground">
                Define identidades, líneas rojas y tolerancias para que Shield y los roasts se ajusten a ti.
              </p>
              <PersonaForm token={token} onSaved={() => setStep(4)} submitLabel="Continuar" />
            </div>
          )}

          {currentStepId === "connect_accounts" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Conecta tus cuentas</h2>
              <p className="text-muted-foreground">
                Conecta YouTube y X para proteger tus comentarios y menciones.
              </p>
              {connectError && (
                <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {connectError}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate("/connect?from=onboarding")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Conectar cuentas
              </button>
              <button
                type="button"
                onClick={() => finishOnboarding()}
                className="ml-4 text-sm text-muted-foreground underline"
              >
                Saltar por ahora
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
