variable "region" {
  type    = string
  default = "ap-northeast-2"
}
variable "name" {
  type    = string
  default = "study"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.name))
    error_message = "Use 3-20 lowercase letters, digits and hyphens."
  }
}
variable "zone_id" { type = string }
variable "domain" {
  type        = string
  description = "Owned DNS name, e.g. study.example.com. origin. and api. subdomains are also created."
}
variable "oidc_issuer" {
  type = string
  validation {
    condition     = startswith(var.oidc_issuer, "https://")
    error_message = "Production OIDC issuer must use HTTPS."
  }
}
variable "oidc_discovery_url" {
  type = string
  validation {
    condition     = startswith(var.oidc_discovery_url, "https://")
    error_message = "Production OIDC discovery must use HTTPS."
  }
}
variable "oidc_jwks_uri" {
  type = string
  validation {
    condition     = startswith(var.oidc_jwks_uri, "https://")
    error_message = "Production JWKS must use HTTPS."
  }
}
variable "oidc_client_id" { type = string }
variable "github_oidc_provider_arn" {
  type        = string
  description = "Existing IAM OIDC provider for token.actions.githubusercontent.com."
}
variable "github_oidc_subject" {
  type        = string
  description = "Exact observed GitHub OIDC sub, including immutable owner/repository IDs where applicable. No wildcards."
  validation {
    condition     = startswith(var.github_oidc_subject, "repo:") && !strcontains(var.github_oidc_subject, "*") && endswith(var.github_oidc_subject, ":environment:production")
    error_message = "Supply the exact repository subject ending :environment:production; wildcards are prohibited."
  }
}
