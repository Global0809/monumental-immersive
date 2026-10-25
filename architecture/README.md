# Monumental website foundation

This change applies the client's architecture request to the streaming website. It preserves the current experience and prepares content, service and data boundaries for subsequent releases. It does not implement the separate autonomous business-intelligence system, industry analysis, trading, blockchain, gambling or a general-purpose “Matters” operating system. The October 13 architecture and attachments were not supplied for this change; review them before committing the next backend design.

## What is implemented now

| Area | Working foundation | Remaining production work |
| --- | --- | --- |
| Catalogue | Shared domain types, v1 snapshot validation, indexed data, bundled and HTTP repositories, hydration before UI initialization | CMS/editor dashboard, editorial workflow and a published catalogue endpoint |
| Existing experience | Stable featured-story IDs, safe destination fallback, all current scenes and routes retained | Make scene/editorial assignments data-driven before changing destination/era structure |
| Accounts and membership | Bounded requests, validated responses, session race protection, correct return routes, server-authorized premium playback boundary | Identity provider, server sessions, account database, billing and signed media delivery |
| Future AI discovery | Exportable public grounding context with credits and historical/publication dates; response contract rejects missing/stale sources and invented story IDs | Server retrieval, chosen provider, evaluations, usage limits and approved user-facing feature |
| Database | Normalized PostgreSQL starter in `schema.sql` for review | Provisioning, migrations, roles/access enforcement, backups and integration tests |
| Personal collection | Existing local library, notes, progress and settings preserved | Authenticated sync, explicit guest merge and account-switch isolation |

No credentials, AI vendor, database, checkout, cloud sync or CMS have been connected by this change. No new user tracking or AI data transfer is enabled. Existing recommendations remain catalogue rules, not an AI service. The SQL is unapplied, and the discovery response validator is an integration contract, not a running assistant.

## Architecture decision

Keep the React experience as the presentation layer. Add a modular server application with one versioned API when production services are commissioned. Start with bounded modules in one deployable backend: catalogue/editorial, identity/library, membership/playback, and discovery. Share stable identifiers and explicit contracts; avoid having each page depend on a particular CMS, database SDK or AI provider.

Use a relational database for records and ownership, object storage for originals, a transcoding job queue for renditions, and a CDN for delivery. Media bytes do not belong in the application database. A server API can run separately from the current static Sites/GitHub hosting; the front end uses public endpoint configuration. Provider credentials stay on that server.

```text
React / sculpture / globe / player / native scrolling
    |
    +-- catalogue facade -> bundled preview OR validated public snapshot
    +-- membership adapter -> authenticated server session / checkout / playback
    +-- viewer store -> local guest library (future authenticated sync)

Future server API
    +-- catalogue + publishing -> relational data + approved snapshot cache
    +-- identity + library -> owner-scoped records
    +-- membership + playback -> payment provider + signed media authorization
    +-- discovery -> approved retrieval index -> AI provider (optional)
    +-- workers -> media processing / index updates / verified webhooks
```

Modularity reduces future rework; it does not guarantee unlimited scale or eliminate future migrations. Introduce independent services only when measured load, security boundaries or team ownership justify their operational cost.

## Content contract and activation

`src/platform/catalogue/domain.ts` owns the public domain types. `src/data/catalogue.seed.ts` retains the authored preview collection. `src/data/catalogue.ts` is the compatibility facade used by the existing experience. It hydrates once before `App` is imported, so sculpture and discovery modules see the same revision. The mounted UI is never silently replaced by a late network response.

Run `npm run export:catalogue` to create two local files under the ignored `output/platform/` folder:

- `catalogue.v1.json`: validated public records for CMS migration or a compatible endpoint.
- `discovery-context.v1.json`: credits and editorial context for a future retrieval index. Includes content status, access, publication date and explored era; excludes media URLs, accounts, notes and viewing history.

The snapshot envelope is `{schemaVersion: 1, revision, videos, places, periods}`. Change the opaque revision whenever published metadata changes. Set `VITE_CATALOGUE_API_URL` to the complete public snapshot endpoint only after implementing it. With no value, the current bundled catalogue loads immediately. Remote requests are anonymous, bounded to three seconds, and fall back to the approved bundled preview on network, validation or compatibility failure. This fallback is suitable for this preview; production rights withdrawal must invalidate all caches and must not fall back to revoked content.

The reusable validator checks IDs, references, fields and safe resource URLs. The separate preview compatibility policy retains existing story IDs and the ordered destination/era structure because the sculpture, City Experience, WAVEMAKERS and era artwork contain authored references. It also retains destination image paths so the existing attribution stays accurate. Film order may change and new stories may be added. This first adapter is not permission to replace the six authored destinations arbitrarily. Migrate scene metadata and source credits together before expanding those structures.

Root-relative media URLs resolve against the deployed origin. A catalogue publisher must supply correct asset paths for its deployment; the GitHub mirror preserves its existing subdirectory asset handling. Private premium media and caption URLs are rejected from public snapshots. An available premium title can have metadata without a source; the server authorizes its playback separately.

