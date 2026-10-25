import { membershipConfig, loadMembership, beginSignIn } from "./membership";

/** Authentication is owned by the server; browser code never fabricates a session. */
export const authService = Object.freeze({
  configured: Boolean(membershipConfig.apiUrl),
  getSession: loadMembership,
  signIn: beginSignIn,
});
