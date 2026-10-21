import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { videos, places, periods } from "../src/data/catalogue.ts";
import {
  filterVideos,
  relatedVideos,
  buildJourney,
} from "../src/services/discovery.ts";

test("catalogue IDs are unique and all explicit relationships resolve", () => {
  assert.equal(new Set(videos.map((v) => v.id)).size, videos.length);
  for (const video of videos) {
    assert.ok(periods.some((p) => p.id === video.period));
    for (const id of video.places) assert.ok(places.some((p) => p.id === id));
  }
});
test("Miami and Music intersect rather than union", () => {
  const found = filterVideos({ place: "miami", category: "Music" });
  assert.ok(found.length > 0);
  assert.ok(
    found.every((v) => v.places.includes("miami") && v.category === "Music"),
  );
});
test("query finds people and destination labels and combines every word", () => {
  assert.ok(
    filterVideos({ q: "valid id london" }).some(
      (v) => v.id === "wavemakers-valid-id",
    ),
  );
  assert.ok(
    filterVideos({ q: "tokyo" }).every(
      (v) =>
        v.places.includes("tokyo") || v.title.toLowerCase().includes("tokyo"),
    ),
  );
});
test("unsupported combined filters and searches are truly empty", () => {
  assert.equal(filterVideos({ place: "miami", category: "Fashion" }).length, 0);
  assert.equal(filterVideos({ q: "no-such-story-xyz" }).length, 0);
});
test("historical collection uses explicit story context", () => {
  const found = filterVideos({ period: "1930s", place: "miami" });
  assert.equal(found.length, 1);
  assert.equal(found[0].id, "concrete-and-colour");
  assert.match(found[0].publishedAt, /^2026-/);
});
test("runtime filters exclude unreleased originals", () => {
  for (const duration of ["short", "medium", "long"])
    assert.ok(
      filterVideos({ duration }).every((v) => v.status === "available"),
    );
  assert.ok(
    filterVideos({ access: "free", duration: "short" }).every(
      (v) => v.duration < 180 && v.access === "free",
    ),
  );
});
test("journey never exceeds its actual time budget and uses free playable records", () => {
  for (const minutes of [1, 3, 15, 30]) {
    const trail = buildJourney("Music", minutes, "miami");
    assert.ok(trail.reduce((n, v) => n + v.duration, 0) <= minutes * 60);
    assert.ok(
      trail.every(
        (v) => v.status === "available" && v.access === "free" && v.src,
      ),
    );
    assert.equal(new Set(trail.map((v) => v.id)).size, trail.length);
  }
});
test("a journey starts with its strongest metadata match", () => {
  assert.equal(buildJourney("Music", 15, "miami")[0].id, "miami-frequency");
});
test("related viewing never recommends the same video or unavailable material", () => {
  const source = videos.find((v) => v.id === "miami-frequency")!;
  const related = relatedVideos(source);
  assert.ok(related.length > 0);
  for (const item of related) {
    assert.notEqual(item.video.id, source.id);
    assert.equal(item.video.status, "available");
    assert.ok(item.reason.length > 5);
  }
});
test("all local media, posters and captions exist for available records", () => {
  for (const v of videos) {
    for (const asset of [v.poster, v.src, v.captions]) {
      if (asset?.startsWith("/"))
        assert.ok(
          existsSync(new URL("../public" + asset, import.meta.url)),
          `${v.id}: missing ${asset}`,
        );
    }
    if (v.status === "available") {
      assert.ok(v.src);
      assert.ok(v.duration > 0);
    } else {
      assert.equal(v.src, undefined);
      assert.equal(v.duration, 0);
    }
  }
});
test("source data separates planned originals from finished preview content", () => {
  for (const v of videos.filter((v) => v.tags.includes("originals"))) {
    assert.equal(v.status, "development");
    assert.equal(v.publishedAt, "");
  }
});
