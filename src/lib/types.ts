export type SourceType = "conda" | "pypi" | "other";

export interface SelectionPair {
  environment: string;
  platform: string;
}

export interface AmiManifestSelection extends SelectionPair {
  artifactUrl: string;
  packageCount: number;
}

export interface AmiManifestRecord {
  name: string;
  amiId: string;
  buildDatetime: string;
  lockfileUrl: string;
  keyPackages: Record<string, string | null>;
  defaultSelection?: SelectionPair;
  selections: AmiManifestSelection[];
}

export interface PackageRecord {
  name: string;
  version: string;
  build?: string;
  channel?: string;
  sourceType?: SourceType;
}

export interface AmiDetailArtifact {
  schemaVersion: 1;
  ami: {
    name: string;
    amiId: string;
    buildDatetime: string;
  };
  selection: SelectionPair;
  summary: {
    packageCount: number;
    keyPackages: Record<string, string | null>;
  };
  packages: PackageRecord[];
}
