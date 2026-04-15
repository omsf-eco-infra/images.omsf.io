import { describe, expect, it } from "vitest";
import {
  filterPackagesByName,
  findEnvironmentReference,
  resolveDefaultEnvironment,
  sortImageSummaries,
} from "./image-data";
import type {
  ImageRecord,
  ImageSummary,
  InstalledPackage,
} from "./types";

describe("sortImageSummaries", () => {
  it("sorts rows in reverse chronological order", () => {
    const records: ImageSummary[] = [
      {
        name: "older",
        timestamp: "2026-03-18T08:15:00Z",
        amiId: "ami-1",
        dockerImage: "ghcr.io/omsf/older:2026-03-18",
        packageVersions: {},
        imageJsonUrl: "/artifacts/older/image.json",
      },
      {
        name: "newer",
        timestamp: "2026-04-03T12:34:56Z",
        amiId: "ami-2",
        dockerImage: "ghcr.io/omsf/newer:2026-04-03",
        packageVersions: {},
        imageJsonUrl: "/artifacts/newer/image.json",
      },
    ];

    expect(sortImageSummaries(records).map((record) => record.name)).toEqual([
      "newer",
      "older",
    ]);
  });
});

describe("resolveDefaultEnvironment", () => {
  it("uses the first environment entry as the default", () => {
    const image: ImageRecord = {
      name: "fixture",
      timestamp: "2026-04-03T12:34:56Z",
      amiId: "ami-1",
      dockerImage: "ghcr.io/omsf/fixture:2026-04-03",
      packageVersions: {},
      imageJsonUrl: "/artifacts/fixture/image.json",
      pixiLockUrl: "/lockfiles/fixture.pixi.lock",
      environments: [
        {
          name: "docs",
          platform: "linux-64",
          environmentJsonUrl: "/artifacts/fixture/docs-linux-64.json",
        },
        {
          name: "omsf",
          platform: "linux-64",
          environmentJsonUrl: "/artifacts/fixture/omsf-linux-64.json",
        },
      ],
    };

    expect(resolveDefaultEnvironment(image)).toEqual({
      name: "docs",
      platform: "linux-64",
      environmentJsonUrl: "/artifacts/fixture/docs-linux-64.json",
    });
  });
});

describe("findEnvironmentReference", () => {
  it("returns the matching environment/platform pair", () => {
    const image: ImageRecord = {
      name: "fixture",
      timestamp: "2026-04-03T12:34:56Z",
      amiId: "ami-1",
      dockerImage: "ghcr.io/omsf/fixture:2026-04-03",
      packageVersions: {},
      imageJsonUrl: "/artifacts/fixture/image.json",
      pixiLockUrl: "/lockfiles/fixture.pixi.lock",
      environments: [
        {
          name: "omsf",
          platform: "linux-64",
          environmentJsonUrl: "/artifacts/fixture/omsf-linux-64.json",
        },
        {
          name: "omsf",
          platform: "osx-arm64",
          environmentJsonUrl: "/artifacts/fixture/omsf-osx-arm64.json",
        },
      ],
    };

    expect(
      findEnvironmentReference(image, "omsf", "osx-arm64")?.environmentJsonUrl,
    ).toBe("/artifacts/fixture/omsf-osx-arm64.json");
  });
});

describe("filterPackagesByName", () => {
  it("filters package names case-insensitively", () => {
    const packages: InstalledPackage[] = [
      { name: "openfe", version: "1.10.0", buildId: "abc", source: "conda" },
      { name: "OpenFold", version: "2.1.0", buildId: null, source: "pypi" },
      { name: "numpy", version: "2.3.0", buildId: "def", source: "conda" },
    ];

    expect(filterPackagesByName(packages, "open")).toEqual([
      { name: "openfe", version: "1.10.0", buildId: "abc", source: "conda" },
      { name: "OpenFold", version: "2.1.0", buildId: null, source: "pypi" },
    ]);
  });
});
