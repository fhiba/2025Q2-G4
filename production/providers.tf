terraform {
  required_version = ">= 1.3.0" # O la versión que estés usando

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.3"
    }
  }
}

provider "aws" {
  region = "us-east-1"

}
