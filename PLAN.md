# PLAN

## Goal

Build a website that lets users inspect `pixi.lock` files associated with AMIs built on specific dates.

The site should support two main workflows:

1. **Landing page**: list available AMIs and highlight a small set of important package versions for a chosen environment and platform.
2. **AMI detail page**: for a selected AMI, let the user choose an environment and platform, then browse the full dependency list.

The production system is expected to use:

- **Cloudflare R2** for storing lockfiles
- **Cloudflare D1** for storing an index / metadata used to drive the UI

For early development, it should also work against **local files**.

---

## Product scope

### In scope

- Read and parse `pixi.lock`
- Represent AMIs, environments, platforms, and package records in a UI-friendly shape
- Show a browsable AMI index
- Show a detail page per AMI
- Support local development without requiring Cloudflare resources
- Support later migration to R2 + D1 with minimal architectural churn

### Out of scope for MVP

- Full-text search across dependency names
- User auth
- Editing lockfiles
- Uploading lockfiles from the browser
- Arbitrary comparison views between AMIs
- Complex filtering beyond environment/platform/package-name sorting

---

## Assumptions

- Each AMI corresponds to one lockfile snapshot
- Each lockfile may contain multiple pixi environments
- Each environment may contain multiple platforms
- The set of “key packages” shown on the landing page is configurable by us
- AMI name is the canonical public identifier used in URLs and UI
- The landing page summary environment is **`omsf`**
- The landing page summary platform is **Linux x86-64**
- The highlighted landing-page packages are **OpenFold**, **OpenFE**, and **OpenFF-Toolkit**
- The site should make the lockfile directly downloadable
- Lockfiles are trusted internal data, so strict hostile-input hardening is less important than clarity and maintainability

---

## User experience

### 1. Landing page

The landing page should:

- list AMIs in reverse chronological order
- show AMI name as the primary identifier
- show AMI ID as reference metadata
- show build date/time
- show a few important package versions from the summary environment/platform (`omsf` on Linux x86-64)
- link to the detail page for that AMI
- provide a direct download link for the lockfile

A likely table layout:

| Build date | AMI name | AMI ID | OpenFold | OpenFE | OpenFF-Toolkit | Lockfile | Details |
|---|---|---|---:|---:|---:|---|---|

Possible enhancements later:

- sort by date / label
- filter by date range
- show latest AMI badge
- show missing-package indicator when a summary package is absent in the selected env/platform

### 2. AMI detail page

The detail page should:

- identify the AMI clearly at the top
- show AMI name, AMI ID, build date/time, and lockfile download link
- provide an **environment select**
- provide a **platform select**
- provide a **package-name text filter**
- render the full dependency list for the selected combination
- allow sorting by package name initially

Likely page sections:

1. Header with AMI metadata
2. Controls row with environment + platform selects + package-name filter
3. Summary strip with package count and the highlighted package versions for the current selection
4. Dependency table

A likely dependency table layout:

| Package | Version | Build | Source / Channel | Kind |
|---|---:|---|---|---|

Where available, “Kind” might distinguish conda / pypi / other sources if the lockfile structure exposes that cleanly.

---

## Architecture principles

1. **Keep the frontend simple**
2. **Do not over-couple rendering to storage**
3. **Separate parsing from persistence**
4. **Have one canonical normalized internal model** derived from `pixi.lock`
5. **Support both local-file and Cloudflare-backed data sources behind the same interface**

---

## Framework choice

We will use **Astro + TypeScript**.

Why it fits:

- very good for mostly content-like pages with a small amount of interactivity
- can ship mostly static HTML with small islands of client-side JS only where needed
- can be used as a static site builder initially, and later add Cloudflare-backed on-demand routes if needed
- friendly developer experience for simple pages and route-based structure

How it will likely be used here:

- landing page rendered server-side / at build time from indexed data
- AMI detail page rendered with server data and small client-side interactivity for the selects and package filter
- shared parser and data-access modules in TypeScript

## Recommended high-level design

### Application layers

1. **Parser layer**
   - reads raw `pixi.lock`
   - converts to normalized internal model

2. **Repository / data-source layer**
   - `LocalFileRepository`
   - `CloudflareRepository`
   - both expose the same interface

3. **Service layer**
   - builds landing-page summaries
   - resolves AMI detail data
   - applies default environment/platform selection

