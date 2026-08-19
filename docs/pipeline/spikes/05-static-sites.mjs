import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const hosting = resolve(root, ".openai/hosting.json");
const productionEntries = ["app", "src", "public", "package.json"].filter((entry) => existsSync(resolve(root, entry)));
console.log(JSON.stringify({
  node: process.version,
  hostingJsonExists: existsSync(hosting),
  productionEntries,
  repositoryEntries: readdirSync(root).sort(),
  staticRuntimeNeeds: { api: false, database: false, secrets: false, userSuppliedUrls: false },
  sitesBuildProofAvailable: existsSync(hosting) && productionEntries.length > 0,
}));
