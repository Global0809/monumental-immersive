# Service boundaries and production activation

No payment or identity secrets were available. This build therefore keeps browsing and free viewing open, local guest data explicit, and premium purchasing unavailable.

## Server API contract

Set the public API origin in `VITE_MEMBERSHIP_API_URL` only after implementing the server. The existing browser adapters use credentials-included requests. For a separate origin, configure exact-origin CORS, HTTPS and secure session cookies. Protect state-changing endpoints against CSRF.

- `GET /session`: `{status: 'signed-out'|'free'|'premium'|'expired'|'cancelled', account: null|{id,name?}}`. Signed-out has no account. Every authenticated status requires a nonempty account ID. Derive both from a server-owned session and subscription record.
- `POST /auth/signin`: accepts `{returnUrl}`; returns `{url}` for the configured identity provider. Allowlist return origins server-side. The adapter returns a setup-pending result if not configured.
- `POST /checkout`: accepts `{returnUrl}`; returns `{url}` for a provider-hosted checkout. Require approved product IDs/prices on the server. Begin with the provider's test environment. The return page is not proof of payment.
- `GET /playback/:videoId`: verifies the session, current subscription and title entitlement, then returns a short-lived HTTPS signed playback URL. Deny absent, expired, cancelled, error or insufficient entitlements even if the client requests a premium source directly.

The browser can display subscription state, but the playback server is the authority. It must not trust a `premium` field supplied by the browser. The development-state override is gated by Vite DEV and never authorizes premium playback, including locally. Premium sources always require a configured, server-authorized account and playback response.

The shared transport validates endpoint and response URLs, bounds requests to ten seconds by default, supports cancellation and clears expired sessions. An older session or playback response cannot overwrite a newer account state. JSON API redirects are rejected; identity/checkout endpoints return a validated hosted URL instead. Mutation retries are not automatic. Sign-in returns to `/#/my-world` and checkout to `/#/premium`, preserving a GitHub Pages base path when present.

## Catalogue and future discovery

`VITE_CATALOGUE_API_URL` accepts a complete public v1 snapshot endpoint. It sends no cookies or guest library data. Schema and editorial compatibility checks run before the React experience is imported; an invalid/unavailable snapshot falls back to the approved bundled preview. Do not use that preview fallback for rights-sensitive production catalogue withdrawal.

`npm run export:catalogue` generates public import/retrieval inputs locally. Future AI discovery can consume the approved metadata and return cited story IDs using `src/platform/discovery-context.ts`; no AI provider or automatic data transfer is connected. See `architecture/README.md` for implementation status, database proposal, migration boundaries and the rollout sequence.

## Webhooks, media and persistence

Implement signature-verified, idempotent payment webhooks before enabling checkout. Record subscription lifecycle events server-side and reconcile failed or delayed deliveries. The actual checkout, webhook handler, database, identity provider and media-signing service are intentionally not represented as connected in this preview.

Use a private media origin/CDN for premium films. Keep protected URLs out of static JSON, JavaScript bundles and `public/`. HLS/DASH rendition and quality UI should be added only when real renditions exist. The current player offers no fabricated quality controls.

Replace `viewerStore` with an authenticated adapter preserving its read/update/subscribe contract, plus explicit loading/error and merge behavior. Decide how to offer merging guest history after real sign-in; never silently overwrite either library. A free synchronized account is planned, not implemented.

## Integration test cases before launch

Signed out and free users may watch free content. Production premium requests must be denied without a valid subscription. Expired/cancelled subscriptions must be denied by the server. Network/session errors must not grant access. Unreleased programmes stay unavailable regardless of subscription. Checkout success is displayed only after verified server state. Revocation and expiring signed URLs need backend-level tests with the real provider.

## Publisher handoff

Client-approved content, artist imagery, final original-programme copy, launch details, privacy/legal copy, pricing, exact benefits and service credentials remain required inputs for a commercial launch. The current Sites deployment is a public preview; its existing audience is preserved.
