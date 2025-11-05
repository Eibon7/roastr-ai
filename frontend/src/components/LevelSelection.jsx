/**
 * LevelSelection Component
 * Issue #597 - Level Configuration (Roast Levels 1-5 + Shield Levels)
 *
 * Allows users to configure roast intensity and shield strictness levels
 * with plan-based restrictions and upgrade prompts
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { InfoTooltip } from './ui/InfoTooltip';
import {
  Flame,
  Shield,
  Lock,
  Sparkles,
  AlertCircle,
  Crown,
  Zap,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import axios from 'axios';

const LevelSelection = ({ platform = 'twitter' }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentConfig, setCurrentConfig] = useState({
    roast_level: 3,
    shield_level: 3
  });
  const [availableLevels, setAvailableLevels] = useState(null);
  const [levelDefinitions, setLevelDefinitions] = useState(null);

  useEffect(() => {
    if (user) {
      loadConfiguration();
      loadAvailableLevels();
      loadLevelDefinitions();
    }
  }, [user, platform]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/config/${platform}`);

      if (response.data.success) {
        const config = response.data.data;
        setCurrentConfig({
          roast_level: config.roast_level || 3,
          shield_level: config.shield_level || 3
        });
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load level configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableLevels = async () => {
    try {
      const response = await axios.get('/api/config/levels/available');
      if (response.data.success) {
        setAvailableLevels(response.data.data);
      }
    } catch (error) {
      console.error('Error loading available levels:', error);
    }
  };

  const loadLevelDefinitions = async () => {
    try {
      const response = await axios.get('/api/config/levels/definitions');
      if (response.data.success) {
        setLevelDefinitions(response.data.data);
      }
    } catch (error) {
      console.error('Error loading level definitions:', error);
    }
  };

  const handleRoastLevelChange = async (level) => {
    // Check if level is allowed
    if (availableLevels && level > availableLevels.roast.maxLevel) {
      toast({
        title: 'Upgrade Required',
        description: `Roast level ${level} requires ${getRequiredPlan(level)} plan or higher`,
        variant: 'default'
      });
      return;
    }

    await updateLevel('roast_level', level);
  };

  const handleShieldLevelChange = async (level) => {
    // Check if level is allowed
    if (availableLevels && level > availableLevels.shield.maxLevel) {
      toast({
        title: 'Upgrade Required',
        description: `Shield level ${level} requires ${getRequiredPlan(level)} plan or higher`,
        variant: 'default'
      });
      return;
    }

    await updateLevel('shield_level', level);
  };

  const updateLevel = async (field, value) => {
    try {
      setSaving(true);

      const updateData = {
        [field]: value
      };

      const response = await axios.put(`/api/config/${platform}`, updateData);

      if (response.data.success) {
        setCurrentConfig(prev => ({
          ...prev,
          [field]: value
        }));

        toast({
          title: 'Level Updated',
          description: `${field === 'roast_level' ? 'Roast' : 'Shield'} level set to ${value}`,
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Error updating level:', error);

      const errorMessage = error.response?.data?.error || 'Failed to update level';
      const reason = error.response?.data?.reason;

      if (reason && reason.includes('exceeds_plan')) {
        const currentPlan = error.response?.data?.currentPlan || 'current';
        toast({
          title: 'Upgrade Required',
          description: `This level requires a higher plan. Current plan: ${currentPlan}`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const getRequiredPlan = (level) => {
    if (level <= 3) return 'Starter';
    if (level === 4) return 'Pro';
    return 'Plus';
  };

  const isLevelLocked = (level, type) => {
    if (!availableLevels) return false;
    const maxLevel = type === 'roast' ? availableLevels.roast.maxLevel : availableLevels.shield.maxLevel;
    return level > maxLevel;
  };

  const getLevelIcon = (level) => {
    if (level === 1) return <Sparkles className="h-4 w-4" />;
    if (level === 2) return <Zap className="h-4 w-4" />;
    if (level === 3) return <Flame className="h-4 w-4" />;
    if (level === 4) return <Crown className="h-4 w-4" />;
    return <Flame className="h-4 w-4 text-orange-500" />;
  };

  if (loading || !levelDefinitions || !availableLevels) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Level Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Roast Levels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5" />
                Roast Intensity Level
              </CardTitle>
              <CardDescription>
                Control the intensity of generated roasts (1=Mild to 5=Caustic)
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Current: Level {currentConfig.roast_level}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((level) => {
              const definition = levelDefinitions.roast[level];
              const locked = isLevelLocked(level, 'roast');
              const active = currentConfig.roast_level === level;

              return (
                <button
                  key={level}
                  onClick={() => !locked && handleRoastLevelChange(level)}
                  disabled={saving || locked}
                  className={`
                    relative p-4 border-2 rounded-lg text-left transition-all
                    ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                    ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${saving ? 'cursor-wait' : ''}
                  `}
                >
                  {locked && (
                    <div className="absolute top-2 right-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    {getLevelIcon(level)}
                    <span className="font-bold text-lg">{level}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{definition.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {definition.description}
                    </div>
                  </div>
                  {locked && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {getRequiredPlan(level)}+
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Current Roast Level Details */}
          <Alert>
            <Flame className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  {levelDefinitions.roast[currentConfig.roast_level].name} Mode
                </p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Temperature: {levelDefinitions.roast[currentConfig.roast_level].temperature}</p>
                  <p>• Profanity: {levelDefinitions.roast[currentConfig.roast_level].allowProfanity ? 'Allowed' : 'Not allowed'}</p>
                  <p>• Max length: {levelDefinitions.roast[currentConfig.roast_level].maxLength} characters</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Shield Levels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Shield Protection Level
              </CardTitle>
              <CardDescription>
                Control toxicity blocking threshold (1=Tolerant to 5=Strict)
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Current: Level {currentConfig.shield_level}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((level) => {
              const definition = levelDefinitions.shield[level];
              const locked = isLevelLocked(level, 'shield');
              const active = currentConfig.shield_level === level;

              return (
                <button
                  key={level}
                  onClick={() => !locked && handleShieldLevelChange(level)}
                  disabled={saving || locked}
                  className={`
                    relative p-4 border-2 rounded-lg text-left transition-all
                    ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                    ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${saving ? 'cursor-wait' : ''}
                  `}
                >
                  {locked && (
                    <div className="absolute top-2 right-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-bold text-lg">{level}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{definition.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {definition.description}
                    </div>
                  </div>
                  {locked && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {getRequiredPlan(level)}+
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Current Shield Level Details */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  {levelDefinitions.shield[currentConfig.shield_level].name} Protection
                </p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Toxicity threshold: {levelDefinitions.shield[currentConfig.shield_level].threshold}</p>
                  <p>• Auto-actions: {levelDefinitions.shield[currentConfig.shield_level].autoActions ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Plan Information */}
      {availableLevels && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Your Plan: {availableLevels.plan.toUpperCase()}</p>
              <p className="text-sm text-muted-foreground">
                You have access to levels 1-{availableLevels.roast.maxLevel} for both roast and shield.
                {availableLevels.roast.maxLevel < 5 && (
                  <span> Upgrade to access higher levels with more control.</span>
                )}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default LevelSelection;