4. **Presentation layer**
   - landing page
   - AMI detail page
   - small client-side behavior for selects and table updates

---

## Data model to normalize toward

We should not render directly from raw `pixi.lock` shape. Instead, normalize into something like:

```ts
interface AmiRecord {
  id: string; // internal AMI ID
  name: string; // canonical public identifier used in route/UI
  buildDate: string; // ISO datetime
  sourceKey: string; // R2 key or local path
  downloadUrl?: string;
  metadata?: AmiMetadata;
  environments: EnvironmentRecord[];
}

interface AmiMetadata {
  amiId: string;
  buildWorkflowRunId?: string;
  sourceCommitSha?: string;
  baseImage?: string;
  notes?: string;
}

interface EnvironmentRecord {
  name: string;
  platforms: PlatformRecord[];
}

interface PlatformRecord {
  platform: string;
  packages: PackageRecord[];
}

interface PackageRecord {
  name: string;
  version: string;
  build?: string;
  channel?: string;
  sourceType?: "conda" | "pypi" | "other";
}
```

We may also want a lighter summary projection:

```ts
interface AmiSummary {
  id: string;
  name: string;
  buildDate: string;
  amiId: string;
  lockfileDownloadUrl?: string;
  summaryEnvironment: string;
  summaryPlatform: string;
  keyPackages: Record<string, string | null>;
}
```

---

## Storage model

### Initial local mode

Use a local directory layout, for example:

```text
./data/
  manifest.json
  lockfiles/
    2026-03-01-ami-xyz.pixi.lock
    2026-03-15-ami-abc.pixi.lock
```

Where `manifest.json` maps AMI names / IDs / build dates to lockfile paths and optional metadata.

This keeps local iteration easy and avoids prematurely depending on D1.

### Production mode

#### R2

Store raw lockfiles and derived detail JSON in R2, using a date + AMI-name prefix:

```text
YYYY-MM-DD/$AMI_NAME/pixi.lock
YYYY-MM-DD/$AMI_NAME/$ENVIRONMENT-$PLATFORM.json
```

#### D1

Use D1 for the browseable index and summary metadata.

Possible tables:

##### `amis`

- `name` (primary key; canonical public identifier)
- `ami_id`
- `build_datetime`
- `r2_key`
- `lockfile_filename`
- `created_at`
- optional metadata columns

##### `ami_summaries`

- `ami_name`
- `environment_name`
- `platform`
- `package_name`
- `version`

This table would only contain the configured key packages for landing-page display.

##### Optional: `ami_env_platforms`

- `ami_name`
- `environment_name`
- `platform`
- `package_count`

This can speed up detail-page control population without reading the full lockfile first.

### Important design choice

For the full dependency table, we likely **do not need to denormalize every package into D1** for MVP.

A good split is:

- D1 stores AMI index and summary metadata
- R2 stores the raw lockfile as the downloadable source of truth
- R2 also stores precomputed normalized JSON artifacts for detail-page reads
- detail page fetches a separate JSON artifact for the selected environment/platform

That keeps D1 compact, keeps downloads simple, and avoids reparsing large lockfiles at request time.

---

## Data ingestion plan

We likely need an ingestion script / pipeline that:

1. discovers a new lockfile
2. parses it
3. extracts AMI metadata
4. computes landing-page summary values
5. uploads raw lockfile to R2
6. emits one normalized JSON artifact per environment/platform selection to R2
7. writes or updates D1 index rows

For local development, the same parser should run against files on disk.

### Recommendation

Create a standalone ingestion module that can run in two modes:

- **local seed mode**
- **Cloudflare publish mode**

This should be separate from the website runtime.

In Cloudflare publish mode, it should upload:

- the raw `pixi.lock`
- one JSON file per environment/platform
- the corresponding D1 index and summary rows

---

## API / data access shape

Even if the site is mostly server-rendered, we should define a stable internal API shape.

Possible methods:

```ts
interface AmiRepository {
  listAmiSummaries(): Promise<AmiSummary[]>;
  getAmi(name: string): Promise<AmiRecord | null>;
  listEnvironmentPlatforms(name: string): Promise<Array<{ environment: string; platform: string }>>;
}
```

For a richer service layer:

