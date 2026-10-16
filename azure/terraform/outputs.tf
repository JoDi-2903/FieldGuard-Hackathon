output "resource_group_name" {
  description = "Resource group containing all FieldGuard resources."
  value       = data.azurerm_resource_group.this.name
}

output "function_app_name" {
  description = "Function App name (use with `func azure functionapp publish` and `az functionapp config appsettings set`)."
  value       = azurerm_linux_function_app.this.name
}

output "function_app_hostname" {
  description = "Function App default hostname. API base is https://<hostname>/api."
  value       = azurerm_linux_function_app.this.default_hostname
}

output "api_base_url" {
  description = "Base URL for the HTTP endpoints (ingest, readings, risk, score_now)."
  value       = "https://${azurerm_linux_function_app.this.default_hostname}/api"
}

output "telemetry_account_name" {
  description = "Storage account hosting the telemetry/fields/riskscores tables."
  value       = azurerm_storage_account.this.name
}

output "telemetry_connection_string" {
  description = "Storage connection string for seed_fields.py and local inspection. Sensitive — do not commit."
  value       = azurerm_storage_account.this.primary_connection_string
  sensitive   = true
}

output "openai_endpoint" {
  description = "Azure OpenAI endpoint used by the Function App."
  value       = azurerm_cognitive_account.openai.endpoint
}

output "openai_deployment_name" {
  description = "Azure OpenAI deployment name (the `model` passed to the SDK)."
  value       = azurerm_cognitive_deployment.chat.name
}

output "swa_hostname" {
  description = "Static Web App default hostname (the dashboard origin, already allow-listed in Function App CORS)."
  value       = azurerm_static_web_app.this.default_host_name
}

output "swa_deployment_token" {
  description = "Deployment token for `swa deploy`. Sensitive — do not commit."
  value       = azurerm_static_web_app.this.api_key
  sensitive   = true
}
