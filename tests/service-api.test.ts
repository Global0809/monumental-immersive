import test from "node:test";
import assert from "node:assert/strict";
import { buildReturnUrl, createApiClient, normalizeApiUrl, readHostedUrl, ServiceError } from "../src/platform/http.ts";
import { createMembershipService, readSession } from "../src/services/membership.ts";
import type { Video } from "../src/data/catalogue.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const code = (expected: string) => (error: unknown) => error instanceof ServiceError && error.code === expected;
const premiumSession = { status: "premium", account: { id: "account-1", name: "Viewer" } };
const premiumFilm = { id: "premium/example", access: "premium", status: "available", src: "/must-not-authorize.mp4" } as Video;
const freeFilm = { ...premiumFilm, access: "free", src: "/preview.mp4" } as Video;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("API configuration permits HTTPS and explicit development loopback only", () => {
  assert.equal(normalizeApiUrl(" https://api.example.test/v1/ "), "https://api.example.test/v1");
  assert.equal(normalizeApiUrl("http://localhost:3100/api", true), "http://localhost:3100/api");
  assert.equal(normalizeApiUrl("http://[::1]:3100/api", true), "http://[::1]:3100/api");
  for (const url of ["http://localhost:3100", "http://api.example.test", "https://user:secret@example.test", "https://api.example.test?key=secret", "https://api.example.test/#/bad", "javascript:alert(1)"])
    assert.throws(() => normalizeApiUrl(url), code("configuration"));
  assert.throws(() => normalizeApiUrl("http://localhost.evil.test", true), code("configuration"));
});

test("hosted URLs reject executable, relative, insecure and credential-bearing values", () => {
  assert.equal(readHostedUrl({ url: "https://billing.example.test/checkout?token=abc" }), "https://billing.example.test/checkout?token=abc");
  for (const url of ["javascript:alert(1)", "/session", "http://cdn.example.test/film", "https://user:secret@example.test/", null, 123])
    assert.throws(() => readHostedUrl({ url }), code("invalid-response"));
});

test("hash return URLs preserve the deployment base and correct actual routes", () => {
  assert.equal(buildReturnUrl("https://site.example.test", "/", "/my-world"), "https://site.example.test/#/my-world");
  assert.equal(buildReturnUrl("https://global0809.github.io", "/monumental-immersive/", "/premium"), "https://global0809.github.io/monumental-immersive/#/premium");
  assert.throws(() => buildReturnUrl("https://site.example.test", "//evil.test/", "/premium"), code("configuration"));
});

test("HTTP boundary normalizes malformed JSON, failed transports, 401 and 403", async () => {
  for (const [fetcher, expected] of [
    [async () => new Response("<html>not JSON</html>"), "invalid-response"],
    [async () => { throw new TypeError("private transport detail"); }, "network"],
    [async () => json({}, 401), "unauthorized"],
    [async () => json({}, 403), "forbidden"],
    [async () => json({}, 503), "unavailable"],
  ] as const) {
    const api = createApiClient({ apiUrl: "https://api.example.test", fetch: fetcher });
    await assert.rejects(api.request("/session", readSession), code(expected));
  }
});

test("bounded requests time out even when a transport ignores cancellation", async () => {
  let signal: AbortSignal | undefined;
  const api = createApiClient({ apiUrl: "https://api.example.test", timeoutMs: 5,
    fetch: async (_url, init) => { signal = init?.signal ?? undefined; return new Promise<Response>(() => {}); } });
  await assert.rejects(api.request("/session", readSession), code("timeout"));
  assert.equal(signal?.aborted, true);
});

test("caller cancellation aborts in-flight transport and returns a normalized error", async () => {
  const controller = new AbortController();
  const api = createApiClient({ apiUrl: "https://api.example.test", fetch: async () => new Promise<Response>(() => {}) });
  const pending = api.request("/session", readSession, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, code("aborted"));
});

test("session validation requires a real account for authenticated statuses", () => {
  assert.deepEqual(readSession(premiumSession), premiumSession);
  assert.deepEqual(readSession({ status: "signed-out" }), { status: "signed-out", account: null });
  for (const data of [null, [], { status: "premium" }, { status: ["premium"], account: { id: "a" } },
    { status: "premium", account: { id: "" } }, { status: "premium", account: { id: 42 } },
    { status: "premium", account: { id: "a", name: {} } }, { status: "signed-out", account: { id: "a" } },
    { status: "loading", account: null }]) assert.throws(() => readSession(data), code("invalid-response"));
});

test("unconfigured and invalid providers keep local guest and free playback working", async () => {
  for (const apiUrl of [undefined, "http://untrusted.example.test"]) {
    let calls = 0;
    const service = createMembershipService({ apiUrl, fetch: async () => { calls++; return json({}); } });
    assert.equal((await service.loadMembership()).status, "setup-pending");
    assert.equal(await service.requestPlayback(freeFilm), "/preview.mp4");
    assert.equal((await service.beginCheckout()).status, "setup-pending");
    assert.equal((await service.signIn()).ready, false);
    await assert.rejects(service.requestPlayback(premiumFilm));
    assert.equal(calls, 0);
  }
});

