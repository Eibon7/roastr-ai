import * as React from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { adminApi } from '@/lib/api';

interface PlanLimits {
  plan_id: string;
  plan_name: string;
  max_roasts: number;
  monthly_responses_limit: number;
  monthly_analysis_limit: number;
  max_platforms: number;
  shield_enabled: boolean;
  custom_prompts: boolean;
  priority_support: boolean;
  api_access: boolean;
  analytics_enabled: boolean;
  custom_tones: boolean;
  dedicated_support: boolean;
  monthly_tokens_limit: number;
  daily_api_calls_limit: number;
}

const PLANS = ['starter_trial', 'starter', 'pro', 'plus'] as const;

export default function PlansPage() {
  const [plans, setPlans] = React.useState<Record<string, PlanLimits>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      // Get plan limits from database
      const limitsResponse = await adminApi.getPlanLimits();

      if (limitsResponse.success && limitsResponse.data) {
        const plansData = limitsResponse.data.plans || [];

        // Transform to our format
        const plansDict: Record<string, PlanLimits> = {};

        plansData.forEach((plan: any) => {
          plansDict[plan.plan_id] = {
            plan_id: plan.plan_id,
            plan_name: plan.plan_name || plan.plan_id,
            max_roasts: plan.maxRoasts || plan.max_roasts || 0,
            monthly_responses_limit:
              plan.monthlyResponsesLimit || plan.monthly_responses_limit || 0,
            monthly_analysis_limit: plan.monthlyAnalysisLimit || plan.monthly_analysis_limit || 0,
            max_platforms: plan.maxPlatforms || plan.max_platforms || 0,
            shield_enabled: plan.shieldEnabled ?? plan.shield_enabled ?? false,
            custom_prompts: plan.customPrompts ?? plan.custom_prompts ?? false,
            priority_support: plan.prioritySupport ?? plan.priority_support ?? false,
            api_access: plan.apiAccess ?? plan.api_access ?? false,
            analytics_enabled: plan.analyticsEnabled ?? plan.analytics_enabled ?? false,
            custom_tones: plan.customTones ?? plan.custom_tones ?? false,
            dedicated_support: plan.dedicatedSupport ?? plan.dedicated_support ?? false,
            monthly_tokens_limit: plan.monthlyTokensLimit || plan.monthly_tokens_limit || 0,
            daily_api_calls_limit: plan.dailyApiCallsLimit || plan.daily_api_calls_limit || 0
          };
        });

        setPlans(plansDict);
      }
    } catch (error: any) {
      console.error('Failed to load plans:', error);
      setPlans({});
    } finally {
      setLoading(false);
    }
  };

  const updatePlan = (planId: string, field: keyof PlanLimits, value: any) => {
    setPlans((prev) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value
      }
    }));
    setHasChanges((prev) => ({ ...prev, [planId]: true }));
  };

  const handleSave = async (planId: string) => {
    if (!plans[planId]) return;

    setSaving((prev) => ({ ...prev, [planId]: true }));
    try {
      const plan = plans[planId];

      // Map to backend format
      const updates: any = {
        maxRoasts: plan.max_roasts,
        monthlyResponsesLimit: plan.monthly_responses_limit,
        monthlyAnalysisLimit: plan.monthly_analysis_limit,
        maxPlatforms: plan.max_platforms,
        shieldEnabled: plan.shield_enabled,
        customPrompts: plan.custom_prompts,
        prioritySupport: plan.priority_support,
        apiAccess: plan.api_access,
        analyticsEnabled: plan.analytics_enabled,
        customTones: plan.custom_tones,
        dedicatedSupport: plan.dedicated_support,
        monthlyTokensLimit: plan.monthly_tokens_limit,
        dailyApiCallsLimit: plan.daily_api_calls_limit
      };

      await adminApi.updatePlanLimits(planId, updates);

      setHasChanges((prev) => ({ ...prev, [planId]: false }));
      // Reload plans to get fresh data
      await loadPlans();
    } catch (error: any) {
      console.error('Failed to save plan:', error);
      alert(error.message || 'Failed to save plan limits');
    } finally {
      setSaving((prev) => ({ ...prev, [planId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración de Planes</h1>
        <p className="text-muted-foreground">Gestiona los planes de suscripción y sus límites</p>
      </div>

      <div className="space-y-6">
        {PLANS.map((planId) => {
          if (!plans[planId]) return null;
          const plan = plans[planId];

          return (
            <Card key={planId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{plan.plan_name}</CardTitle>
                    <CardDescription>Plan ID: {planId}</CardDescription>
                  </div>
                  <Button
                    onClick={() => handleSave(planId)}
                    disabled={!hasChanges[planId] || saving[planId]}
                  >
                    {saving[planId] ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Usage Limits */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Límites de Uso</h3>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`${planId}-roasts`}>Max Roasts Mensuales</Label>
                        <Input
                          id={`${planId}-roasts`}
                          type="number"
                          value={plan.max_roasts}
                          onChange={(e) =>
                            updatePlan(planId, 'max_roasts', parseInt(e.target.value, 10))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`${planId}-responses`}>Límite Respuestas Mensuales</Label>
                        <Input
                          id={`${planId}-responses`}
                          type="number"
                          value={plan.monthly_responses_limit}
                          onChange={(e) =>
                            updatePlan(
                              planId,
                              'monthly_responses_limit',
                              parseInt(e.target.value, 10)
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`${planId}-analysis`}>Límite Análisis Mensuales</Label>
                        <Input
                          id={`${planId}-analysis`}
                          type="number"
                          value={plan.monthly_analysis_limit}
                          onChange={(e) =>
                            updatePlan(
                              planId,
                              'monthly_analysis_limit',
                              parseInt(e.target.value, 10)
                            )
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`${planId}-platforms`}>Max Plataformas</Label>
                        <Input
                          id={`${planId}-platforms`}
                          type="number"
                          value={plan.max_platforms}
                          onChange={(e) =>
                            updatePlan(planId, 'max_platforms', parseInt(e.target.value, 10))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`${planId}-tokens`}>Límite Tokens Mensuales</Label>
                        <Input
                          id={`${planId}-tokens`}
                          type="number"
                          value={plan.monthly_tokens_limit}
                          onChange={(e) =>
                            updatePlan(planId, 'monthly_tokens_limit', parseInt(e.target.value, 10))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`${planId}-api-calls`}>Límite Llamadas API Diarias</Label>
                        <Input
                          id={`${planId}-api-calls`}
                          type="number"
                          value={plan.daily_api_calls_limit}
                          onChange={(e) =>
                            updatePlan(
                              planId,
                              'daily_api_calls_limit',
                              parseInt(e.target.value, 10)
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Features</h3>
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${planId}-shield`}>Shield Habilitado</Label>
                        <Switch
                          id={`${planId}-shield`}
                          checked={plan.shield_enabled}
                          onCheckedChange={(checked) =>
                            updatePlan(planId, 'shield_enabled', checked)
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${planId}-custom-prompts`}>Custom Prompts</Label>
                        <Switch
                          id={`${planId}-custom-prompts`}
                          checked={plan.custom_prompts}
                          onCheckedChange={(checked) =>
                            updatePlan(planId, 'custom_prompts', checked)
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${planId}-priority-support`}>Priority Support</Label>
                        <Switch
                          id={`${planId}-priority-support`}
                          checked={plan.priority_support}
                          onCheckedChange={(checked) =>
                            updatePlan(planId, 'priority_support', checked)
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${planId}-api-access`}>API Access</Label>
                        <Switch
                          id={`${planId}-api-access`}
                          checked={plan.api_access}
                          onCheckedChange={(checked) => updatePlan(planId, 'api_access', checked)}
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${planId}-analytics`}>Analytics</Label>
                        <Switch
                          id={`${planId}-analytics`}
                          checked={plan.analytics_enabled}
                          onCheckedChange={(checked) =>
                            updatePlan(planId, 'analytics_enabled', checked)
                          }
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${planId}-custom-tones`}>Custom Tones</Label>
                        <Switch
                          id={`${planId}-custom-tones`}
                          checked={plan.custom_tones}
                          onCheckedChange={(checked) => updatePlan(planId, 'custom_tones', checked)}
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`${planId}-dedicated-support`}>Dedicated Support</Label>
                        <Switch
                          id={`${planId}-dedicated-support`}
                          checked={plan.dedicated_support}
                          onCheckedChange={(checked) =>
                            updatePlan(planId, 'dedicated_support', checked)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