```ts
interface AmiService {
  listLandingPageRows(): Promise<AmiSummary[]>;
  getAmiDetail(name: string): Promise<AmiRecord | null>;
  getDefaultSelection(ami: AmiRecord): { environment: string; platform: string };
}
```

---

## Rendering strategy

### Landing page

Prefer server-rendered HTML.

Reasons:

- simple table
- SEO-friendly, though SEO is probably not critical
- minimal JS
- fast first load

### AMI detail page

Also prefer server-rendered initial HTML, then hydrate a very small client script for:

- reacting to environment select changes
- reacting to platform select changes
- re-rendering the dependency table or swapping preloaded data

### Data loading for detail page

Use server-rendered initial HTML for AMI metadata and default selection, then fetch a separate JSON payload when the user changes environment or platform.

Why this is a good fit here:

- keeps initial page weight smaller for large dependency sets
- avoids embedding the full lockfile-derived package graph in the page
- keeps each response aligned to one environment/platform pair
- matches the planned R2 artifact layout naturally

### Recommendation

Use one JSON artifact per environment/platform pair for MVP.

After MVP, we should test whether a single per-AMI payload with client-side filtering is simpler or faster in practice.

---

## URL structure

Suggested routes:

```text
/
/amis/[name]
```

Potential future routes:

```text
/api/amis
/api/amis/[name]
/api/amis/[name]/packages?environment=...&platform=...
```

Even if these APIs are internal-only at first, defining them cleanly will help.

---

## Configuration needed

We should centralize configuration for:

- default summary environment (`omsf`)
- default summary platform (`linux-64`, or whatever exact pixi platform string corresponds to Linux x86-64)
- key packages shown on landing page (`OpenFold`, `OpenFE`, `OpenFF-Toolkit`)
- AMI display naming rules
- sort order rules

Something like:

```ts
interface SiteConfig {
  summaryEnvironment: string;
  summaryPlatform: string;
  keyPackages: string[];
}
```

---

## Error handling and edge cases

We should explicitly plan for:

- missing summary environment in a lockfile
- missing summary platform in an environment
- key package not present
- lockfile parse failures
- duplicate AMI IDs
- multiple lockfiles with same build date
- environment names that differ slightly across AMIs
- platforms present in some environments but not others
- very large dependency sets that make client-side rendering/filtering slow

UI behavior should degrade gracefully:

- show `—` for missing summary values
- show a clear empty state when an env/platform pair has no packages
- avoid 500-like behavior for malformed records where possible

---

## Testing plan

### Parser tests

- parse representative real lockfiles
- verify environment/platform/package extraction
- verify package version extraction for key packages
- verify behavior on malformed or partial input

### Repository tests

- local repository returns expected records from fixture directory
- cloud repository behavior can be tested behind mocks or thin adapters

### Service tests

- landing page rows derived correctly
- default selection logic is stable

### UI tests

- landing page renders AMI table
- detail page switches environment/platform correctly
- dependency table updates correctly

---

## Developer workflow proposal

The implementation plan should be split into PR-sized phases. Each phase should deliver a coherent milestone that can be reviewed independently.

### Phase 1: Project skeleton and local fixture flow

Set up the Astro + TypeScript app, basic directory layout, shared types, and a tiny local-fixture data path. The goal is to get the app running against checked-in sample data, even if nothing is pretty yet.

**Includes**

- [ ] Astro project setup
- [ ] Base routes in place
- [ ] Shared TypeScript interfaces
- [ ] Local manifest loading
- [ ] One or two fixture lockfiles and derived JSON samples
- [ ] Placeholder landing and detail pages wired end-to-end

**Deliverable**

- [ ] A running Astro app using local sample data with placeholder landing and detail pages

Why this is a good first PR:

- validates the framework choice
- gives a visible app immediately
- keeps risk low before parser and Cloudflare work

### Phase 2: Parser and normalized artifact generation

Implement the `pixi.lock` parser and the normalization logic that produces the accepted JSON schema and summary-package extraction.

**Includes**

- [ ] Parser for real `pixi.lock`
- [ ] Extraction of environment/platform combinations
- [ ] Extraction of package records
- [ ] Extraction of key-package summaries for `omsf` + `linux-64`
- [ ] Tests against representative lockfiles

**Deliverable**

- [ ] A script that can turn a lockfile into the accepted per-selection JSON artifacts plus summary metadata

Why separate this:

- parsing is the highest uncertainty area
- easier to review and test in isolation

