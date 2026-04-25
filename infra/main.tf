locals {
  website_repository_parts   = split("/", var.website_repository)
  publisher_repository_parts = split("/", var.publisher_repository)
  website_owner              = local.website_repository_parts[0]
  publisher_owner            = local.publisher_repository_parts[0]
  account_resource           = "com.cloudflare.api.account.${var.cloudflare_account_id}"
}

module "cloudflare_pages" {
  source = "github.com/omsf/static-site-tools//modules/cloudflare_pages?ref=main"

  cloudflare_token_name   = var.cloudflare_pages_token_name
  cloudflare_project_name = var.cloudflare_project_name
  cloudflare_account_id   = var.cloudflare_account_id
  cf_compat_date          = var.cf_compat_date
}

module "github_vars" {
  source = "github.com/omsf/static-site-tools//modules/github_vars?ref=main"

  providers = {
    github = github.website
  }

  github_repository       = var.website_repository
  cloudflare_account_id   = var.cloudflare_account_id
  cloudflare_token        = module.cloudflare_pages.cloudflare_token
  cloudflare_project_name = var.cloudflare_project_name
}

resource "cloudflare_d1_database" "images" {
  account_id = var.cloudflare_account_id
  name       = var.d1_database_name
}

resource "cloudflare_r2_bucket" "artifacts" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_name
}

data "cloudflare_account_api_token_permission_groups_list" "d1_read" {
  account_id = var.cloudflare_account_id
  name       = "D1%20Read"
  scope      = "com.cloudflare.api.account"
}

data "cloudflare_account_api_token_permission_groups_list" "d1_write" {
  account_id = var.cloudflare_account_id
  name       = "D1%20Write"
  scope      = "com.cloudflare.api.account"
}

data "cloudflare_account_api_token_permission_groups_list" "r2_read" {
  account_id = var.cloudflare_account_id
  name       = "Workers%20R2%20Storage%20Read"
  scope      = "com.cloudflare.api.account"
}

data "cloudflare_account_api_token_permission_groups_list" "r2_write" {
  account_id = var.cloudflare_account_id
  name       = "Workers%20R2%20Storage%20Write"
  scope      = "com.cloudflare.api.account"
}

locals {
  publisher_permission_group_ids = [
    data.cloudflare_account_api_token_permission_groups_list.d1_read.result[0].id,
    data.cloudflare_account_api_token_permission_groups_list.d1_write.result[0].id,
    data.cloudflare_account_api_token_permission_groups_list.r2_read.result[0].id,
    data.cloudflare_account_api_token_permission_groups_list.r2_write.result[0].id,
  ]
}

resource "cloudflare_account_token" "publisher" {
  account_id = var.cloudflare_account_id
  name       = var.publisher_token_name

  policies = [{
    effect = "allow"
    permission_groups = [
      for permission_group_id in local.publisher_permission_group_ids : {
        id = permission_group_id
      }
    ]
    resources = {
      (local.account_resource) = "*"
    }
  }]

  depends_on = [
    cloudflare_d1_database.images,
    cloudflare_r2_bucket.artifacts,
  ]
}

data "github_repository" "publisher" {
  provider  = github.publisher
  full_name = var.publisher_repository
}

resource "github_actions_secret" "publisher_cloudflare_account_id" {
  provider        = github.publisher
  repository      = data.github_repository.publisher.name
  secret_name     = "CLOUDFLARE_ACCOUNT_ID"
  plaintext_value = var.cloudflare_account_id
}

resource "github_actions_secret" "publisher_cloudflare_api_token" {
  provider        = github.publisher
  repository      = data.github_repository.publisher.name
  secret_name     = "CLOUDFLARE_API_TOKEN"
  plaintext_value = cloudflare_account_token.publisher.value
}

resource "github_actions_secret" "publisher_images_r2_bucket" {
  provider        = github.publisher
  repository      = data.github_repository.publisher.name
  secret_name     = "IMAGES_R2_BUCKET"
  plaintext_value = cloudflare_r2_bucket.artifacts.name
}

resource "github_actions_secret" "publisher_images_d1_database_id" {
  provider        = github.publisher
  repository      = data.github_repository.publisher.name
  secret_name     = "IMAGES_D1_DATABASE_ID"
  plaintext_value = cloudflare_d1_database.images.id
}

resource "github_actions_secret" "publisher_images_r2_parent_access_key_id" {
  provider        = github.publisher
  repository      = data.github_repository.publisher.name
  secret_name     = "IMAGES_R2_PARENT_ACCESS_KEY_ID"
  plaintext_value = cloudflare_account_token.publisher.id
}
