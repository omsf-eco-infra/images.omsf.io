import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import manifestJson from "../data/manifest.json";
import {
  EnvironmentSchema,
  GlobalManifestSchema,
  ImageSchema,
} from "./schema";
import type {
  EnvironmentRecord,
  ImageEnvironmentReference,
  ImageRecord,
  ImageSummary,
  InstalledPackage,
} from "./types";

const globalManifest = GlobalManifestSchema.parse(manifestJson);

function resolvePublicPath(urlPath: string): string {
  return resolve(process.cwd(), "public", urlPath.replace(/^\//, ""));
}

export function sortImageSummaries(records: ImageSummary[]): ImageSummary[] {
  return [...records].sort((left, right) => {
    const byDate = Date.parse(right.timestamp) - Date.parse(left.timestamp);

    if (byDate !== 0) {
      return byDate;
    }

    return left.name.localeCompare(right.name);
  });
}

export function listImageSummaries(): ImageSummary[] {
  return sortImageSummaries(globalManifest);
}

export function findImageSummaryByName(
  name: string,
): ImageSummary | undefined {
  return globalManifest.find((record) => record.name === name);
}

export async function readImageFromUrl(
  imageJsonUrl: string,
): Promise<ImageRecord> {
  const rawImage = await readFile(resolvePublicPath(imageJsonUrl), "utf8");

  return ImageSchema.parse(JSON.parse(rawImage));
}

export function resolveDefaultEnvironment(
  image: ImageRecord,
): ImageEnvironmentReference | null {
  return image.environments[0] ?? null;
}

export function findEnvironmentReference(
  image: ImageRecord,
  environmentName: string,
  platform: string,
): ImageEnvironmentReference | undefined {
  return image.environments.find(
    (environment) =>
      environment.name === environmentName && environment.platform === platform,
  );
}

export function listEnvironmentNames(image: ImageRecord): string[] {
  const names = new Set<string>();

  for (const environment of image.environments) {
    names.add(environment.name);
  }

  return [...names];
}

export function listPlatformsForEnvironment(
  image: ImageRecord,
  environmentName: string,
): ImageEnvironmentReference[] {
  return image.environments.filter(
    (environment) => environment.name === environmentName,
  );
}

export function buildEnvironmentIndex(
  image: ImageRecord,
): Record<string, ImageEnvironmentReference[]> {
  return Object.fromEntries(
    listEnvironmentNames(image).map((environmentName) => [
      environmentName,
      listPlatformsForEnvironment(image, environmentName),
    ]),
  );
}

export async function readEnvironmentFromUrl(
  environmentJsonUrl: string,
): Promise<EnvironmentRecord> {
  const rawEnvironment = await readFile(resolvePublicPath(environmentJsonUrl), "utf8");

  return EnvironmentSchema.parse(JSON.parse(rawEnvironment));
}

export function filterPackagesByName(
  packages: InstalledPackage[],
  query: string,
): InstalledPackage[] {
  const normalized = query.trim().toLowerCase();

  if (normalized === "") {
    return packages;
  }

  return packages.filter((pkg) => pkg.name.toLowerCase().includes(normalized));
}

export function formatTimestamp(timestamp: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));

  return `${formatted} UTC`;
}