### Phase 3: Local repository and real page rendering

Replace placeholder data flow with real repository/service logic using local files and generated artifacts. Make both pages functional in local mode.

**Includes**

- [ ] `LocalFileRepository`
- [ ] Service-layer methods for the landing page and detail page
- [ ] Landing page table with real data
- [ ] Detail page with real metadata, default selection, package filter, and dependency table
- [ ] Lockfile download link in local mode
- [ ] Copy button for AMI ID

**Deliverable**

- [ ] A fully usable local MVP with no Cloudflare dependency

Why this should be its own PR:

- it is the first real product milestone
- keeps UI/repository integration reviewable without deployment complexity

### Phase 4: D1 schema and Cloudflare repository

Add the production data-access layer and create the D1 schema in code and migrations.

**Includes**

- [ ] D1 migration for `amis`
- [ ] D1 migration for `ami_summary_packages`
- [ ] D1 migration for `ami_detail_artifacts`
- [ ] `CloudflareRepository`
- [ ] Configuration for switching between local and Cloudflare-backed repositories
- [ ] Local development support for D1 via Wrangler as needed

**Deliverable**

- [ ] Production-shaped data access, even if ingestion is not fully wired yet

Why separate this:

- database and environment setup are review-heavy and easier to reason about alone

### Phase 5: Ingestion and publish pipeline

Implement the script used by GitHub Actions to publish raw lockfiles and JSON artifacts to R2 and upsert D1 rows.

**Includes**

- [ ] Ingestion CLI or script
- [ ] R2 upload logic
- [ ] D1 upsert and replace logic
- [ ] Handling for repeated publishes of the same AMI name
- [ ] Failure behavior and validation
- [ ] Tests for artifact and key generation

**Deliverable**

- [ ] Given AMI metadata and a lockfile path, the system can publish all required artifacts

Why this deserves its own PR:

- this is the core bridge from AMI build outputs to the website
- touches persistence and deployment behavior

### Phase 6: GitHub Actions integration

Wire the AMI build workflow to call the ingestion and publish script with the finalized contract.

**Includes**

- [ ] Workflow inputs and environment wiring
- [ ] Credentials and bindings setup
- [ ] Upload and publish invocation
- [ ] Failure and reporting behavior in CI

**Deliverable**

- [ ] Scheduled AMI builds automatically update the site’s backing data

Why separate this:

- keeps CI/CD changes isolated from app logic
- easier to review operational concerns independently

### Phase 7: MVP polish and hardening

Clean up the user experience and fill the obvious rough edges before calling it MVP-complete.

**Includes**

- [ ] Loading and error states on detail-page JSON fetches
- [ ] Empty-state handling for missing package matches
- [ ] Copy-button UX polish
- [ ] Formatting of timestamps
- [ ] Basic styling cleanup
- [ ] Smoke tests and regression tests
- [ ] Documentation for local development and publishing

**Deliverable**

- [ ] A presentable MVP rather than a technically complete prototype

## Suggested directory structure

If using Astro:

```text
src/
  pages/
    index.astro
    amis/
      [id].astro
  components/
    AmiTable.astro
    AmiHeader.astro
    DependencyTable.astro
    SelectionControls.astro
  lib/
    config.ts
    parser/
      pixi-lock.ts
      normalize.ts
    repositories/
      types.ts
      local.ts
      cloudflare.ts
    services/
      ami-service.ts
    types.ts
scripts/
  ingest.ts
data/
  manifest.json
  lockfiles/
```

If using plain Vite, the same logical split still applies.

---

## Recommendation summary

### Preferred stack

- **Astro** for the site
- **TypeScript** throughout
- **local manifest + local lockfiles** for early development
- later **R2 for raw lockfiles** and **D1 for index/summary metadata**
- standalone **ingestion script** to compute summaries and populate D1
- package-name filter on the AMI detail page
- direct lockfile downloads from both landing and detail pages

### Why this is a good fit

- simple pages
- minimal client-side interactivity
- good local developer experience
- easy path from local files to Cloudflare-backed production
- avoids overengineering the first version

---

## Open questions to resolve before handoff

No major open product questions remain for the MVP. The remaining work is implementation planning and execution detail.

## Likely next additions to this plan

After answering the open questions, we should probably add:

