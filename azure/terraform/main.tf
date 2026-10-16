locals {
  suffix = random_string.suffix.result
  name   = var.project

  # Storage account names: 3-24 chars, lowercase alphanumeric only, globally unique.
  storage_account_name = substr("${local.name}st${local.suffix}", 0, 24)
  openai_account_name  = "${local.name}-openai-${local.suffix}"
  function_app_name    = "${local.name}-func-${local.suffix}"
  static_web_app_name  = "${local.name}-dashboard-${local.suffix}"
}

resource "random_string" "suffix" {
  length  = 6
  lower   = true
  upper   = false
  numeric = true
  special = false
}

# Use the pre-existing resource group — the hackathon account cannot create new ones.
data "azurerm_resource_group" "this" {
  name = var.resource_group_name
}

# --- Storage: one account hosts both the Functions runtime (key-based) and the
#     telemetry tables (accessed via the Function App's managed identity). ---
resource "azurerm_storage_account" "this" {
  name                     = local.storage_account_name
  resource_group_name      = data.azurerm_resource_group.this.name
  location                 = data.azurerm_resource_group.this.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"
  tags                     = var.tags
}

resource "azurerm_storage_table" "telemetry" {
  name               = "telemetry"
  storage_account_id = azurerm_storage_account.this.id
}

resource "azurerm_storage_table" "fields" {
  name               = "fields"
  storage_account_id = azurerm_storage_account.this.id
}

resource "azurerm_storage_table" "riskscores" {
  name               = "riskscores"
  storage_account_id = azurerm_storage_account.this.id
}

# --- Observability ---
resource "azurerm_log_analytics_workspace" "this" {
  name                = "${local.name}-law"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = data.azurerm_resource_group.this.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "this" {
  name                = "${local.name}-ai"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = data.azurerm_resource_group.this.location
  workspace_id        = azurerm_log_analytics_workspace.this.id
  application_type    = "web"
  tags                = var.tags
}

# --- Compute: Linux Consumption plan + Python Function App ---
resource "azurerm_service_plan" "this" {
  name                = "${local.name}-plan"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = data.azurerm_resource_group.this.location
  os_type             = "Linux"
  sku_name            = "Y1" # Consumption
  tags                = var.tags
}

resource "azurerm_linux_function_app" "this" {
  name                = local.function_app_name
  resource_group_name = data.azurerm_resource_group.this.name
  location            = data.azurerm_resource_group.this.location
  service_plan_id     = azurerm_service_plan.this.id

  # Functions runtime storage (host state/leases) — key-based for reliable startup.
  storage_account_name       = azurerm_storage_account.this.name
  storage_account_access_key = azurerm_storage_account.this.primary_access_key

  site_config {
    application_stack {
      python_version = "3.12" # ceiling on Linux Consumption
    }

    cors {
      # Allow the dashboard origin to call the API from the browser.
      allowed_origins     = ["https://${azurerm_static_web_app.this.default_host_name}"]
      support_credentials = false
    }
  }

  app_settings = merge(
    {
      FUNCTIONS_WORKER_RUNTIME              = "python"
      APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.this.connection_string

      # Telemetry data plane. The hackathon subscription cannot create role
      # assignments, so we use the storage account key instead of managed identity.
      TELEMETRY_CONNECTION_STRING = azurerm_storage_account.this.primary_connection_string
      TELEMETRY_TABLE_NAME        = azurerm_storage_table.telemetry.name
      FIELDS_TABLE_NAME           = azurerm_storage_table.fields.name
      RISK_TABLE_NAME             = azurerm_storage_table.riskscores.name

      # Azure OpenAI (key-based — RBAC role assignment is not permitted here).
      AZURE_OPENAI_ENDPOINT    = azurerm_cognitive_account.openai.endpoint
      AZURE_OPENAI_API_KEY     = azurerm_cognitive_account.openai.primary_access_key
      AZURE_OPENAI_DEPLOYMENT  = azurerm_cognitive_deployment.chat.name
      AZURE_OPENAI_API_VERSION = var.openai_api_version
    },
    # Only inject the ingest secret if provided via tfvars. The clean default is to
    # leave it empty here and set it out-of-band so it never lands in tfstate.
    var.ingest_secret != "" ? { INGEST_SHARED_SECRET = var.ingest_secret } : {}
  )

  tags = var.tags

  # Linking this app as the Static Web App's /api backend auto-enables App Service
  # Authentication (AuthV2) and rewrites auth_settings_v2 on the resource. Ignore
  # those changes so Terraform does not fight the linkage on every apply. Keep the
  # app reachable anonymously (direct device ingest + public reads) — see
  # azure/README.md for the one-time `az webapp auth update` check after linking.
  lifecycle {
    ignore_changes = [auth_settings_v2]
  }
}

# --- Azure OpenAI ---
resource "azurerm_cognitive_account" "openai" {
  name                = local.openai_account_name
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.openai_location
  kind                = "OpenAI"
  sku_name            = "S0"

  # Key-based access: the hackathon subscription cannot assign the "Cognitive
  # Services OpenAI User" role, so we authenticate with the account key instead.
  local_auth_enabled = true

  tags = var.tags
}

resource "azurerm_cognitive_deployment" "chat" {
  name                 = var.openai_model_name
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = var.openai_model_name
    version = var.openai_model_version # null => Azure default
  }

  sku {
    name     = "GlobalStandard"
    capacity = var.openai_capacity
  }
}

# --- Dashboard hosting: Static Web App (Standard) ---
# Standard is required to link an existing ("bring your own") Function App as the
# site's /api backend; the Free tier only supports managed functions.
resource "azurerm_static_web_app" "this" {
  name                = local.static_web_app_name
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.swa_location
  sku_tier            = "Standard"
  sku_size            = "Standard"
  tags                = var.tags
}

# Link the Function App as the Static Web App's same-origin /api backend. The
# React dashboard then calls /api/* without CORS. Only one backend may be linked
# per SWA, and the SWA must have content deployed before /api resolves.
resource "azurerm_static_web_app_function_app_registration" "this" {
  static_web_app_id = azurerm_static_web_app.this.id
  function_app_id   = azurerm_linux_function_app.this.id
}
