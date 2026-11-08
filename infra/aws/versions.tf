terraform {
  required_version = ">= 1.14.0, < 2.0.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "6.38.0" }
  }
}
provider "aws" { region = var.region }
provider "aws" {
  alias  = "edge"
  region = "us-east-1"
}
