import { useSyncExternalStore } from "react";
import type { Video } from "../data/catalogue";
import {
  buildReturnUrl, createApiClient, readHostedUrl, serviceError, ServiceError,
  type ApiClientOptions,
} from "../platform/http";

export type MembershipStatus = "signed-out" | "free" | "premium" | "expired" | "cancelled" | "loading" | "error" | "setup-pending";
export type Membership = {
  status: MembershipStatus;
  configured: boolean;
  preview: boolean;
  account: { id: string; name?: string } | null;
  message: string;
};
export type Entitlement = { allowed: boolean; canWatch: boolean; reason: string; preview: boolean };
type Session = Pick<Membership, "status" | "account">;
type CheckoutResult = { status: "setup-pending" | "ready" | "error"; url?: string; message: string };
type SignInResult = { ready: boolean; url?: string; message: string };
type MembershipOptions = ApiClientOptions & { baseUrl?: string; origin?: () => string };

/** Validate the public session DTO; browser-supplied flags are never an entitlement. */
export function readSession(data: unknown): Session {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ServiceError("invalid-response");
  const record = data as Record<string, unknown>;
  if (typeof record.status !== "string" || !["signed-out", "free", "premium", "expired", "cancelled"].includes(record.status))
    throw new ServiceError("invalid-response");
  if (record.status === "signed-out") {
    if (record.account != null) throw new ServiceError("invalid-response");
    return { status: "signed-out", account: null };
  }
  if (!record.account || typeof record.account !== "object" || Array.isArray(record.account))
    throw new ServiceError("invalid-response");
  const account = record.account as Record<string, unknown>;
  if (typeof account.id !== "string" || !account.id.trim() || account.id.length > 200 ||
    (account.name !== undefined && (typeof account.name !== "string" || account.name.length > 200)))
    throw new ServiceError("invalid-response");
  return {
    status: record.status as MembershipStatus,
    account: { id: account.id, ...(account.name === undefined ? {} : { name: account.name as string }) },
  };
}

