import { membershipConfig, loadMembership } from "./membership";
/** Authentication is owned by the server; browser code never fabricates a session. */
export const authService = {
  configured: Boolean(membershipConfig.apiUrl),
  getSession: loadMembership,
  async signIn(): Promise<{ ready: boolean; url?: string; message: string }> {
    if (!membershipConfig.apiUrl)
      return {
        ready: false,
        message:
          "Account sign-in is not connected yet. Your local guest library remains available.",
      };
    try {
      const response = await fetch(`${membershipConfig.apiUrl}/auth/signin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: location.origin + location.pathname + "#/my-world" }),
      });
      if (!response.ok) throw new Error("Sign-in is unavailable.");
      const data = (await response.json()) as { url?: string };
      if (!data.url?.startsWith("https://"))
        throw new Error("Invalid sign-in response.");
      return {
        ready: true,
        url: data.url,
        message: "Continue to the configured identity provider.",
      };
    } catch {
      return {
        ready: false,
        message: "Sign-in could not be started. Please try again later.",
      };
    }
  },
};
