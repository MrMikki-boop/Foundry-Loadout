import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../data/modules.json" with { type: "json" };
import { filterCatalog, statusPresentation } from "../data/catalog.mjs";

const baseFilters = {
  major: 14,
  query: "",
  category: null,
  licenseType: "all",
  system: null,
  verifiedOnly: false,
};

test("catalog has separate V13 and V14 tracks for every entry", () => {
  assert.equal(catalog.length, 5);
  for (const entry of catalog) {
    assert.deepEqual(entry.tracks.map((track) => track.foundryMajor).sort(), [13, 14]);
    assert.equal(new Set(entry.tracks.map((track) => track.foundryMajor)).size, 2);
  }
});

test("verified install URLs are pinned HTTPS manifests", () => {
  const tracks = catalog.flatMap((entry) => entry.tracks);
  const verified = tracks.filter((track) => track.verificationStatus === "verified");
  assert.equal(verified.length, 8);
  for (const track of verified) {
    assert.match(track.installManifestUrl, /^https:\/\//);
    assert.doesNotMatch(track.installManifestUrl, /\/latest\//i);
    assert.equal(track.verifiedAt, "2026-08-19");
    assert.match(track.sources.catalogUrl, /^https:\/\/foundryvtt\.com\/packages\//);
    assert.match(track.sources.releaseUrl, /^https:\/\//);
    assert.match(track.sources.manifestUrl, /^https:\/\//);
  }
});

test("catalog keeps declared licenses and manifest dependency relationships", () => {
  const russian = catalog.find((entry) => entry.id === "ru-ru");
  const diceTray = catalog.find((entry) => entry.id === "dice-calculator");
  const dae = catalog.find((entry) => entry.id === "dae");
  const libWrapper = catalog.find((entry) => entry.id === "lib-wrapper");

  assert.deepEqual(russian.dependencies, { required: [], recommended: ["lib-wrapper", "babele"] });
  assert.deepEqual(diceTray.dependencies, { required: [], recommended: [] });
  assert.deepEqual(dae.dependencies, { required: ["lib-wrapper", "socketlib"], recommended: [] });
  assert.deepEqual(diceTray.license, {
    name: "MIT",
    url: "https://github.com/mclemente/fvtt-dice-tray/blob/master/LICENSE",
  });
  assert.equal(libWrapper.license.name, "LGPL-3.0");
  assert.equal(russian.license.name, "Не указана автором");
  assert.equal(russian.license.url, null);
  for (const entry of catalog) {
    assert.equal(typeof entry.license.name, "string");
    assert.ok(entry.license.name.length > 0);
    if (entry.license.url !== null) assert.match(entry.license.url, /^https:\/\//);
  }
});

test("compatibility values stay raw and missing maximum is not invented", () => {
  const libWrapper = catalog.find((entry) => entry.id === "lib-wrapper");
  const track13 = libWrapper.tracks.find((track) => track.foundryMajor === 13);
  assert.deepEqual(track13.compatibility, { minimum: "0.6.5", verified: "13" });
  assert.equal(Object.hasOwn(track13.compatibility, "maximum"), false);
});

test("premium personal-install tracks never expose a manifest URL", () => {
  const premium = catalog.find((entry) => entry.id === "jb2a_patreon");
  assert.equal(premium.licenseType, "premium");
  for (const track of premium.tracks) {
    assert.equal(track.verificationStatus, "personal-premium-link");
    assert.equal(track.installManifestUrl, null);
    assert.equal(track.declaredManifestUrl, null);
    assert.equal(track.sources.manifestUrl, null);
  }
  assert.equal(statusPresentation["personal-premium-link"].canCopy, false);
});

test("filters combine query, category, license, system and status with AND", () => {
  const result = filterCatalog(catalog, {
    ...baseFilters,
    query: "active effects",
    category: "Автоматизация",
    licenseType: "free",
    system: "dnd5e",
    verifiedOnly: true,
  });
  assert.deepEqual(result.map(({ entry }) => entry.id), ["dae"]);

  const premium = filterCatalog(catalog, { ...baseFilters, licenseType: "premium" });
  assert.deepEqual(premium.map(({ entry }) => entry.id), ["jb2a_patreon"]);

  const verifiedPremium = filterCatalog(catalog, {
    ...baseFilters,
    licenseType: "premium",
    verifiedOnly: true,
  });
  assert.deepEqual(verifiedPremium, []);
});

test("catalog contains no credentials or bulk-install model", () => {
  const serialized = JSON.stringify(catalog);
  assert.doesNotMatch(serialized, /token|secret|password|api[_-]?key/i);
  assert.doesNotMatch(serialized, /bundle|cart|bulk|export/i);
});