test("401 or invalid account responses clear prior premium state and identity", async () => {
  const responses = [json(premiumSession), json({}, 401), json(premiumSession), json({ status: "premium", account: "bad" })];
  const service = createMembershipService({ apiUrl: "https://api.example.test", fetch: async () => responses.shift()! });
  assert.equal((await service.loadMembership()).status, "premium");
  assert.equal((await service.loadMembership()).status, "signed-out");
  assert.equal(service.getMembership().account, null);
  await service.loadMembership();
  assert.equal((await service.loadMembership()).status, "error");
  assert.equal(service.getMembership().account, null);
  assert.equal(service.resolveEntitlement(premiumFilm).allowed, false);
});

test("an older session completion cannot overwrite a newer signed-out session", async () => {
  const oldResponse = deferred<Response>();
  let calls = 0;
  const service = createMembershipService({ apiUrl: "https://api.example.test", fetch: async () => ++calls === 1 ? oldResponse.promise : json({ status: "signed-out" }) });
  const first = service.loadMembership();
  await service.loadMembership();
  oldResponse.resolve(json(premiumSession));
  await first;
  assert.equal(service.getMembership().status, "signed-out");
  assert.equal(service.getMembership().account, null);
});

test("development preview cannot unlock premium media or overwrite production state", async () => {
  for (const development of [false, true]) {
    const service = createMembershipService({ development });
    service.setMembershipPreview("premium");
    assert.equal(service.resolveEntitlement(premiumFilm).allowed, false);
    assert.equal(service.getMembership().preview, development);
    await assert.rejects(service.requestPlayback(premiumFilm));
    assert.equal(await service.requestPlayback(freeFilm), "/preview.mp4");
  }
});

test("premium playback uses a server-issued URL and session failures clear access", async () => {
  const paths: string[] = [];
  const responses = [json(premiumSession), json({ url: "https://media.example.test/signed.mp4?token=abc" }), json({}, 401)];
  const service = createMembershipService({ apiUrl: "https://api.example.test/v1", fetch: async (url, init) => {
    paths.push(String(url));
    assert.equal(init?.credentials, "include");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    return responses.shift()!;
  } });
  await service.loadMembership();
  assert.equal(await service.requestPlayback(premiumFilm), "https://media.example.test/signed.mp4?token=abc");
  assert.equal(paths[1], "https://api.example.test/v1/playback/premium%2Fexample");
  await assert.rejects(service.requestPlayback(premiumFilm), code("unauthorized"));
  assert.equal(service.getMembership().status, "signed-out");
  assert.equal(service.getMembership().account, null);
});

test("a stale playback response cannot deliver media or expire a newer session", async () => {
  const playback = deferred<Response>();
  let calls = 0;
  const service = createMembershipService({ apiUrl: "https://api.example.test", fetch: async () => ++calls === 2 ? playback.promise : json(premiumSession) });
  await service.loadMembership();
  const pending = service.requestPlayback(premiumFilm);
  await service.loadMembership();
  playback.resolve(json({ url: "https://media.example.test/stale.mp4" }));
  await assert.rejects(pending, code("aborted"));
  assert.equal(service.getMembership().status, "premium");
});

test("sign-in and checkout send deployment-aware return paths to the configured service", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const service = createMembershipService({ apiUrl: "https://api.example.test", baseUrl: "/monumental-immersive/", origin: () => "https://global0809.github.io",
    fetch: async (url, init) => { requests.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return json({ url: "https://provider.example.test/continue" }); } });
  assert.equal((await service.signIn()).ready, true);
  assert.equal((await service.beginCheckout()).status, "ready");
  assert.deepEqual(requests.map((request) => request.body), [
    { returnUrl: "https://global0809.github.io/monumental-immersive/#/my-world" },
    { returnUrl: "https://global0809.github.io/monumental-immersive/#/premium" },
  ]);
});

test("malformed provider checkout and identity redirects fail closed without leaking transport details", async () => {
  const service = createMembershipService({ apiUrl: "https://api.example.test", origin: () => "https://site.example.test",
    fetch: async () => json({ url: "javascript:alert(1)" }) });
  assert.equal((await service.beginCheckout()).status, "error");
  assert.equal((await service.signIn()).ready, false);
});

test("checkout completing after a session change cannot redirect the new session", async () => {
  const response = deferred<Response>();
  const service = createMembershipService({ apiUrl: "https://api.example.test", origin: () => "https://site.example.test",
    fetch: async (url) => String(url).endsWith("/checkout") ? response.promise : json({ status: "signed-out" }) });
  const checkout = service.beginCheckout();
  await service.loadMembership();
  response.resolve(json({ url: "https://provider.example.test/previous-session" }));
  const result = await checkout;
  assert.equal(result.status, "error");
  assert.equal(result.url, undefined);
  assert.equal(service.getMembership().status, "signed-out");
});
