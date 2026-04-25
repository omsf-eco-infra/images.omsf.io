# images.omsf.io infrastructure

This OpenTofu root creates the empty Cloudflare infrastructure for
`images.omsf.io` without changing the application runtime.

## Resources

- Cloudflare Pages project for static site deployments.
- Cloudflare D1 database for the future image index.
- Cloudflare R2 bucket for future image artifacts.
- Cloudflare API token for website Pages deployments.
- Cloudflare API token for publisher writes to D1/R2.
- GitHub Actions secrets and variables for:
  - `omsf-eco-infra/images.omsf.io`
  - `omsf-eco-infra/ami-builder`

## Required credentials

Run OpenTofu with:

- `CLOUDFLARE_API_TOKEN`: an admin/bootstrap token that can create Pages
  projects, D1 databases, R2 buckets, account API tokens, and list token
  permission groups.
- `GITHUB_TOKEN`: a token that can manage Actions secrets and variables in the
  target repositories.
- `TF_VAR_cloudflare_account_id`: the Cloudflare account ID.

Repository targets default to:

- `website_repository = "omsf-eco-infra/images.omsf.io"`
- `publisher_repository = "omsf-eco-infra/ami-builder"`

## Commands

```bash
tofu -chdir=infra init
tofu -chdir=infra plan
tofu -chdir=infra apply
```

For local static validation without a backend:

```bash
tofu -chdir=infra init -backend=false
tofu -chdir=infra validate
tofu fmt -recursive infra
```

## Managed GitHub values

The website repository receives the standard static-site-tools values:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_PROJECT_NAME`
- `MAIN_REPO`

The publisher repository receives:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `IMAGES_R2_BUCKET`
- `IMAGES_D1_DATABASE_ID`
- `IMAGES_R2_PARENT_ACCESS_KEY_ID`

The D1 database and R2 bucket are intentionally empty in this phase.

## Provider version

This local root pins `cloudflare/cloudflare` to `5.9.0`.

That version still models `cloudflare_account_token.policies[].resources` as a
Terraform map, which matches the current `omsf/static-site-tools`
`cloudflare_pages` module. Later v5 releases changed that field to a JSON
string in the provider schema.
