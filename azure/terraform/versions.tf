terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {}

  # azurerm v4 requires a subscription id. Set it here (via var) or export
  # ARM_SUBSCRIPTION_ID in your shell. The var keeps it in gitignored tfvars.
  subscription_id = var.subscription_id
}
