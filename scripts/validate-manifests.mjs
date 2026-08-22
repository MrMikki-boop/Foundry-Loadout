import catalog from "../data/modules.json" with { type: "json" };
import { buildValidationPlan, publicUrl, validateTrack } from "./manifest-validator.mjs";

const { tracks, allowedInitialUrls } = buildValidationPlan(catalog);

let failures = 0;
for (const { entry, track } of tracks) {
  const label = `${entry.id} V${track.foundryMajor} ${track.moduleVersion}`;
  try {
    const snapshot = await validateTrack(entry, track, { allowedInitialUrls });
    console.log(`OK   ${label} | ${snapshot.bytes} B | ${publicUrl(snapshot.finalUrl)}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label} | ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures) {
  console.error(`\nПроверка не пройдена: ${failures} из ${tracks.length} manifest.`);
  process.exitCode = 1;
} else {
  console.log(`\nПроверено manifest: ${tracks.length}. Ошибок нет.`);
}
