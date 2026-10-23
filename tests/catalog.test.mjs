import assert from "node:assert/strict";
import test from "node:test";
import catalog from "../data/modules.json" with { type: "json" };
import { filterCatalog, statusPresentation, installationPlan } from "../data/catalog.mjs";

const baseFilters = {
  major: 14,
  query: "",
  category: null,
  licenseType: "all",
  system: null,
  verifiedOnly: false,
};

test("catalog has unique supported tracks for every entry", () => {
  assert.equal(new Set(catalog.map((entry) => entry.id)).size, catalog.length);
  for (const entry of catalog) {
    assert.ok(entry.tracks.length > 0);
    assert.ok(entry.tracks.every(track => [13, 14].includes(track.foundryMajor)));
    assert.equal(new Set(entry.tracks.map((track) => track.foundryMajor)).size, entry.tracks.length);
  }
});

test("verified install URLs are pinned HTTPS manifests", () => {
  const tracks = catalog.flatMap((entry) => entry.tracks);
  const verified = tracks.filter((track) => track.verificationStatus === "verified");
  assert.ok(verified.length > 0);
  for (const track of verified) {
    assert.match(track.installManifestUrl, /^https:\/\//);
    assert.doesNotMatch(track.installManifestUrl, /\/latest\//i);
    assert.match(track.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
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
  const levels = catalog.find((entry) => entry.id === "levels");

  assert.deepEqual(russian.tracks[0].relationships, { systems: [], required: [], recommended: ["lib-wrapper", "babele"] });
  assert.deepEqual(diceTray.tracks[0].relationships, { systems: [], required: [], recommended: [] });
  assert.deepEqual(dae.tracks[0].relationships, { systems: ["dnd5e"], required: ["lib-wrapper", "socketlib"], recommended: [] });
  assert.deepEqual(levels.tracks.find((track) => track.foundryMajor === 13).relationships.required, ["lib-wrapper", "wall-height"]);
  assert.deepEqual(levels.tracks.find((track) => track.foundryMajor === 14).relationships.required, ["lib-wrapper"]);
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

test("premium personal-install tracks never expose an install manifest URL", () => {
  const premiumEntries = catalog.filter((entry) => entry.licenseType === "premium");
  assert.ok(premiumEntries.length > 0);
  for (const track of premiumEntries.flatMap((entry) => entry.tracks)) {
    assert.equal(track.verificationStatus, "personal-premium-link");
    assert.equal(track.installManifestUrl, null);
    assert.equal(track.declaredManifestUrl, null);
    assert.equal(track.sources.manifestUrl, null);
  }
  const hover = catalog.find((entry) => entry.id === "hover-distance");
  assert.match(hover.tracks[0].sources.metadataManifestUrl, /^https:\/\/r2\.foundryvtt\.com\/packages-public\//);
  assert.equal(statusPresentation["personal-premium-link"].canCopy, false);
});

test("filters combine query, category, license, system and status with AND", () => {
  const result = filterCatalog(catalog, {
    ...baseFilters,
    major: 13,
    query: "active effects",
    category: "Автоматизация",
    licenseType: "free",
    system: "dnd5e",
    verifiedOnly: true,
  });
  assert.deepEqual(result.map(({ entry }) => entry.id), ["dae"]);

  const premium = filterCatalog(catalog, { ...baseFilters, licenseType: "premium" });
  assert.deepEqual(premium.map(({ entry }) => entry.id), ["jb2a_patreon", "hover-distance"]);

  const verifiedPremium = filterCatalog(catalog, {
    ...baseFilters,
    licenseType: "premium",
    verifiedOnly: true,
  });
  assert.deepEqual(verifiedPremium, []);
});

test("catalog contains no credentials", () => {
  const serialized = JSON.stringify(catalog);
  assert.doesNotMatch(serialized, /(?:[?&](?:token|key)=|password|api[_-]?key|secret=)/i);

});


test("installation plan resolves nested dependencies once, before dependents", () => {
  for (const major of [13, 14]) {
    const plan = installationPlan(["JB2A_DnD5e", "dnd5e-animations"], major);
    assert.deepEqual(new Set(plan.map(item => item.id)), new Set(["JB2A_DnD5e", "sequencer", "socketlib", "autoanimations", "dnd5e-animations"]));
    for (const [index, item] of plan.entries()) {
      for (const dep of item.track.relationships.required) assert.ok(plan.findIndex(row => row.id === dep) < index);
    }
    assert.ok(plan.every(item => item.track.foundryMajor === major));
  }
  const entries = [{id: "a", tracks: [{foundryMajor: 13, relationships: {required: ["b", "missing"]}}]}, {id: "b", tracks: [{foundryMajor: 13, relationships: {required: ["a"]}}]}];
  assert.deepEqual(installationPlan(["a", "b"], 13, entries).map(item => item.id), ["b", "missing", "a"]);
  assert.equal(installationPlan(["missing"], 13, entries)[0].track, undefined);
});

test("system filtering includes universal modules", () => {
  const result = filterCatalog(catalog, {...baseFilters, system: "dnd5e"});
  assert.ok(result.some(({entry}) => entry.id === "JB2A_DnD5e"));
  assert.ok(result.some(({entry}) => entry.id === "dnd5e-animations"));
});


test("new author modules retain compatibility and keep Laaru editions together", () => {
  const facing = catalog.find(entry => entry.id === "classic-facing");
  assert.deepEqual(facing.tracks.map(track => track.foundryMajor), [14]);
  const laaru = catalog.find(entry => entry.id === "laaru-dnd5-hw");
  assert.equal(laaru.licenseType, "free");
  assert.equal(laaru.paidEdition.url, "https://boosty.to/laaru");
  assert.ok(filterCatalog(catalog, {...baseFilters, query: "русификатор"}).some(({entry}) => entry.id === "ru-ru"));
});
