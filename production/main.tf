# Estas tags son para todos los resources
data "aws_iam_role" "academy_role" {
  name = var.academy_role
}
data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
locals {
  common_tags = {
    Environment = "production"
    Project     = "FactuTable"
  }
}

# Buckets
module "s3_buckets" {
  for_each = var.buckets

  source = "../modules/s3_buckets"

  bucket_name            = each.value.bucket_name_base
  enable_versioning      = each.value.enable_versioning
  enable_website_hosting = each.value.enable_website_hosting

  tags = merge(
    local.common_tags,
    { content = each.value.content_tag }
  )
}



# Generamos un sufijo único para el dominio de Cognito
resource "random_id" "cognito_suffix" {
  byte_length = 4
}
locals {
  cognito_domain = "factutable-auth-${random_id.cognito_suffix.hex}"
}

resource "aws_cognito_user_pool" "user_pool" {
  name = "factutable-user-pool"
  tags = local.common_tags
  username_attributes      = ["email"]              # o ["email","phone_number"]
  auto_verified_attributes = ["email"]              # y/o "phone_number"

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"       # evita configurar SES para probar
  }
}

resource "aws_cognito_user_pool_client" "app_client" {
  name                = "factutable-app-client"
  user_pool_id        = aws_cognito_user_pool.user_pool.id
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  generate_secret     = false

  allowed_oauth_flows_user_pool_client = true
  supported_identity_providers = ["COGNITO"]
  allowed_oauth_flows= ["code"]  # Esto habilita el Authorization Code Flow
  allowed_oauth_scopes = ["openid", "email", "profile", "phone"]  # Scopes requeridos
  # Agregar la URL de callback (la URL a la que Cognito redirigirá después de la autenticación)
  callback_urls = [
    "${module.http_api.api_endpoint}/prod/auth/callback",
    "http://localhost:3000/auth/callback"
  ]

  logout_urls = [
    "${module.http_api.api_endpoint}/prod/auth/callback",
    "http://localhost:3000"
  ]






}


resource "aws_cognito_user_pool_domain" "user_pool_domain" {
  domain       = local.cognito_domain
  user_pool_id = aws_cognito_user_pool.user_pool.id
}

resource "aws_lambda_layer_version" "python_dependencies" {
  layer_name = "python-dependencies"
  filename   = "../src/lambda-layer.zip"  # Ruta del archivo ZIP que creaste
  compatible_runtimes = ["python3.13"]  # Ajusta según el runtime que uses
}

# Lambdas
module "lambdas" {
  for_each = var.lambda_functions

 source  = "terraform-aws-modules/lambda/aws"
  version = "~> 8.1"

  function_name = each.key
  handler       = each.value.handler
  runtime       = each.value.runtime
  source_path   = each.value.source_path
  tags          = local.common_tags

environment_variables = merge(
    # Default para todas
    {
      UPLOAD_BUCKET = module.s3_buckets["facturas"].bucket_name
    },
    # Cognito variables for all lambdas
    {
      COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.app_client.id
      COGNITO_REDIRECT_URI = "${module.http_api.api_endpoint}/prod/auth/callback"
      COGNITO_DOMAIN       = aws_cognito_user_pool_domain.user_pool_domain.domain
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.user_pool.id
    },
    # SPA URL for cognito-post-auth lambda
    each.key == "cognito-post-auth" ? {
      SPA_URL = "http://${module.s3_buckets["spa"].website_endpoint}"
    } : {},
    # Extra solo si es la lambda "database-writer"
    each.key == "database-writer" ? {
      TABLE_NAME = module.ddb_invoice_jobs.dynamodb_table_id
    } : {},

    each.key == "report-generator" ? {
      TABLE_NAME = module.ddb_invoice_jobs.dynamodb_table_id
      INDEX_NAME = "GSI_User_Group"
    } : {},
    each.key == "invoice-getter" ? {
      TABLE_NAME = module.ddb_invoice_jobs.dynamodb_table_id
      INDEX_NAME = "GSI_User_Group"
    } : {},
    each.key == "export" ? {
      TABLE_NAME = module.ddb_invoice_jobs.dynamodb_table_id
      INDEX_NAME = "GSI_User_Group"
    } : {}
)

  create_role = false
  lambda_role = data.aws_iam_role.academy_role.arn


  layers = [aws_lambda_layer_version.python_dependencies.arn]
}

# Nota: Los permisos S3 deben agregarse manualmente al rol LabRole en la consola de AWS
# ya que el entorno de laboratorio no permite crear/modificar roles IAM

module "http_api" {
  source  = "terraform-aws-modules/apigateway-v2/aws"
  version = "~> 5.4"

  name          = "factutable-api"
  protocol_type = "HTTP"

  cors_configuration = {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS", "PUT"]
    allow_headers = ["authorization", "content-type"]
  }

  authorizers = {
    cognito = {
      authorizer_type  = "JWT"
      identity_sources = ["$request.header.Authorization"]
      name             = "cognito-jwt"
      jwt_configuration = {
        audience = [aws_cognito_user_pool_client.app_client.id]
        issuer   = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.user_pool.id}"
      }
    }
  }
  create_domain_name = false
  tags               = local.common_tags
}


