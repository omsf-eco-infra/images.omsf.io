import { describe, expect, it } from "vitest";
import {
  filterPackagesByName,
  findSelection,
  resolveDefaultSelection,
  sortManifestRecords,
} from "./ami-data";
import type { AmiManifestRecord, PackageRecord } from "./types";

describe("sortManifestRecords", () => {
  it("sorts rows in reverse chronological order", () => {
    const records: AmiManifestRecord[] = [
      {
        name: "older",
        amiId: "ami-1",
        buildDatetime: "2026-03-18T08:15:00Z",
        lockfileUrl: "/older.lock",
        keyPackages: {},
        selections: [],
      },
      {
        name: "newer",
        amiId: "ami-2",
        buildDatetime: "2026-04-03T12:34:56Z",
        lockfileUrl: "/newer.lock",
        keyPackages: {},
        selections: [],
      },
    ];

    expect(sortManifestRecords(records).map((record) => record.name)).toEqual([
      "newer",
      "older",
    ]);
  });
});

describe("resolveDefaultSelection", () => {
  it("uses the declared default selection when it exists", () => {
    const record: AmiManifestRecord = {
      name: "fixture",
      amiId: "ami-1",
      buildDatetime: "2026-04-03T12:34:56Z",
      lockfileUrl: "/fixture.lock",
      keyPackages: {},
      defaultSelection: {
        environment: "docs",
        platform: "linux-64",
      },
      selections: [
        {
          environment: "docs",
          platform: "linux-64",
          artifactUrl: "/docs.json",
          packageCount: 1,
        },
      ],
    };

    expect(resolveDefaultSelection(record)).toEqual({
      environment: "docs",
      platform: "linux-64",
    });
  });

  it("falls back to omsf/linux-64 when the manifest default is absent", () => {
    const record: AmiManifestRecord = {
      name: "fixture",
      amiId: "ami-1",
      buildDatetime: "2026-04-03T12:34:56Z",
      lockfileUrl: "/fixture.lock",
      keyPackages: {},
      defaultSelection: {
        environment: "missing",
        platform: "linux-64",
      },
      selections: [
        {
          environment: "omsf",
          platform: "linux-64",
          artifactUrl: "/omsf-linux-64.json",
          packageCount: 3,
        },
        {
          environment: "docs",
          platform: "linux-64",
          artifactUrl: "/docs-linux-64.json",
          packageCount: 1,
        },
      ],
    };

    expect(resolveDefaultSelection(record)).toEqual({
      environment: "omsf",
      platform: "linux-64",
    });
  });
});

describe("findSelection", () => {
  it("returns the matching environment/platform pair", () => {
    const record: AmiManifestRecord = {
      name: "fixture",
      amiId: "ami-1",
      buildDatetime: "2026-04-03T12:34:56Z",
      lockfileUrl: "/fixture.lock",
      keyPackages: {},
      selections: [
        {
          environment: "omsf",
          platform: "linux-64",
          artifactUrl: "/omsf-linux-64.json",
          packageCount: 3,
        },
        {
          environment: "omsf",
          platform: "osx-arm64",
          artifactUrl: "/omsf-osx-arm64.json",
          packageCount: 2,
        },
      ],
    };

    expect(findSelection(record, "omsf", "osx-arm64")?.artifactUrl).toBe(
      "/omsf-osx-arm64.json",
    );
  });
});

describe("filterPackagesByName", () => {
  it("filters package names case-insensitively", () => {
    const packages: PackageRecord[] = [
      { name: "openfe", version: "1.10.0" },
      { name: "OpenFold", version: "2.1.0" },
      { name: "numpy", version: "2.3.0" },
    ];

    expect(filterPackagesByName(packages, "open")).toEqual([
      { name: "openfe", version: "1.10.0" },
      { name: "OpenFold", version: "2.1.0" },
    ]);
  });
});
