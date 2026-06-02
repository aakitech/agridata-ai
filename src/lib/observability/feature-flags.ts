import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { trackEvent } from "./analytics";
import { isPostHogClientEnabled } from "./config";
import {
  analyticsEvents,
  type FeatureFlagKey,
  type ObservabilityProperties,
  sanitizeEventProperties,
} from "./events";

export function buildFeatureFlagEventProperties(
  flagKey: FeatureFlagKey,
  enabled: boolean,
  context: ObservabilityProperties = {},
) {
  return sanitizeEventProperties({
    ...context,
    feature: flagKey,
    enabled,
  });
}

/**
 * Pure flag read with no tracking side effect. Returns `false` until PostHog has
 * bootstrapped its flags (or when PostHog is disabled).
 */
export function evaluateFeatureFlag(flagKey: FeatureFlagKey) {
  return isPostHogClientEnabled()
    ? posthog.isFeatureEnabled(flagKey) === true
    : false;
}

/**
 * One-shot evaluation + tracking. Note that on the client this can return a
 * stale `false` if called before flags have loaded — prefer `useFeatureFlag`
 * in React components.
 */
export function isFeatureEnabled(
  flagKey: FeatureFlagKey,
  context: ObservabilityProperties = {},
) {
  const enabled = evaluateFeatureFlag(flagKey);

  trackEvent(
    analyticsEvents.featureFlagEvaluated,
    buildFeatureFlagEventProperties(flagKey, enabled, context),
  );

  return enabled;
}

/**
 * React hook that re-evaluates the flag once PostHog finishes loading flags, so
 * gated UI updates instead of being stuck on the pre-bootstrap default. The
 * `feature_flag_evaluated` event is tracked once per mount, after flags resolve.
 */
export function useFeatureFlag(
  flagKey: FeatureFlagKey,
  context: ObservabilityProperties = {},
) {
  const [enabled, setEnabled] = useState(() => evaluateFeatureFlag(flagKey));
  const contextKey = JSON.stringify(context);

  useEffect(() => {
    if (!isPostHogClientEnabled()) return;

    let tracked = false;
    const handle = () => {
      const value = evaluateFeatureFlag(flagKey);
      setEnabled(value);
      if (!tracked) {
        tracked = true;
        trackEvent(
          analyticsEvents.featureFlagEvaluated,
          buildFeatureFlagEventProperties(flagKey, value, context),
        );
      }
    };

    // Fires immediately if flags are already cached, and again when they load.
    const unsubscribe = posthog.onFeatureFlags(handle);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagKey, contextKey]);

  return enabled;
}