- a concrete schema for D1
- a concrete normalized JSON schema
- a parser implementation sketch
- route-by-route implementation notes
- ingestion workflow details
- deployment notes for Cloudflare
- concrete R2 object examples using the chosen key layout
- decision notes on per-selection JSON payloads vs single per-AMI payloads after MVP


---

## Finalized MVP decisions

These decisions are now fixed for the MVP unless we explicitly revise them later.

- Framework: **Astro + TypeScript**
- Canonical public identifier: **AMI name**
- Core metadata shown to users: **AMI name**, **AMI ID**, **build datetime**
- Lockfile availability: **raw `pixi.lock` must be downloadable**
- Summary environment: **`omsf`**
- Summary platform: **`linux-64`**
- Highlighted landing-page packages: **OpenFold**, **OpenFE**, **OpenFF-Toolkit**
- Landing-page AMI ID behavior: **show directly and provide a copy button**
- Detail-page table behavior: **package-name text filter only; no sorting in MVP**
- Detail-page data loading: **fetch a separate JSON artifact for each environment/platform selection**
- Storage split:
  - **R2** stores the raw lockfile and the per-selection JSON artifacts
  - **D1** stores the AMI index, landing-page summary metadata, and the mapping to per-selection JSON artifacts
- Retention policy: **retain artifacts indefinitely**

### Chosen R2 key layout

```text
YYYY-MM-DD/$AMI_NAME/pixi.lock
YYYY-MM-DD/$AMI_NAME/$ENVIRONMENT-$PLATFORM.json
```

Example:

```text
2026-04-03/openfe-2026-04-03/pixi.lock
2026-04-03/openfe-2026-04-03/omsf-linux-64.json
2026-04-03/openfe-2026-04-03/omsf-osx-arm64.json
2026-04-03/openfe-2026-04-03/docs-linux-64.json
```

---

## Proposed D1 schema

D1 should stay intentionally small and support only:

- listing AMIs on the landing page
- showing the key-package summary values for the configured summary environment/platform
- resolving where the raw lockfile and detail JSON artifacts live in R2

### Table: `amis`

Purpose:

- one row per AMI / lockfile snapshot
- stores the metadata needed for the landing page and detail-page header

Suggested columns:

```sql
CREATE TABLE amis (
  name TEXT PRIMARY KEY,
  ami_id TEXT NOT NULL,
  build_datetime TEXT NOT NULL,
  build_date TEXT NOT NULL,
  lockfile_r2_key TEXT NOT NULL,
  summary_environment TEXT NOT NULL DEFAULT 'omsf',
  summary_platform TEXT NOT NULL DEFAULT 'linux-64',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Suggested indexes:

```sql
CREATE INDEX idx_amis_build_datetime ON amis(build_datetime DESC);
CREATE INDEX idx_amis_ami_id ON amis(ami_id);
```

Notes:

- `name` is the canonical public identifier and route key
- `build_datetime` should be stored as an ISO-8601 UTC timestamp
- `build_date` is denormalized for easier prefix construction and simpler querying

### Table: `ami_summary_packages`

Purpose:

- stores only the highlighted landing-page package versions for one configured environment/platform
- avoids any need to query large package sets from D1

Suggested columns:

```sql
CREATE TABLE ami_summary_packages (
  ami_name TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  package_name TEXT NOT NULL,
  version TEXT,
  PRIMARY KEY (ami_name, environment_name, platform, package_name),
  FOREIGN KEY (ami_name) REFERENCES amis(name) ON DELETE CASCADE
);
```

Suggested indexes:

```sql
CREATE INDEX idx_ami_summary_packages_lookup
  ON ami_summary_packages(ami_name, environment_name, platform);
```

Notes:

- `version` may be `NULL` if we want to explicitly record “package absent” during ingestion
- for MVP, I prefer **omitting absent rows** and letting the app render `—` when a key package row is missing

### Table: `ami_detail_artifacts`

Purpose:

- maps each AMI/environment/platform selection to the corresponding JSON artifact in R2
- lets the detail page populate environment and platform selects without listing R2 objects directly
- gives the application a fast lookup from a user selection to the exact JSON artifact that should be fetched

One row exists for each valid combination of:

- AMI
- environment
- platform

For example, if one AMI has:

- `omsf` on `linux-64`
- `omsf` on `osx-arm64`
- `docs` on `linux-64`

then that AMI would have three rows in `ami_detail_artifacts`.

Suggested columns:

```sql
CREATE TABLE ami_detail_artifacts (
  ami_name TEXT NOT NULL,
  environment_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  json_r2_key TEXT NOT NULL,
  package_count INTEGER NOT NULL,
  PRIMARY KEY (ami_name, environment_name, platform),
  FOREIGN KEY (ami_name) REFERENCES amis(name) ON DELETE CASCADE
);
```

Suggested indexes:

```sql
CREATE INDEX idx_ami_detail_artifacts_ami_name
  ON ami_detail_artifacts(ami_name);
