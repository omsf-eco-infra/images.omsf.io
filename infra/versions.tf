terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 5.9.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {}

provider "github" {
  alias = "website"
  owner = local.website_owner
}

provider "github" {
  alias = "publisher"
  owner = local.publisher_owner
}
