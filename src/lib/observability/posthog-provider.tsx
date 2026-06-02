"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { isPostHogClientEnabled, posthogConfig } from "./config";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isPostHogClientEnabled()) return;

    posthog.init(posthogConfig.key!, {
      api_host: posthogConfig.host,
      person_profiles: "identified_only",
      capture_pageview: false,
      disable_session_recording: !posthogConfig.replayEnabled,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
      },
    });
  }, []);

  return children;
}
