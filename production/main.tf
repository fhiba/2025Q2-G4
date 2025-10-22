# Estas tags son para todos los resources
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

resource "aws_cognito_user_pool" "user_pool" {
  name = "factutable-user-pool"
  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "app_client" {
  name         = "factutable-app-client"
  user_pool_id = aws_cognito_user_pool.user_pool.id
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  generate_secret = false
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

  create_role = false
  lambda_role = data.aws_iam_role.academy_role.arn
}

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
  hash_key  = "PK"       # userId o groupKey
  range_key = "SK"       # invoiceId único

  attributes = [
    { name = "PK", type = "S" },   # userId o groupKey
    { name = "SK", type = "S" },   # invoiceId único
    { name = "userId", type = "S" },
    { name = "groupKey", type = "S" }
  ]

  billing_mode = "PAY_PER_REQUEST"

  global_secondary_indexes = [
    {
      name            = "GSI_User_Group"
      hash_key        = "userId"
      range_key       = "groupKey"
      projection_type = "ALL"  # Asegúrate de que 'createdAt' esté incluido
    },
    {
      name            = "GSI_InvoiceId"
      hash_key        = "PK"  # userId o groupKey
      range_key       = "SK"  # invoiceId único
      projection_type = "ALL"
    }
  ]

  tags = local.common_tags
}





# Permiso para que S3 pueda invocar la Lambda
resource "aws_lambda_permission" "s3_invoke_processor" {
  statement_id = "AllowS3Invoke"
  action       = "lambda:InvokeFunction"
  function_name = module.lambdas["invoice-processor"].lambda_function_arn
  principal    = "s3.amazonaws.com"
  source_arn   = module.s3_buckets["facturas"].bucket_arn
}

# Configuración del "Trigger" (Notificación) en el bucket S3
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

resource "aws_cloudwatch_log_group" "invoice_processor" {
  count = var.manage_lambda_log_group ? 1 : 0
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
  name        = "prod"  # Usar nombre personalizado (no $default)
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.apigw_access.arn
    format          = jsonencode({
      requestId               = "$context.requestId"
      sourceIp                = "$context.identity.sourceIp"
      requestTime             = "$context.requestTime"
      protocol                = "$context.protocol"
      httpMethod              = "$context.httpMethod"
      resourcePath            = "$context.resourcePath"
      routeKey                = "$context.routeKey"
      status                  = "$context.status"
      responseLength          = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }
}