resource "aws_apigatewayv2_integration" "integrations" {
  for_each = {
    presign        = module.lambdas["presigned-url-generator"].lambda_function_arn
    getter         = module.lambdas["invoice-getter"].lambda_function_arn
    report         = module.lambdas["report-generator"].lambda_function_arn
    export         = module.lambdas["export"].lambda_function_arn
    update_invoice = module.lambdas["invoice-data-updater"].lambda_function_arn
    auth_callback  = module.lambdas["cognito-post-auth"].lambda_function_arn
  }

  api_id                 = module.http_api.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  payload_format_version = "2.0"
  connection_type        = "INTERNET"
  credentials_arn        = data.aws_iam_role.academy_role.arn
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = {
    auth_callback = {
      route_key          = "GET /auth/callback"
      authorization_type = "NONE"
    }
    presign = {
      route_key          = "POST /uploads/presign"
      authorization_type = "JWT"
      authorizer_id      = module.http_api.authorizers["cognito"].id
    }
    report = {
      route_key          = "GET /report"
      authorization_type = "JWT"
      authorizer_id      = module.http_api.authorizers["cognito"].id
    }
    export = {
      route_key          = "GET /export"
      authorization_type = "JWT"
      authorizer_id      = module.http_api.authorizers["cognito"].id
    }
    getter = {
      route_key          = "GET /invoices"
      authorization_type = "JWT"
      authorizer_id      = module.http_api.authorizers["cognito"].id
    }
  }

  api_id             = module.http_api.api_id
  route_key          = each.value.route_key
  target             = "integrations/${aws_apigatewayv2_integration.integrations[each.key].id}"
  authorization_type = each.value.authorization_type

  # optional authorizer_id only set when present in map
  authorizer_id = lookup(each.value, "authorizer_id", null)
}

# Permisos para que API GW invoque tus Lambdas
resource "aws_lambda_permission" "apigw_invoke" {
  for_each = {
    presign       = module.lambdas["presigned-url-generator"].lambda_function_name
    report        = module.lambdas["report-generator"].lambda_function_name
    getter        = module.lambdas["invoice-getter"].lambda_function_name
    export        = module.lambdas["export"].lambda_function_name
    update        = module.lambdas["invoice-data-updater"].lambda_function_name
    auth_callback = module.lambdas["cognito-post-auth"].lambda_function_name
  }
  statement_id  = "AllowInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.http_api.stage_execution_arn}/*/*"
}

module "ddb_invoice_jobs" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "~> 5.1"

  name        = local.dynamodb_config.table_name
  hash_key    = local.dynamodb_config.hash_key
  range_key   = local.dynamodb_config.range_key
  attributes  = local.dynamodb_attributes
  billing_mode = local.dynamodb_config.billing_mode

  global_secondary_indexes = local.dynamodb_global_secondary_indexes

  tags = local.common_tags
}

# Permiso para que S3 pueda invocar la Lambda
resource "aws_lambda_permission" "s3_invoke_processor" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambdas["invoice-processor"].lambda_function_arn
  principal     = "s3.amazonaws.com"
  source_arn    = module.s3_buckets["facturas"].bucket_arn
}

# Configuración del "Trigger" (Notificación) en el bucket S3
resource "aws_s3_bucket_notification" "uploads_trigger" {
  bucket = module.s3_buckets["facturas"].bucket_name

  lambda_function {
    lambda_function_arn = module.lambdas["invoice-processor"].lambda_function_arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [
    aws_lambda_permission.s3_invoke_processor
  ]
}

resource "aws_cloudwatch_log_group" "invoice_processor" {
  count             = var.manage_lambda_log_group ? 1 : 0
  name              = "/aws/lambda/${module.lambdas["invoice-processor"].lambda_function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}

# Configurar los logs de acceso para el API Gateway
resource "aws_cloudwatch_log_group" "apigw_access" {
  name              = "/aws/apigw/factutable"
  retention_in_days = 14
  tags              = local.common_tags
}

# Stage personalizado (NO $default)
resource "aws_apigatewayv2_stage" "prod" {
  api_id      = module.http_api.api_id
  name        = "prod" # Usar nombre personalizado (no $default)
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.apigw_access.arn
    format          = jsonencode(local.api_access_log_format)
  }
}

###############################################################################
# AUTOGENERAR config.ts PARA LA SPA
###############################################################################

resource "local_file" "spa_config" {
  filename = "${path.module}/../factu-front/src/config.ts"

  content = templatefile(
    "${path.module}/templates/config.ts.tpl",
    {
      api_endpoint   = "${module.http_api.api_endpoint}/prod"
      region         = var.region
      user_pool_id   = aws_cognito_user_pool.user_pool.id
      app_client_id  = aws_cognito_user_pool_client.app_client.id

      cognito_domain = "${aws_cognito_user_pool_domain.user_pool_domain.domain}.auth.${var.region}.amazoncognito.com"
    }
  )
}


###############################################################################
# BUILD de la SPA (npm install + npm run build)
###############################################################################

resource "null_resource" "build_spa" {

  triggers = {
    config_hash = sha1(local_file.spa_config.content)
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/../factu-front"
    command     = "npm install && npm run build"
  }
}

###############################################################################
# SUBIR SPA a S3 AUTOMÁTICAMENTE
###############################################################################

resource "null_resource" "upload_spa" {
  depends_on = [
    null_resource.build_spa,
    module.s3_buckets["spa"]
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/../factu-front"
    command     = "aws s3 sync ./dist s3://${module.s3_buckets["spa"].bucket_name} --delete"
  }
}



###############################################################################
# OUTPUT de la URL final de la SPA
###############################################################################

output "spa_url" {
  value       = "http://${module.s3_buckets["spa"].website_endpoint}"
  description = "URL pública de la SPA desplegada"
}
