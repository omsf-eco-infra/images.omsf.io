import { z } from "astro/zod";

const NonEmptyString = z.string().min(1);

const PackageSourceSchema = z.enum(["conda", "pypi", "other"]);

const PackageVersionsSchema = z.record(z.string().nullable());

const InstalledPackageSchema = z
  .object({
    name: NonEmptyString,
    version: NonEmptyString,
    buildId: NonEmptyString.nullable(),
    source: PackageSourceSchema,
  })
  .strict();

const ImageEnvironmentReferenceSchema = z
  .object({
    name: NonEmptyString,
    platform: NonEmptyString,
    environmentJsonUrl: NonEmptyString,
  })
  .strict();

const ImageSummarySchema = z
  .object({
    name: NonEmptyString,
    timestamp: NonEmptyString,
    amiId: NonEmptyString,
    dockerImage: NonEmptyString,
    packageVersions: PackageVersionsSchema,
    imageJsonUrl: NonEmptyString,
  })
  .strict();

export const GlobalManifestSchema = z.array(ImageSummarySchema);

export const ImageSchema = ImageSummarySchema.extend({
  pixiLockUrl: NonEmptyString,
  environments: z.array(ImageEnvironmentReferenceSchema),
}).strict();

export const EnvironmentSchema = z
  .object({
    environmentYamlUrl: NonEmptyString,
    packages: z.array(InstalledPackageSchema),
  })
  .strict();

export type PackageSource = z.infer<typeof PackageSourceSchema>;
export type InstalledPackage = z.infer<typeof InstalledPackageSchema>;
export type ImageEnvironmentReference = z.infer<typeof ImageEnvironmentReferenceSchema>;
export type ImageSummary = z.infer<typeof ImageSummarySchema>;
export type GlobalManifest = z.infer<typeof GlobalManifestSchema>;
export type ImageRecord = z.infer<typeof ImageSchema>;
export type EnvironmentRecord = z.infer<typeof EnvironmentSchema>;
