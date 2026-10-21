import { useSyncExternalStore } from "react";
import type { Video } from "../data/catalogue";

export type MembershipStatus =
  | "signed-out"
  | "free"
  | "premium"
  | "expired"
  | "cancelled"
  | "loading"
  | "error"
  | "setup-pending";
export type Membership = {
  status: MembershipStatus;
  configured: boolean;
  preview: boolean;
  account: { id: string; name?: string } | null;
  message: string;
};
export type Entitlement = {
  allowed: boolean;
  canWatch: boolean;
  reason: string;
  preview: boolean;
};

/** Public endpoint only. Secrets, prices, sessions and entitlements belong on the server. */
export const membershipConfig = Object.freeze({
  apiUrl: (import.meta.env.VITE_MEMBERSHIP_API_URL || "").replace(/\/$/, ""),
  pricingApproved: false,
  price: null,
  currency: null,
  checkoutEnabled: Boolean(import.meta.env.VITE_MEMBERSHIP_API_URL),
  developmentPreview: import.meta.env.DEV,
});
const configured = Boolean(membershipConfig.apiUrl);
const listeners = new Set<() => void>();
let current: Membership = {
  status: configured ? "signed-out" : "setup-pending",
  configured,
  preview: false,
  account: null,
  message: configured
    ? "Sign in through the configured membership provider."
    : "Membership is being prepared. Free preview films are available now.",
};

function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getMembership(): Membership {
  return current;
}
export function useMembership(): Membership {
  return useSyncExternalStore(subscribe, getMembership, getMembership);
}

/** Use only in a visibly labelled local developer control; never persists or grants server access. */
export function setMembershipPreview(
  status: MembershipStatus | null,
): Membership {
  if (!import.meta.env.DEV) return current;
  current =
    status === null
      ? {
          status: configured ? "signed-out" : "setup-pending",
          configured,
          preview: false,
          account: null,
          message: "Membership setup is pending.",
        }
      : {
          status,
          configured: false,
          preview: true,
          account: null,
          message: `Development preview: ${status}. No payment or account has been created.`,
        };
  emit();
  return current;
}

export function resolveEntitlement(
  video: Pick<Video, "access" | "status">,
): Entitlement {
  if (video.status !== "available")
    return {
      allowed: false,
      canWatch: false,
      reason:
        "This original is in development. An episode has not been released.",
      preview: false,
    };
  if (video.access === "free")
    return {
      allowed: true,
      canWatch: true,
      reason: "Free preview viewing",
      preview: false,
    };
  const allowed =
    current.status === "premium" &&
    (current.configured || (import.meta.env.DEV && current.preview));
  return {
    allowed,
    canWatch: allowed,
    preview: current.preview,
    reason: allowed
      ? current.preview
        ? "Development preview. Demonstration media only."
        : "Premium membership; playback authorization required."
      : current.status === "loading"
        ? "Checking your membership…"
        : current.status === "expired"
          ? "Your membership has expired."
          : current.status === "cancelled"
            ? "Your membership is cancelled."
            : current.status === "error"
              ? "Membership could not be checked. Please try again."
              : "Premium viewing will open when membership is available.",
  };
}

export async function loadMembership(): Promise<Membership> {
  if (!configured) return current;
  current = {
    ...current,
    status: "loading",
    preview: false,
    message: "Checking membership…",
  };
  emit();
  try {
    const response = await fetch(`${membershipConfig.apiUrl}/session`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Membership service unavailable.");
    const data = (await response.json()) as {
      status?: MembershipStatus;
      account?: Membership["account"];
    };
    const accepted: MembershipStatus[] = [
      "signed-out",
      "free",
      "premium",
      "expired",
      "cancelled",
    ];
    if (!data.status || !accepted.includes(data.status))
      throw new Error("Invalid membership response.");
    current = {
      status: data.status,
      account: data.account || null,
      configured: true,
      preview: false,
      message:
        data.status === "premium"
          ? "Premium membership active."
          : "Membership checked.",
    };
  } catch {
    current = {
      ...current,
      status: "error",
      message:
        "Membership is temporarily unavailable. Free viewing still works.",
    };
  }
  emit();
  return current;
}

/** Premium source URLs are requested from the server, never trusted from browser membership state. */
export async function requestPlayback(video: Video): Promise<string> {
  const entitlement = resolveEntitlement(video);
  if (!entitlement.allowed) throw new Error(entitlement.reason);
  if (video.access === "free" || (import.meta.env.DEV && current.preview)) {
    if (!video.src)
      throw new Error("This film does not yet have a playable source.");
    return video.src;
  }
  if (!configured) throw new Error("Membership playback setup is pending.");
  const response = await fetch(
    `${membershipConfig.apiUrl}/playback/${encodeURIComponent(video.id)}`,
    { credentials: "include", headers: { Accept: "application/json" } },
  );
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "Your membership does not include this programme."
        : "Playback authorization could not be completed.",
    );
  const data = (await response.json()) as { url?: string };
  if (!data.url || !/^https:\/\//.test(data.url))
    throw new Error("The playback service returned an invalid source.");
  return data.url;
}

export async function beginCheckout(): Promise<{
  status: "setup-pending" | "ready" | "error";
  url?: string;
  message: string;
}> {
  if (!configured)
    return {
      status: "setup-pending",
      message:
        "Membership is being prepared. Pricing and checkout will appear here when confirmed.",
    };
  try {
    const response = await fetch(`${membershipConfig.apiUrl}/checkout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returnUrl: window.location.origin + window.location.pathname + "#/premium",
      }),
    });
    if (!response.ok) throw new Error("Checkout unavailable.");
    const data = (await response.json()) as { url?: string };
    if (!data.url || !/^https:\/\//.test(data.url))
      throw new Error("Invalid checkout response.");
    return {
      status: "ready",
      url: data.url,
      message: "Continue to secure hosted checkout.",
    };
  } catch {
    return {
      status: "error",
      message: "Checkout could not be opened. No payment was taken.",
    };
  }
}
