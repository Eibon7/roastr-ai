import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Check, Crown, Zap, Star } from 'lucide-react';
import { createMockFetch } from '../lib/mockMode';

const PLAN_ICONS = {
  free: <Zap className="h-6 w-6" />,
  pro: <Star className="h-6 w-6" />,
  creator_plus: <Crown className="h-6 w-6" />
};

const PLAN_COLORS = {
  free: 'text-green-600',
  pro: 'text-blue-600', 
  creator_plus: 'text-purple-600'
};

export default function PlanPicker() {
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const navigate = useNavigate();

  const fetchApi = createMockFetch();

  useEffect(() => {
    fetchPlansData();
    fetchCurrentPlan();
  }, []);

  const fetchPlansData = async () => {
    try {
      const response = await fetchApi('/api/plan/available');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.data?.plans || []);
      } else {
        setPlans([]);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      setPlans([]);
    }
  };

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetchApi('/api/plan/current');
      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.data.plan);
      }
    } catch (error) {
      console.error('Failed to fetch current plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId) => {
    setSelecting(planId);

    try {
      const response = await fetchApi('/api/plan/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: planId })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(planId);
        
        // Navigate to integrations page after successful plan selection
        setTimeout(() => {
          navigate('/integrations/connect');
        }, 1000);
        
        console.log('Plan selected:', data.data.message);
      } else {
        const error = await response.json();
        console.error('Failed to select plan:', error.error);
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
    } finally {
      setSelecting(null);
    }
  };

  const formatPrice = (price) => {
    return price === 0 ? 'Free' : `$${price}/month`;
  };

  const getPlanBadge = (planId) => {
    if (planId === currentPlan) {
      return <Badge variant="secondary">Current Plan</Badge>;
    }
    if (planId === 'creator_plus') {
      return <Badge className="bg-purple-100 text-purple-800">Recommended</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground text-lg">
          Select the plan that best fits your roasting needs
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans && plans.length > 0 ? (
          plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const isCreatorPlus = plan.id === 'creator_plus';
            
            return (
              <Card 
                key={plan.id} 
                className={`relative ${isCreatorPlus ? 'border-purple-200 shadow-lg' : ''} ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {isCreatorPlus && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-600 text-white">Most Popular</Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto mb-2 ${PLAN_COLORS[plan.id]}`}>
                    {PLAN_ICONS[plan.id]}
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold mt-2">
                    {formatPrice(plan.price)}
                  </div>
                  {getPlanBadge(plan.id)}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Features List */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        {plan.features.roastsPerMonth.toLocaleString()} roasts/month
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        {plan.features.platformConnections} platform connections
                      </span>
                    </div>
                    
                    {plan.features.styleProfile && (
                      <div className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-purple-600">
                          AI Style Profile Generation
                        </span>
                      </div>
                    )}
                    
                    {plan.features.customPrompts && (
                      <div className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Custom roast prompts</span>
                      </div>
                    )}
                    
                    {plan.features.prioritySupport && (
                      <div className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Priority support</span>
                      </div>
                    )}
                    
                    {plan.features.advancedAnalytics && (
                      <div className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Advanced analytics</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-4">
                    <Button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isCurrentPlan || selecting === plan.id}
                      className={`w-full ${isCreatorPlus ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                      variant={isCurrentPlan ? 'outline' : 'default'}
                    >
                      {selecting === plan.id ? (
                        'Selecting...'
                      ) : isCurrentPlan ? (
                        'Current Plan'
                      ) : (
                        `Select ${plan.name}`
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-3 text-center py-8">
            <p className="text-muted-foreground">No plans available at the moment.</p>
          </div>
        )}
      </div>

      {/* Style Profile Feature Highlight */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Crown className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">AI Style Profile Generation</h3>
              <p className="text-muted-foreground mb-4">
                Only available with Creator+ plan. Generate personalized roast styles based on your social media content across multiple platforms and languages.
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  <span>Analyze up to 300 posts per platform</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  <span>Multi-language support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  <span>Personalized tone detection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-purple-500" />
                  <span>Custom roast examples</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      {currentPlan && plans && plans.length > 0 && (
        <div className="text-center mt-8">
          <p className="text-muted-foreground mb-4">
            Great! You've selected the <strong>{plans.find(p => p.id === currentPlan)?.name || currentPlan}</strong> plan.
          </p>
          <Button onClick={() => navigate('/integrations/connect')} size="lg">
            Continue to Platform Connections
          </Button>
        </div>
      )}
    </div>
  );
}