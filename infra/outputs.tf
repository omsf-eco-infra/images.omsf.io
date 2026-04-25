output "website_repository" {
  description = "GitHub repository that receives the Cloudflare Pages deployment secrets and variables."
  value       = var.website_repository
}

output "publisher_repository" {
  description = "GitHub repository that receives the image publisher secrets."
  value       = var.publisher_repository
}

output "cloudflare_pages_subdomain" {
  description = "Cloudflare Pages generated subdomain for the website."
  value       = module.cloudflare_pages.cloudflare_subdomain
}

output "d1_database_id" {
  description = "Cloudflare D1 database ID for the future image index."
  value       = cloudflare_d1_database.images.id
}

output "d1_database_name" {
  description = "Cloudflare D1 database name for the future image index."
  value       = cloudflare_d1_database.images.name
}

output "r2_bucket_name" {
  description = "Cloudflare R2 bucket name for future image artifacts."
  value       = cloudflare_r2_bucket.artifacts.name
}

output "publisher_r2_parent_access_key_id" {
  description = "Parent access key ID stored in the publisher repo as IMAGES_R2_PARENT_ACCESS_KEY_ID."
  value       = cloudflare_account_token.publisher.id
  sensitive   = true
}
