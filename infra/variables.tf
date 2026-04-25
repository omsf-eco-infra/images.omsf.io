variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Pages project, D1 database, R2 bucket, and generated API tokens."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.cloudflare_account_id))
    error_message = "cloudflare_account_id must be a 32-character lowercase hexadecimal Cloudflare account ID."
  }
}

variable "website_repository" {
  description = "GitHub repository that receives the Cloudflare Pages deployment secrets and variables, in OWNER/REPO format."
  type        = string
  default     = "omsf-eco-infra/images.omsf.io"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.website_repository))
    error_message = "website_repository must be in OWNER/REPO format."
  }
}

variable "publisher_repository" {
  description = "GitHub repository that receives the image publisher secrets, in OWNER/REPO format."
  type        = string
  default     = "omsf-eco-infra/ami-builder"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.publisher_repository))
    error_message = "publisher_repository must be in OWNER/REPO format."
  }
}

variable "cloudflare_project_name" {
  description = "Cloudflare Pages project name."
  type        = string
  default     = "images-omsf-io"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", var.cloudflare_project_name))
    error_message = "cloudflare_project_name must be a lowercase hyphen-safe name."
  }
}

variable "cloudflare_pages_token_name" {
  description = "Name of the generated Cloudflare API token used by GitHub Actions to deploy Pages."
  type        = string
  default     = "images-omsf-io-pages-deploy"

  validation {
    condition     = trimspace(var.cloudflare_pages_token_name) != ""
    error_message = "cloudflare_pages_token_name must be non-empty."
  }
}

variable "publisher_token_name" {
  description = "Name of the generated Cloudflare API token used by the publisher workflow to write image artifacts and index rows."
  type        = string
  default     = "images-omsf-io-publisher"

  validation {
    condition     = trimspace(var.publisher_token_name) != ""
    error_message = "publisher_token_name must be non-empty."
  }
}

variable "d1_database_name" {
  description = "Cloudflare D1 database name for the future image index."
  type        = string
  default     = "images-omsf-io-index"

  validation {
    condition     = trimspace(var.d1_database_name) != ""
    error_message = "d1_database_name must be non-empty."
  }
}

variable "r2_bucket_name" {
  description = "Cloudflare R2 bucket name for future image artifacts."
  type        = string
  default     = "images-omsf-io-artifacts"

  validation {
    condition = (
      can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.r2_bucket_name)) &&
      length(var.r2_bucket_name) >= 3 &&
      length(var.r2_bucket_name) <= 64
    )
    error_message = "r2_bucket_name must be 3-64 characters and use lowercase letters, numbers, dots, or hyphens."
  }
}

variable "cf_compat_date" {
  description = "Optional Cloudflare compatibility date passed through to the static-site-tools Pages module. Leave empty to use first apply date."
  type        = string
  default     = ""

  validation {
    condition     = var.cf_compat_date == "" || can(regex("^\\d{4}-\\d{2}-\\d{2}$", var.cf_compat_date))
    error_message = "cf_compat_date must be empty or in YYYY-MM-DD format."
  }
}