/** Injectable boundary keeps provider behaviour testable without a browser or live account. */
export function createMembershipService(options: MembershipOptions = {}) {
  const api = createApiClient(options);
  const listeners = new Set<() => void>();
  const initial = (): Membership => ({
    status: api.configured ? "signed-out" : "setup-pending",
    configured: api.configured, preview: false, account: null,
    message: api.configurationError ? "Membership configuration needs attention. Free preview films remain available."
      : api.configured ? "Sign in through the configured membership provider."
        : "Membership is being prepared. Free preview films are available now.",
  });
  let current = initial();
  let sessionRevision = 0;
  let sessionRequest: AbortController | undefined;
  const emit = () => { for (const listener of listeners) listener(); };
  const getMembership = () => current;
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const invalidateSession = () => { sessionRevision++; sessionRequest?.abort(); sessionRequest = undefined; };
  const expireSession = () => {
    invalidateSession();
    current = { ...initial(), status: "signed-out", message: "Your session has ended. Please sign in again." };
    emit();
  };
  const handleServiceError = (error: unknown, expectedRevision: number) => {
    const normalized = serviceError(error);
    if (normalized.code === "unauthorized" && expectedRevision === sessionRevision) expireSession();
    return normalized;
  };
  const returnUrl = (route: "/my-world" | "/premium") =>
    buildReturnUrl(options.origin?.() ?? globalThis.location.origin, options.baseUrl ?? "/", route);

  function setMembershipPreview(status: MembershipStatus | null): Membership {
    if (!options.development) return current;
    invalidateSession();
    current = status === null ? initial() : {
      status, configured: false, preview: true, account: null,
      message: `Development preview: ${status}. No payment, account or playback authorization has been created.`,
    };
    emit();
    return current;
  }

  function resolveEntitlement(video: Pick<Video, "access" | "status">): Entitlement {
    if (video.status !== "available") return { allowed: false, canWatch: false, preview: false,
      reason: "This original is in development. An episode has not been released." };
    if (video.access === "free") return { allowed: true, canWatch: true, preview: false, reason: "Free preview viewing" };
    // Even this display decision cannot supply media: requestPlayback always checks the server.
    const allowed = current.status === "premium" && current.configured && !current.preview && Boolean(current.account);
    return {
      allowed, canWatch: allowed, preview: current.preview,
      reason: allowed ? "Premium membership; playback authorization required."
        : current.preview ? "Development preview only. A server-authorized account is required for premium playback."
          : current.status === "loading" ? "Checking your membership…"
            : current.status === "expired" ? "Your membership has expired."
              : current.status === "cancelled" ? "Your membership is cancelled."
                : current.status === "error" ? "Membership could not be checked. Please try again."
                  : "Premium viewing will open when membership is available.",
    };
  }

  async function loadMembership(signal?: AbortSignal): Promise<Membership> {
    if (!api.configured) return current;
    invalidateSession();
    const revision = sessionRevision;
    const controller = new AbortController();
    sessionRequest = controller;
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", cancel, { once: true });
    current = { ...initial(), status: "loading", message: "Checking membership…" };
    emit();
    try {
      const data = await api.request("/session", readSession, { signal: controller.signal });
      if (revision !== sessionRevision) return current;
      current = { ...data, configured: true, preview: false,
        message: data.status === "premium" ? "Premium membership active." : "Membership checked." };
    } catch (error) {
      if (revision !== sessionRevision) return current;
      const normalized = serviceError(error);
      current = { ...initial(), status: normalized.code === "unauthorized" || normalized.code === "aborted" ? "signed-out" : "error",
        message: normalized.code === "unauthorized" ? "Your session has ended. Please sign in again."
          : normalized.code === "aborted" ? "Membership check cancelled. Free viewing still works."
            : "Membership is temporarily unavailable. Free viewing still works." };
    } finally {
      signal?.removeEventListener("abort", cancel);
      if (revision === sessionRevision) sessionRequest = undefined;
    }
    emit();
    return current;
  }

  async function requestPlayback(video: Video, signal?: AbortSignal): Promise<string> {
    const entitlement = resolveEntitlement(video);
    if (!entitlement.allowed) throw new Error(entitlement.reason);
    if (video.access === "free") {
      if (!video.src) throw new Error("This film does not yet have a playable source.");
      return video.src;
    }
    const revision = sessionRevision;
    try {
      const url = await api.request(`/playback/${encodeURIComponent(video.id)}`,
        (data) => readHostedUrl(data, options.development), { signal });
      if (revision !== sessionRevision) throw new ServiceError("aborted");
      if (!resolveEntitlement(video).allowed) throw new ServiceError("unauthorized");
      return url;
    } catch (error) { throw handleServiceError(error, revision); }
  }

  async function beginCheckout(signal?: AbortSignal): Promise<CheckoutResult> {
    if (!api.configured) return { status: "setup-pending",
      message: "Membership is being prepared. Pricing and checkout will appear here when confirmed." };
    const revision = sessionRevision;
    try {
      const url = await api.request("/checkout", (data) => readHostedUrl(data, options.development), {
        method: "POST", body: { returnUrl: returnUrl("/premium") }, signal,
      });
      if (revision !== sessionRevision) throw new ServiceError("aborted");
      return { status: "ready", url, message: "Continue to secure hosted checkout." };
    } catch (error) {
      const normalized = handleServiceError(error, revision);
      return { status: "error", message: normalized.code === "unauthorized" ? normalized.message
        : "Checkout could not be opened. Please try again later." };
    }
  }

  async function signIn(signal?: AbortSignal): Promise<SignInResult> {
    if (!api.configured) return { ready: false,
      message: "Account sign-in is not connected yet. Your local guest library remains available." };
    const revision = sessionRevision;
    try {
      const url = await api.request("/auth/signin", (data) => readHostedUrl(data, options.development), {
        method: "POST", body: { returnUrl: returnUrl("/my-world") }, signal,
      });
      if (revision !== sessionRevision) throw new ServiceError("aborted");
      return { ready: true, url, message: "Continue to the configured identity provider." };
    } catch (error) {
      handleServiceError(error, revision);
      return { ready: false, message: "Sign-in could not be started. Please try again later." };
    }
  }

  return { apiUrl: api.apiUrl, configured: api.configured, getMembership, subscribe, setMembershipPreview,
    resolveEntitlement, loadMembership, requestPlayback, beginCheckout, signIn };
}

// No browser globals are touched until an actual sign-in/checkout action.
const environment = import.meta.env ?? {};
const membership = createMembershipService({
  apiUrl: environment.VITE_MEMBERSHIP_API_URL,
  development: environment.DEV === true,
  baseUrl: environment.BASE_URL || "/",
});
export const membershipConfig = Object.freeze({
  apiUrl: membership.apiUrl, pricingApproved: false, price: null, currency: null,
  checkoutEnabled: membership.configured, developmentPreview: environment.DEV === true,
});
export const { getMembership, setMembershipPreview, resolveEntitlement, loadMembership, requestPlayback, beginCheckout } = membership;
export const beginSignIn = membership.signIn;
export function useMembership(): Membership {
  return useSyncExternalStore(membership.subscribe, getMembership, getMembership);
}
