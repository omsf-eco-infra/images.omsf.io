import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import manifestJson from "../data/manifest.json";
import {
  DEFAULT_SUMMARY_ENVIRONMENT,
  DEFAULT_SUMMARY_PLATFORM,
} from "./config";
import type {
  AmiDetailArtifact,
  AmiManifestRecord,
  AmiManifestSelection,
  PackageRecord,
  SelectionPair,
} from "./types";

const manifest = manifestJson as AmiManifestRecord[];

export function sortManifestRecords(
  records: AmiManifestRecord[],
): AmiManifestRecord[] {
  return [...records].sort((left, right) => {
    const byDate =
      Date.parse(right.buildDatetime) - Date.parse(left.buildDatetime);

    if (byDate !== 0) {
      return byDate;
    }

    return left.name.localeCompare(right.name);
  });
}

export function listAmiManifestRecords(): AmiManifestRecord[] {
  return sortManifestRecords(manifest);
}

export function findAmiRecordByName(
  name: string,
): AmiManifestRecord | undefined {
  return manifest.find((record) => record.name === name);
}

export function findSelection(
  record: AmiManifestRecord,
  environment: string,
  platform: string,
): AmiManifestSelection | undefined {
  return record.selections.find(
    (selection) =>
      selection.environment === environment && selection.platform === platform,
  );
}

export function resolveDefaultSelection(
  record: AmiManifestRecord,
): SelectionPair | null {
  if (record.defaultSelection) {
    const preferred = findSelection(
      record,
      record.defaultSelection.environment,
      record.defaultSelection.platform,
    );

    if (preferred) {
      return {
        environment: preferred.environment,
        platform: preferred.platform,
      };
    }
  }

  const summarySelection = findSelection(
    record,
    DEFAULT_SUMMARY_ENVIRONMENT,
    DEFAULT_SUMMARY_PLATFORM,
  );

  if (summarySelection) {
    return {
      environment: summarySelection.environment,
      platform: summarySelection.platform,
    };
  }

  const fallback = [...record.selections].sort((left, right) => {
    const byEnvironment = left.environment.localeCompare(right.environment);

    if (byEnvironment !== 0) {
      return byEnvironment;
    }

    return left.platform.localeCompare(right.platform);
  })[0];

  return fallback
    ? {
        environment: fallback.environment,
        platform: fallback.platform,
      }
    : null;
}

export function listEnvironmentOptions(record: AmiManifestRecord): string[] {
  return [...new Set(record.selections.map((selection) => selection.environment))]
    .sort((left, right) => left.localeCompare(right));
}

export function listPlatformsForEnvironment(
  record: AmiManifestRecord,
  environment: string,
): AmiManifestSelection[] {
  return record.selections
    .filter((selection) => selection.environment === environment)
    .sort((left, right) => left.platform.localeCompare(right.platform));
}

export function buildSelectionIndex(
  record: AmiManifestRecord,
): Record<string, AmiManifestSelection[]> {
  return Object.fromEntries(
    listEnvironmentOptions(record).map((environment) => [
      environment,
      listPlatformsForEnvironment(record, environment),
    ]),
  );
}

export async function readArtifactFromUrl(
  artifactUrl: string,
): Promise<AmiDetailArtifact> {
  const filePath = resolve(process.cwd(), "public", artifactUrl.replace(/^\//, ""));
  const rawArtifact = await readFile(filePath, "utf8");

  return JSON.parse(rawArtifact) as AmiDetailArtifact;
}

export function filterPackagesByName(
  packages: PackageRecord[],
  query: string,
): PackageRecord[] {
  const normalized = query.trim().toLowerCase();

  if (normalized === "") {
    return packages;
  }

  return packages.filter((pkg) =>
    pkg.name.toLowerCase().includes(normalized),
  );
}

export function formatBuildDatetime(buildDatetime: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(buildDatetime));

  return `${formatted} UTC`;
}
