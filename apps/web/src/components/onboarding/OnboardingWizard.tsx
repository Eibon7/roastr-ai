import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

const STEPS = [
  { id: "welcome", label: "Bienvenida" },
  { id: "select_plan", label: "Elige plan" },
  { id: "payment", label: "Pago" },
  { id: "persona_setup", label: "Persona" },
  { id: "connect_accounts", label: "Conectar cuentas" },
] as const;

type Plan = "starter" | "pro" | "plus";

const PLANS: { id: Plan; price: number; analysis: number; accounts: number; trial: number | null }[] = [
  { id: "starter", price: 5, analysis: 1000, accounts: 1, trial: 30 },
  { id: "pro", price: 15, analysis: 10000, accounts: 2, trial: 7 },
  { id: "plus", price: 50, analysis: 100000, accounts: 2, trial: null },
];

export function OnboardingWizard() {
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("starter");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const idx = STEPS.findIndex((s) => s.id === stepParam);
    if (idx >= 0) setStep(idx);
  }, [searchParams]);

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
                onClick={() => setStep(i)}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
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

          {currentStepId === "persona_setup" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Configura tu persona</h2>
              <p className="text-muted-foreground">
                Define identidades, líneas rojas y tolerancias (próximamente).
              </p>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continuar
              </button>
            </div>
          )}

          {currentStepId === "connect_accounts" && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Conecta tus cuentas</h2>
              <p className="text-muted-foreground">
                YouTube y X (próximamente).
              </p>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Ir al dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
