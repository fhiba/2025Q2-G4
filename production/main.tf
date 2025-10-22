# estas tags son para todos los resources
data "aws_iam_role" "academy_role" {
  name = var.academy_role
}
data "aws_region" "current" {}
locals {
  common_tags = {
    Environment = "production"
    Project     = "FactuTable"
  }
}

# buckets
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

resource "aws_cognito_user_pool" "user_pool" {
  name = "factutable-user-pool"
  # Agrega configuración de políticas de contraseña, etc., si lo deseas
  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "app_client" {
  name         = "factutable-app-client"
  user_pool_id = aws_cognito_user_pool.user_pool.id

  # Necesario para el flow de autenticación de una SPA
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  # Si no usas un "client secret" (común para SPAs)
  generate_secret = false
}

#lambdas
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
    # Extra solo si es la lambda "database-writer"
    each.key == "database-writer" ? {
      TABLE_NAME = module.ddb_invoice_jobs.dynamodb_table_id
    } : {},
    each.key == "invoice-data-getter" ? {
      TABLE_NAME = module.ddb_invoice_jobs.dynamodb_table_id
      INDEX_NAME = "GSI_Date" # o el índice que uses realmente
    } : {},



  )


  create_role = false
  lambda_role = data.aws_iam_role.academy_role.arn
}
module "http_api" {
  source  = "terraform-aws-modules/apigateway-v2/aws"
  version = "~> 5.4"

  name          = "factutable-api"
  protocol_type = "HTTP"

