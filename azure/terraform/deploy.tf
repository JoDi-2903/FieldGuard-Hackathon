# Automatic application deployment.
#
# Terraform in main.tf provisions the infrastructure (Function App, Standard
# Static Web App + linked /api backend, storage, OpenAI). This file publishes the
# actual application on top of it so a single `terraform apply` brings up a fully
# working stack:
#
#   1. publish_function      -> deploy the Python Function App code (func publish)
#   2. seed_fields           -> upsert the demo field definitions (required: the
#                               read APIs return nothing without them)
#   3. build_deploy_frontend -> npm build + upload dist/ to the Static Web App
#   4. seed_telemetry        -> stream demo telemetry + first scores (optional),
#                               excluding real hardware in var.live_devices
#
# Everything here is gated on var.deploy_app, mirroring the imperative
# local-exec pattern already used by terraform_data.allow_anonymous_auth. The
# frontend step is independent of the backend chain; seeding talks to the
# Function App hostname directly (not the SWA), so it does not wait on the
# frontend upload.
#
# Apply-host prerequisites (in addition to `az login`): node/npm, python3, and
# network access for `npx` to fetch azure-functions-core-tools and the SWA CLI.

locals {
  functionapp_dir = "${path.module}/../functionapp"
  frontend_dir    = "${path.module}/../../frontend"

  # Re-run a step only when its source actually changes.
  functionapp_hash = sha1(join("", [
    for f in fileset(local.functionapp_dir, "{*.py,requirements.txt,host.json}") :
    filesha1("${local.functionapp_dir}/${f}")
  ]))

  # fileset does not allow "**" inside brace alternation, so gather the frontend
  # sources with separate globs and a literal list of root files.
  frontend_files = concat(
    tolist(fileset(local.frontend_dir, "src/**")),
    tolist(fileset(local.frontend_dir, "public/**")),
    ["package.json", "package-lock.json", "vite.config.js", "index.html"],
  )
  frontend_hash = sha1(join("", [
    for f in local.frontend_files : filesha1("${local.frontend_dir}/${f}")
  ]))
}

# 1. Publish the Function App code.
resource "terraform_data" "publish_function" {
  count = var.deploy_app ? 1 : 0

  triggers_replace = [
    local.functionapp_hash,
    azurerm_linux_function_app.this.id,
  ]

  # The live Arduino (box-01) and the demo seeding both POST /api/ingest using the
  # shared secret, so a working deploy needs it set. In tfvars it is injected via
  # app_settings (main.tf), removing the manual `az ... INGEST_SHARED_SECRET` step.
  lifecycle {
    precondition {
      condition     = var.ingest_secret != ""
      error_message = "Set ingest_secret in terraform.tfvars when deploy_app = true: device ingest (box-01) and demo seeding both authenticate to /api/ingest with it. (Note: Terraform state is plaintext on disk.)"
    }
  }

  provisioner "local-exec" {
    working_dir = local.functionapp_dir
    command     = <<-CMD
      npx -y azure-functions-core-tools@4 azure functionapp publish \
        "${azurerm_linux_function_app.this.name}" --python
    CMD
  }

  depends_on = [
    azurerm_linux_function_app.this,
    terraform_data.allow_anonymous_auth,
  ]
}

# 2. Seed the demo field definitions (idempotent upsert).
resource "terraform_data" "seed_fields" {
  count = var.deploy_app ? 1 : 0

  triggers_replace = [filesha1("${local.functionapp_dir}/seed_fields.py")]

  provisioner "local-exec" {
    working_dir = local.functionapp_dir
    environment = {
      TELEMETRY_CONNECTION_STRING = azurerm_storage_account.this.primary_connection_string
      FIELDS_TABLE_NAME           = azurerm_storage_table.fields.name
    }
    command = "python3 -m pip install -q azure-data-tables && python3 seed_fields.py"
  }

  depends_on = [azurerm_storage_table.fields]
}

# 3. Build and upload the React dashboard. The linked /api only resolves once the
#    SWA has content, so this is what makes the dashboard reach the backend.
resource "terraform_data" "build_deploy_frontend" {
  count = var.deploy_app ? 1 : 0

  triggers_replace = [
    local.frontend_hash,
    azurerm_static_web_app.this.id,
  ]

  provisioner "local-exec" {
    working_dir = local.frontend_dir
    # The SWA CLI reads the token from SWA_CLI_DEPLOYMENT_TOKEN, keeping it out of
    # the command line and process list.
    environment = {
      SWA_CLI_DEPLOYMENT_TOKEN = azurerm_static_web_app.this.api_key
    }
    command = <<-CMD
      npm ci && npm run build && \
      npx -y @azure/static-web-apps-cli deploy ./dist --env production
    CMD
  }

  depends_on = [azurerm_static_web_app.this]
}

# 4. Seed demo telemetry + first scores (skips real hardware in var.live_devices).
resource "terraform_data" "seed_telemetry" {
  count = var.deploy_app && var.seed_demo_data ? 1 : 0

  triggers_replace = [
    filesha1("${local.functionapp_dir}/seed_telemetry.py"),
    join(",", var.live_devices),
  ]

  provisioner "local-exec" {
    working_dir = local.functionapp_dir
    environment = {
      API_BASE_URL         = "https://${azurerm_linux_function_app.this.default_hostname}/api"
      INGEST_SHARED_SECRET = var.ingest_secret
      SEED_SKIP_DEVICES    = join(",", var.live_devices)
    }
    command = "python3 seed_telemetry.py"
  }

  depends_on = [
    terraform_data.publish_function,
    terraform_data.seed_fields,
    terraform_data.allow_anonymous_auth,
  ]
}
