import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import type { FeatureFlagName } from "@roastr/shared";

type FeatureFlagResult = {
  enabled: boolean;
  loading: boolean;
};

const FLAG_CACHE_TTL = 5 * 60 * 1000;

const flagCache = new Map<string, { value: boolean; timestamp: number }>();

function getCached(flagName: string): boolean | null {
  const entry = flagCache.get(flagName);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > FLAG_CACHE_TTL) {
    flagCache.delete(flagName);
    return null;
  }
  return entry.value;
}

export function useFeatureFlag(flagName: FeatureFlagName): FeatureFlagResult {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCached(flagName);
    if (cached !== null) {
      setEnabled(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setEnabled(false);

    async function fetchFlag() {
      try {
        const data = await apiFetch<{ enabled: boolean }>(
          `/feature-flags/${flagName}`,
        );

        flagCache.set(flagName, {
          value: data.enabled,
          timestamp: Date.now(),
        });

        if (!cancelled) {
          setEnabled(data.enabled);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setEnabled(false);
          setLoading(false);
        }
      }
    }

    fetchFlag();
    return () => {
      cancelled = true;
    };
  }, [flagName]);

  return { enabled, loading };
}