  cors_configuration = {
    allow_origins = ["*"] # o el origin de tu SPA
    allow_methods = ["GET", "POST", "OPTIONS", "PUT"]
    allow_headers = ["authorization", "content-type"]
  }
    # Authorizer Cognito (JWT)
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

resource "aws_apigatewayv2_integration" "presign" {
  api_id                 = module.http_api.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambdas["presigned-url-generator"].lambda_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "report" {
  api_id                 = module.http_api.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambdas["report-generator"].lambda_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "update_invoice" {
  api_id                 = module.http_api.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambdas["invoice-data-updater"].lambda_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "get_invoice" {
  api_id                 = module.http_api.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambdas["invoice-data-getter"].lambda_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "presign" {
  api_id             = module.http_api.api_id
  route_key          = "POST /uploads/presign"
  target             = "integrations/${aws_apigatewayv2_integration.presign.id}"
  authorization_type = "JWT"
  authorizer_id      = module.http_api.authorizers["cognito"].id
}

resource "aws_apigatewayv2_route" "report" {
  api_id             = module.http_api.api_id
  route_key          = "GET /download"
  target             = "integrations/${aws_apigatewayv2_integration.report.id}"
  authorization_type = "JWT"
  authorizer_id      = module.http_api.authorizers["cognito"].id
}

resource "aws_apigatewayv2_route" "update_invoice" {
  api_id             = module.http_api.api_id
  route_key          = "PUT /invoices/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.update_invoice.id}"
  authorization_type = "JWT"
  authorizer_id      = module.http_api.authorizers["cognito"].id
}

resource "aws_apigatewayv2_route" "get_invoice" {
  api_id             = module.http_api.api_id
  route_key          = "GET /invoices"
  target             = "integrations/${aws_apigatewayv2_integration.get_invoice.id}"
  authorization_type = "JWT"
  authorizer_id      = module.http_api.authorizers["cognito"].id
}


# resource "aws_apigatewayv2_stage" "default" {
#   api_id = module.http_api.api_id
#
#   name = "$default"
#
#   auto_deploy = true
#
#   depends_on = [
#     aws_apigatewayv2_route.presign,
#     aws_apigatewayv2_route.report,
#     aws_apigatewayv2_route.update_invoice,
#     aws_apigatewayv2_route.get_invoice
#   ]
# }
# Permisos para que API GW invoque tus Lambdas
resource "aws_lambda_permission" "apigw_invoke" {
  for_each = {
    presign = module.lambdas["presigned-url-generator"].lambda_function_name
    report  = module.lambdas["report-generator"].lambda_function_name
    update  = module.lambdas["invoice-data-updater"].lambda_function_name
    getter  = module.lambdas["invoice-data-getter"].lambda_function_name
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

  name      = "InvoiceJobs"
  hash_key  = "PK"
  range_key = "SK"

  attributes = [
    { name = "PK", type = "S" },
    { name = "SK", type = "S" },
    { name = "userId", type = "S" },
    { name = "createdAt", type = "N" },
    { name = "groupKey", type = "S" }
  ]

  billing_mode = "PAY_PER_REQUEST"

  global_secondary_indexes = [
    { name = "GSI_Date", hash_key = "userId", range_key = "createdAt", projection_type = "ALL" },
    { name = "GSI_Group", hash_key = "groupKey", range_key = "createdAt", projection_type = "ALL" }
  ]

  tags = local.common_tags
}

# 1. Permiso para que S3 pueda invocar la Lambda
resource "aws_lambda_permission" "s3_invoke_processor" {
  statement_id = "AllowS3Invoke"
  action       = "lambda:InvokeFunction"

  # Apunta a la nueva lambda
  function_name = module.lambdas["invoice-processor"].lambda_function_arn

  principal = "s3.amazonaws.com"

  # Apunta al bucket de uploads
  source_arn = module.s3_buckets["facturas"].bucket_arn
}

# 2. La configuración del "Trigger" (Notificación) en el bucket S3
resource "aws_s3_bucket_notification" "uploads_trigger" {

  bucket = module.s3_buckets["facturas"].bucket_name

  lambda_function {
    lambda_function_arn = module.lambdas["invoice-processor"].lambda_function_arn

    events = ["s3:ObjectCreated:*"]
  }

  depends_on = [
    aws_lambda_permission.s3_invoke_processor
  ]
}

# ===================================================================
# CloudWatch para Lambda y API Gateway
# ===================================================================

# (A) Log group para la(s) Lambda: controla retención y evita race al crear.
#    Ajustá 'retention_in_days' si querés otro valor.
resource "aws_cloudwatch_log_group" "invoice_processor" {
  count = var.manage_lambda_log_group ? 1 : 0
  name              = "/aws/lambda/${module.lambdas["invoice-processor"].lambda_function_name}"
  retention_in_days = 14
  tags              = local.common_tags
}


# Data source: fetch the Academy/Learner Lab role to attach basic Lambda logging
data "aws_iam_role" "academy" {
  name = var.academy_role
}

# (B) Permisos mínimos para que la Lambda escriba en CloudWatch Logs.
#     Si tu rol de ejecución ya tiene AWSLambdaBasicExecutionRole, podés omitir esto.
#     Si tus Lambdas usan un rol propio distinto, reemplazá 'aws_iam_role.lambda_exec.name'.
resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  count = var.manage_iam ? 1 : 0
  role       = data.aws_iam_role.academy.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# (C) Habilitar CloudWatch Logs para API Gateway (REST).
#     Esto configura la cuenta de API Gateway con un rol que le permite publicar logs.
data "aws_iam_policy_document" "apigw_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "apigw_cw" {
  count = var.manage_iam ? 1 : 0
  name               = "apigw-cloudwatch-role"
  assume_role_policy = data.aws_iam_policy_document.apigw_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "apigw_push" {
  count = var.manage_iam ? 1 : 0
  role       = aws_iam_role.apigw_cw[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "this" {
  count = var.manage_iam ? 1 : 0
  cloudwatch_role_arn = aws_iam_role.apigw_cw[0].arn
}

# (D) Access logs y metrics en un Stage de API Gateway (REST).
#     Si ya definiste tu Stage, agregá/mergeá estos campos.
#     Si no, dejá este bloque como referencia y reemplazá 'aws_api_gateway_rest_api.main.id'.
resource "aws_cloudwatch_log_group" "apigw_access" {
  name              = "/aws/apigw/factutable"
  retention_in_days = 14
  tags              = local.common_tags
}

# Ejemplo de Stage (si ya tenés uno, sólo sumá 'access_log_settings' y 'method_settings'):
# resource "aws_api_gateway_stage" "prod" {
#   rest_api_id = aws_api_gateway_rest_api.main.id
#   stage_name  = "prod"
# 
#   access_log_settings {
#     destination_arn = aws_cloudwatch_log_group.apigw_access.arn
#     # formato recomendado: incluye requestId, status, latencia, etc.
#     format = jsonencode({
#       requestId   = "$context.requestId"
#       ip          = "$context.identity.sourceIp"
#       caller      = "$context.identity.caller"
#       user        = "$context.identity.user"
#       requestTime = "$context.requestTime"
#       httpMethod  = "$context.httpMethod"
#       resourcePath= "$context.resourcePath"
#       status      = "$context.status"
#       protocol    = "$context.protocol"
#       responseLen = "$context.responseLength"
#       integrationError = "$context.integration.error"
#     })
#   }
# 
#   method_settings {
#     resource_path = "/*"
#     http_method   = "*"
#     logging_level = "INFO"
#     metrics_enabled = true
#   }
# 
#   tags = local.common_tags
# }

# (E) Para HTTP API (v2), usar aws_apigatewayv2_stage con access_log_settings análogo:
# resource "aws_apigatewayv2_stage" "prod" {
#   api_id     = aws_apigatewayv2_api.main.id
#   name       = "$default"
#   auto_deploy = true
#   access_log_settings {
#     destination_arn = aws_cloudwatch_log_group.apigw_access.arn
#     format = jsonencode({ requestId = "$context.requestId", status = "$context.status" })
#   }
#   tags = local.common_tags
# }
