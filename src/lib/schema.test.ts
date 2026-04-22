import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import manifestJson from "../data/manifest.json";
import openfeImageJson from "../../public/artifacts/openfe-2026-04-03/image.json";
import openfeTestEnvironmentJson from "../../public/artifacts/openfe-2026-04-03/openfe-test-linux-64.json";
import {
  EnvironmentSchema,
  GlobalManifestSchema,
  ImageSchema,
} from "./schema";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function listJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return listJsonFiles(entryPath);
      }

      return entry.name.endsWith(".json") ? [entryPath] : [];
    }),
  );

  return files.flat().sort((left, right) => left.localeCompare(right));
}

describe("GlobalManifestSchema", () => {
  it("validates the checked-in manifest fixture", () => {
    const manifest = GlobalManifestSchema.parse(manifestJson);

    expect(manifest).toHaveLength(2);
  });

  it("rejects unknown extra keys on manifest records", () => {
    const invalidManifest = structuredClone(manifestJson) as Array<
      Record<string, unknown>
    >;

    invalidManifest[0] = {
      ...invalidManifest[0],
      unexpected: true,
    };

    expect(() => GlobalManifestSchema.parse(invalidManifest)).toThrow();
  });

  it("rejects summaries without imageJsonUrl", () => {
    const invalidManifest = structuredClone(manifestJson) as Array<
      Record<string, unknown>
    >;

    delete invalidManifest[0].imageJsonUrl;

    expect(() => GlobalManifestSchema.parse(invalidManifest)).toThrow();
  });
});

describe("ImageSchema", () => {
  it("validates all checked-in image JSON files", async () => {
    const imageFiles = (await listJsonFiles(resolve(repoRoot, "public/artifacts"))).filter(
      (filePath) => filePath.endsWith("/image.json"),
    );

    expect(imageFiles.length).toBeGreaterThan(0);

    for (const imageFile of imageFiles) {
      const rawImage = await readFile(imageFile, "utf8");
      const parsedImage = JSON.parse(rawImage);

      expect(() => ImageSchema.parse(parsedImage)).not.toThrow();
    }
  });

  it("rejects image JSON without pixiLockUrl", () => {
    const invalidImage = structuredClone(openfeImageJson) as Record<string, unknown>;

    delete invalidImage.pixiLockUrl;

    expect(() => ImageSchema.parse(invalidImage)).toThrow();
  });

  it("rejects environment entries without environmentJsonUrl", () => {
    const invalidImage = structuredClone(openfeImageJson) as Record<string, unknown>;
    const environments = invalidImage.environments as Array<Record<string, unknown>>;

    delete environments[0].environmentJsonUrl;

    expect(() => ImageSchema.parse(invalidImage)).toThrow();
  });
});

describe("EnvironmentSchema", () => {
  it("validates all checked-in environment JSON files", async () => {
    const environmentFiles = (
      await listJsonFiles(resolve(repoRoot, "public/artifacts"))
    ).filter((filePath) => !filePath.endsWith("/image.json"));

    expect(environmentFiles.length).toBeGreaterThan(0);

    for (const environmentFile of environmentFiles) {
      const rawEnvironment = await readFile(environmentFile, "utf8");
      const parsedEnvironment = JSON.parse(rawEnvironment);

      expect(() => EnvironmentSchema.parse(parsedEnvironment)).not.toThrow();
    }
  });

  it("rejects environments without condaExplicitSpecUrl", () => {
    const invalidEnvironment = structuredClone(
      openfeTestEnvironmentJson,
    ) as Record<string, unknown>;

    delete invalidEnvironment.condaExplicitSpecUrl;

    expect(() => EnvironmentSchema.parse(invalidEnvironment)).toThrow();
  });

  it("rejects packages without source", () => {
    const invalidEnvironment = structuredClone(
      openfeTestEnvironmentJson,
    ) as Record<string, unknown>;
    const packages = invalidEnvironment.packages as Array<Record<string, unknown>>;

    delete packages[0].source;

    expect(() => EnvironmentSchema.parse(invalidEnvironment)).toThrow();
  });

  it("accepts buildId set to null", () => {
    const validEnvironment = structuredClone(
      openfeTestEnvironmentJson,
    ) as Record<string, unknown>;
    const packages = validEnvironment.packages as Array<Record<string, unknown>>;

    packages[0].buildId = null;

    expect(() => EnvironmentSchema.parse(validEnvironment)).not.toThrow();
  });

  it("rejects omitted buildId", () => {
    const invalidEnvironment = structuredClone(
      openfeTestEnvironmentJson,
    ) as Record<string, unknown>;
    const packages = invalidEnvironment.packages as Array<Record<string, unknown>>;

    delete packages[0].buildId;

    expect(() => EnvironmentSchema.parse(invalidEnvironment)).toThrow();
  });

  it("rejects unknown extra keys on strict objects", () => {
    const invalidEnvironment = structuredClone(
      openfeTestEnvironmentJson,
    ) as Record<string, unknown>;
    const packages = invalidEnvironment.packages as Array<Record<string, unknown>>;

    packages[0] = {
      ...packages[0],
      unexpected: "value",
    };

    expect(() => EnvironmentSchema.parse(invalidEnvironment)).toThrow();
  });
});

describe("export-schemas script", () => {
  it("emits the global manifest, image, and environment schemas", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "images-omsf-schemas-"));
    const scriptPath = resolve(repoRoot, "scripts/export-schemas.ts");

    await execFileAsync(
      "node",
      [
        "--experimental-strip-types",
        scriptPath,
        "--out-dir",
        outDir,
      ],
      { cwd: repoRoot },
    );

    const globalManifestSchemaJson = JSON.parse(
      await readFile(join(outDir, "global-manifest.schema.json"), "utf8"),
    );
    const imageSchemaJson = JSON.parse(
      await readFile(join(outDir, "image.schema.json"), "utf8"),
    );
    const environmentSchemaJson = JSON.parse(
      await readFile(join(outDir, "environment.schema.json"), "utf8"),
    );

    expect(globalManifestSchemaJson.type).toBe("array");
    expect(globalManifestSchemaJson.items).toBeDefined();
    expect(imageSchemaJson.type).toBe("object");
    expect(imageSchemaJson.properties).toHaveProperty("environments");
    expect(environmentSchemaJson.type).toBe("object");
    expect(environmentSchemaJson.properties).toHaveProperty("packages");
  });
});