This is a small-preview snapshot, capped at 2 MB. Before a large catalogue, implement cursor pagination and server search/filter queries, keeping the same domain IDs and compatible result records. Do not load an unlimited database into the browser or inflate startup with AI models.

## Server endpoints and ownership

The existing `VITE_MEMBERSHIP_API_URL` is a base URL; it may include `/v1`. Keep existing clients compatible during migration. `INTEGRATIONS.md` defines the active session, sign-in, checkout and playback contracts. `src/platform/http.ts` supplies reusable bounded transport and validated service responses.

| Boundary | Suggested endpoint | Authority |
| --- | --- | --- |
| Public catalogue | `GET /v1/catalogue` | Published, approved metadata only; revision + cache validators |
| Session | `GET /v1/session` | Server session and verified account |
| Sign-in | `POST /v1/auth/signin` | Identity provider; server allowlists return origins/paths |
| Checkout | `POST /v1/checkout` | Approved product/price and idempotent provider operation |
| Playback | `GET /v1/playback/:storyId` | Current entitlement, rights window/territory and signed media URL |
| Personal library (future) | `GET/PATCH /v1/me/library` | Session owner; revision-based conflict handling |
| AI discovery (future) | `POST /v1/discovery/query` | Published retrieval corpus; no private context by default |
| Editorial publishing (future) | `POST /v1/editorial/publications` | Authorized publisher and approved draft revision |

Use exact-origin CORS with HTTPS, secure cookies, CSRF/origin checks for mutations, rate limits and server-side validation. Do not expose database or payment-provider SDKs to the browser. A successful checkout redirect is not payment proof: verify signed, idempotent webhooks and reconcile provider state. A recommendation never grants viewing access.

## Data, migration and media

`schema.sql` is an unapplied starter model. Preserve current story/place IDs when importing; saved links, journeys and timestamp notes depend on them. Normalize core relations rather than hiding all content in one JSON blob. Distinguish a film's publication date from the period it explores. Every asset needs provenance and publication/rights review before release.

Guest data remains under `monumental.viewer.v1`. Future sign-in must offer an explicit merge: deduplicate saved IDs; preserve notes and journey order; resolve viewing progress by timestamp with an explainable conflict policy. Do not copy anonymous notes into an account without the visitor choosing it. Switching accounts must clear the previous in-memory account cache. Server ownership checks apply to every library query and mutation.

Media workflow: authorized upload → private original → queued transcode/captions/poster generation → editorial and rights review → publish metadata revision → CDN delivery. Publish only when required assets are ready. Keep original assets and approved source material for auditability. Premium origins remain private even if their title metadata is public.

Use an outbox/event record for durable `story.published`, `story.updated`, `story.withdrawn` and `subscription.changed` work. Workers should process events idempotently with retry/dead-letter handling, invalidate caches, and update retrieval indexes. These are future server jobs, not browser timers. Apply migrations on staging first; verify backups/restoration and owner-isolation tests before production.

## AI integration scope

Start with grounded catalogue discovery: visitors describe a place, theme or viewing time; the server retrieves approved records and returns suggestions referencing source IDs and a catalogue revision. `createDiscoveryContext` produces the public input. `parseDiscoveryAnswer` enforces the v1 response shape, known sources and available story references. It cannot prove an explanation is true; evaluation and editorial review are still required.

Treat transcripts and supplied documents as data, never executable instructions. Keep provider keys, retrieval authorization, usage budgets and logging controls on the server. Do not feed private notes/history into prompts by default. Keep generated copy and metadata edits as drafts until an editor approves them. Never let a model publish, bill, grant access or change rights from natural-language output. Optional AI failure must leave ordinary search, browsing and playback available.

The website can later exchange approved events with a separately commissioned intelligence platform. No nested autonomous agents or generalized “Matters” hierarchy are embedded in the viewer website now.

## Delivery sequence and review gates

1. **Current foundation:** validated catalogue/service boundaries, portable public export, schema and integration plan; keep the current visual experience.
2. **Production streaming:** confirm hosting/data ownership; implement identity, owner-scoped library, CMS roles, media ingest/CDN, monitoring and rights workflow. Test account isolation, playback denial, cache withdrawal and restore procedures.
3. **Premium launch:** approve products/prices and content rights; connect billing/webhooks and signed playback. Test expiry, cancellation, refunds and delayed webhook reconciliation.
4. **AI pilot:** agree one measurable website use case; connect approved retrieval sources, verify citations/availability, evaluate recommendation usefulness and cost, then enable an optional feature.
5. **Expansion:** make scene/editorial definitions data-driven, add modules against versioned APIs, and size infrastructure from actual traffic. Re-scope cross-industry intelligence separately.

No November 1 production-service commitment is implied by this code change. The next review needs the promised October 13 architecture, approved content/rights, deployment ownership, identity/billing choices, privacy requirements and actual launch scope.
