import rawModules from "./modules.json";
import {
  filterCatalog as filterCatalogRuntime,
  getTrack as getTrackRuntime,
  statusPresentation as statusPresentationRuntime,
} from "./catalog.mjs";

export type FoundryMajor = 13 | 14;
export type VerificationStatus =
  | "verified"
  | "author-claimed"
  | "needs-review"
  | "unavailable"
  | "no-public-manifest"
  | "personal-premium-link";

export type CompatibilityValue = string | number;

export type Compatibility = {
  minimum?: CompatibilityValue;
  verified?: CompatibilityValue;
  maximum?: CompatibilityValue;
};

export type ModuleTrack = {
  foundryMajor: FoundryMajor;
  moduleVersion: string | null;
  installManifestUrl: `https://${string}` | null;
  declaredManifestUrl: `https://${string}` | null;
  compatibility: Compatibility;
  relationships: {
    systems: string[];
    required: string[];
    recommended: string[];
  };
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  verificationNotes?: string;
  sources: {
    catalogUrl: `https://${string}` | null;
    releaseUrl: `https://${string}` | null;
    manifestUrl: `https://${string}` | null;
    metadataManifestUrl: `https://${string}` | null;
  };
};

export type ModuleEntry = {
  id: string;
  title: string;
  description: string;
  category: string;
  licenseType: "free" | "premium";
  license: {
    name: string;
    url: `https://${string}` | null;
  };
  projectUrl: `https://${string}`;
  tracks: ModuleTrack[];
};

export const modules = rawModules as ModuleEntry[];

export type CatalogFilters = {
  major: FoundryMajor;
  query: string;
  category: string | null;
  licenseType: "all" | "free" | "premium";
  system: string | null;
  verifiedOnly: boolean;
};

export type CatalogResult = { entry: ModuleEntry; track: ModuleTrack };
export type VerificationPresentation = {
  label: string;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
  canCopy: boolean;
};

export const getTrack = getTrackRuntime as (entry: ModuleEntry, major: FoundryMajor) => ModuleTrack | null;
export const filterCatalog = filterCatalogRuntime as (entries: readonly ModuleEntry[], filters: CatalogFilters) => CatalogResult[];
export const statusPresentation = statusPresentationRuntime as Record<VerificationStatus, VerificationPresentation>;
