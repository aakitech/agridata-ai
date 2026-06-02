import { env } from "~/env";

export const posthogConfig = {
  key: env.NEXT_PUBLIC_POSTHOG_KEY,
  host: env.NEXT_PUBLIC_POSTHOG_HOST,
  replayEnabled: env.NEXT_PUBLIC_POSTHOG_REPLAY_ENABLED,
  environment: env.NODE_ENV,
};

export function isPostHogClientEnabled() {
  return Boolean(posthogConfig.key);
}