```

Notes:

- `json_r2_key` is the exact object key for the per-selection artifact, such as `2026-04-03/openfe-2026-04-03/omsf-linux-64.json`
- `package_count` is useful for the detail-page summary strip and for the current selection UI
- this table drives the available values in the environment/platform selects
- keeping `json_r2_key` in D1 avoids coupling the web app to R2 key construction rules at runtime and makes future storage-layout changes easier

### Why this D1 schema is a good fit

- minimal surface area
- no giant dependency table in D1
- enough metadata to drive both pages cleanly
- easy to rebuild from lockfiles if needed
- easy to evolve later if comparison features are added

---

## Proposed normalized JSON schema

The per-selection JSON should be designed for direct use by the AMI detail page.

One file corresponds to one:

- AMI
- environment
- platform

Suggested shape:

```json
{
  "schemaVersion": 1,
  "ami": {
    "name": "example-ami-name",
    "amiId": "ami-0123456789abcdef0",
    "buildDatetime": "2026-04-03T12:34:56Z"
  },
  "selection": {
    "environment": "omsf",
    "platform": "linux-64"
  },
  "summary": {
    "packageCount": 1234,
    "keyPackages": {
      "OpenFold": "1.2.3",
      "OpenFE": "0.9.1",
      "OpenFF-Toolkit": "0.16.7"
    }
  },
  "packages": [
    {
      "name": "numpy",
      "version": "2.3.0",
      "build": "py312h1234567_0",
      "channel": "conda-forge",
      "sourceType": "conda"
    },
    {
      "name": "openfe",
      "version": "0.9.1",
      "sourceType": "pypi"
    }
  ]
}
```

### Suggested TypeScript interface

```ts
interface AmiDetailArtifact {
  schemaVersion: 1;
  ami: {
    name: string;
    amiId: string;
    buildDatetime: string;
  };
  selection: {
    environment: string;
    platform: string;
  };
  summary: {
    packageCount: number;
    keyPackages: Record<string, string | null>;
  };
  packages: PackageRecord[];
}
```

### Package record shape

```ts
interface PackageRecord {
  name: string;
  version: string;
  build?: string;
  channel?: string;
  sourceType?: "conda" | "pypi" | "other";
}
```

### JSON design notes

- include `schemaVersion` from day one so format changes later are manageable
- include AMI metadata redundantly in each JSON artifact to make the file self-describing
- keep the package shape intentionally narrow for MVP
- package-name filtering should be case-insensitive in the UI

---

## Finalized ingestion contract from GitHub Actions

The scheduled AMI-build workflow should invoke a publish/index script after the AMI metadata and `pixi.lock` are available.

Minimum inputs to that script:

- `ami_name`
- `ami_id`
- `build_datetime`
- `lockfile_path`
- Cloudflare credentials / bindings needed to write R2 and D1

Optional inputs are not required for MVP because these values are currently fixed in the application configuration:

- `summary_environment` = `omsf`
- `summary_platform` = `linux-64`
- `key_packages` = `OpenFold,OpenFE,OpenFF-Toolkit`

Suggested behavior:

1. parse the lockfile
2. upload raw `pixi.lock` to the expected R2 key
3. generate one JSON artifact per environment/platform and upload each to R2
4. upsert the `amis` row
5. replace the `ami_summary_packages` rows for that AMI
6. replace the `ami_detail_artifacts` rows for that AMI
7. fail the workflow clearly if required metadata is missing

---

## Schema recommendations summary

For MVP, I recommend:

- **3 D1 tables**: `amis`, `ami_summary_packages`, `ami_detail_artifacts`
- **1 JSON file per environment/platform selection**
- no full package inventory in D1
- no comparison-oriented schema yet
- no retention cleanup logic

