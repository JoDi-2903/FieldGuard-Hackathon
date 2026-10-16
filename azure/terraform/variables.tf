variable "subscription_id" {
  description = "Azure subscription ID to deploy into."
  type        = string
}

variable "project" {
  description = "Short project slug used to name resources (lowercase letters/digits)."
  type        = string
  default     = "fieldguard"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,11}$", var.project))
    error_message = "project must be 3-12 chars, lowercase letters/digits, starting with a letter (storage-account-name friendly)."
  }
}

variable "resource_group_name" {
  description = "Name of an EXISTING resource group to deploy into. Terraform will NOT create or destroy it."
  type        = string
  default     = "CE-team-bug-busters"
}

variable "location" {
  description = "Azure region for most resources. Must match or be compatible with the resource group's region."
  type        = string
  default     = "germanywestcentral"
}

variable "openai_location" {
  description = "Azure region for the Azure OpenAI account. The chosen model/version must be offered here; it can differ from var.location (e.g. swedencentral, eastus2)."
  type        = string
  default     = "swedencentral"
}

variable "swa_location" {
  description = "Azure region for the Static Web App. SWA Free is only in a few regions (westus2, eastus2, centralus, eastasia)."
  type        = string
  default     = "westus2"
}

variable "openai_model_name" {
  description = "Azure OpenAI model to deploy."
  type        = string
  default     = "gpt-5-mini"
}

variable "openai_model_version" {
  description = "Pinned model version. Must still be GA in openai_location at apply time; leave null to let Azure pick the default."
  type        = string
  default     = null
}

variable "openai_capacity" {
  description = "Deployment capacity in thousands of tokens-per-minute (TPM). Must be <= your remaining regional quota."
  type        = number
  default     = 10
}

variable "openai_api_version" {
  description = "Azure OpenAI data-plane API version used by the SDK. A GA version supporting json_schema structured outputs."
  type        = string
  default     = "2024-10-21"
}

variable "ingest_secret" {
  description = "Shared secret the Arduino sends in the X-Ingest-Key header. Kept in gitignored tfvars. NOTE: Terraform state is plaintext on disk; prefer setting this out-of-band (see runbook) and leaving this empty to avoid storing it in state."
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default = {
    project = "fieldguard"
    env     = "hackathon"
  }
}
