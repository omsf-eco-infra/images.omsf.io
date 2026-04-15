import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import zodToJsonSchema from "zod-to-json-schema";
import {
  EnvironmentSchema,
  GlobalManifestSchema,
  ImageSchema,
} from "../src/lib/schema.ts";

interface ParsedArgs {
  outDir: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key?.startsWith("--") || !value) {
      throw new Error("Usage: export-schemas [--out-dir <dir>]");
    }

    args.set(key, value);
  }

  return {
    outDir: resolve(args.get("--out-dir") ?? "schemas"),
  };
}

async function writeSchemaFile(path: string, schema: object): Promise<void> {
  await writeFile(path, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const { outDir } = parseArgs(process.argv.slice(2));

  await mkdir(outDir, { recursive: true });

  const globalManifestSchemaJson = zodToJsonSchema(GlobalManifestSchema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  });
  const imageSchemaJson = zodToJsonSchema(ImageSchema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  });
  const environmentSchemaJson = zodToJsonSchema(EnvironmentSchema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  });

  await writeSchemaFile(
    resolve(outDir, "global-manifest.schema.json"),
    globalManifestSchemaJson,
  );
  await writeSchemaFile(resolve(outDir, "image.schema.json"), imageSchemaJson);
  await writeSchemaFile(
    resolve(outDir, "environment.schema.json"),
    environmentSchemaJson,
  );

  process.stdout.write(`Wrote schemas to ${outDir}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
