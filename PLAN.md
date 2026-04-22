# PLAN

## Goal

Build a small, maintainable website that lets users browse published **images**
and inspect the software environments associated with each image.

Each published image can have:

- an AMI ID
- a Docker image reference
- a raw `pixi.lock`
- one or more environment/platform combinations
- one Pixi-generated conda explicit spec per environment/platform combination

The website should stay simple. The image-building repository should generate
the JSON consumed here.

---

## Current Direction

For MVP, the viewer contract is a simple three-level JSON model:

1. **Global manifest**
   - a JSON list of image summaries
   - used to render the landing page
   - each summary is the future shape of one D1 row

2. **Image JSON**
   - one JSON file per image
   - used to render the image page shell
   - includes the image summary fields, `pixiLockUrl`, and the list of
     available environments

3. **Environment JSON**
   - one JSON file per environment/platform pair
   - used to render the package list for the current selection
   - includes `condaExplicitSpecUrl` and the installed package list

This repo owns the viewer, fixtures, schemas, and tests for that contract.

---

## Contract

### 1. Global manifest

The global manifest stays at:

```text
src/data/manifest.json
```

It is a JSON array of image summaries.

Each image summary contains:

- `name`
- `timestamp`
- `amiId`
- `dockerImage`
- `packageVersions`
- `imageJsonUrl`

This is what the landing page uses, and it is also the shape we should expect
to mirror in D1 later.

### 2. Image JSON

Each image has one image JSON file:

```text
public/artifacts/<image-name>/image.json
```

Each image JSON contains:

- `name`
- `timestamp`
- `amiId`
- `dockerImage`
- `packageVersions`
- `imageJsonUrl`
- `pixiLockUrl`
- `environments`

Each environment entry contains:

- `name`
- `platform`
- `environmentJsonUrl`

The image page should use the first entry in `environments` as the default
selection.

### 3. Environment JSON

Each environment/platform pair has one environment JSON file:

```text
public/artifacts/<image-name>/<environment>-<platform>.json
```

Each environment JSON contains:

- `condaExplicitSpecUrl`
- `packages`

Each package contains:

- `name`
- `version`
- `buildId`
- `source`

`buildId` is always present but may be `null`.

---

## Website Behavior

### Landing page

The landing page should be driven entirely by the global manifest.

It should show:

- image name
- timestamp
- AMI ID
- Docker image
- summary package versions
- a link to the image detail page

### Image page

The image page should load its shell from the linked image JSON.

It should show:

- image name
- timestamp
- AMI ID
- Docker image
- a link to `pixi.lock`
- the summary package versions
- environment and platform selectors

When the current selection changes, the page should fetch the linked
environment JSON and use that to render:

- the current conda explicit spec link
- the package table
- the package count

---

## Storage Shape

The placeholder R2-like layout should be:

```text
manifest.json
lockfiles/<image-name>.pixi.lock
artifacts/<image-name>/image.json
artifacts/<image-name>/<environment>-<platform>.json
artifacts/<image-name>/<environment>-<platform>/<environment>-<platform>.conda-spec.txt
```

This keeps the viewer contract file-based and simple.

---

## Responsibilities

### Image-building repo

The producer repo should own:

- reading `pixi.lock`
- collecting image metadata
- capturing the AMI ID and Docker image
- generating the global manifest, image JSON, and environment JSON
- generating or copying the matching Pixi conda explicit spec
- uploading all files to R2
- updating the manifest last
- triggering a site rebuild after publish

This should be implemented in Python.

### This repo

This repo should own:

- the Astro UI
- the Zod schemas and emitted JSON Schema files
- local placeholder fixtures
- tests that validate the contract and the viewer behavior

This repo should not own the production publish pipeline.

---

## Future D1 Direction

D1 is not part of the current viewer contract.

If we later move the landing-page index into D1:

- each item in the global manifest becomes one D1 row
- the image JSON and environment JSON files can stay in R2
- the site can switch its landing-page source from `manifest.json` to D1
  without changing the image/environment document shapes

That is why the global manifest summary shape should stay intentionally small
and stable.
