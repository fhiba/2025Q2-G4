# estas tags son para todos los resources
data "aws_iam_role" "academy_role" {
  name = var.academy_role
}

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
  version = "~> 7.2"

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
  version = "~> 5.0"

  name          = "factutable-api"
  protocol_type = "HTTP"

  cors_configuration = {
    allow_origins = ["*"]                 # o el origin de tu SPA
    allow_methods = ["GET","POST","OPTIONS"]
    allow_headers = ["authorization","content-type"]
  }

  # Authorizer Cognito (JWT)
  authorizers = {
    cognito = {
      authorizer_type  = "JWT"
      identity_sources = ["$request.header.Authorization"]
      name             = "cognito-jwt"
      jwt_configuration = {
        audience = [aws_cognito_user_pool_client.app_client.id]
        issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.user_pool.id}"
      }
    }
  }

  integrations = {
    presign = {
      integration_type       = "AWS_PROXY"
      integration_uri        = module.lambdas["presigned-url-generator"].lambda_function_arn
      payload_format_version = "2.0"
    }
    report = {
      integration_type       = "AWS_PROXY"
      integration_uri        = module.lambdas["report-generator"].lambda_function_arn
      payload_format_version = "2.0"
    }
    update_invoice = {
      integration_type       = "AWS_PROXY"
      integration_uri        = module.lambdas["invoice-data-updater"].lambda_function_arn
      payload_format_version = "2.0"
    }
  }

  routes = [
    {
      route_key          = "POST /uploads/presign"
      integration_key    = "presign"
      authorization_type = "JWT"
      authorizer_key     = "cognito"
    },
    {
      route_key          = "GET /download"
      integration_key    = "report"
      authorization_type = "JWT"
      authorizer_key     = "cognito"
    },
    {
      route_key          = "POST /invoices/{id}"
      integration_key    = "update_invoice"
      authorization_type = "JWT"
      authorizer_key     = "cognito"
    }
  ]

  # Stage por defecto y auto-deploy (no requiere CloudWatch)
  default_stage_access_log_destination_arn = null
  default_stage_access_log_format          = null
  create_default_stage                     = true
  default_stage_auto_deploy                = true

  tags = local.common_tags
}

# Permisos para que API GW invoque tus Lambdas
resource "aws_lambda_permission" "apigw_invoke" {
  for_each = {
    presign = module.lambdas["presigned-url-generator"].lambda_function_name
    report  = module.lambdas["report-generator"].lambda_function_name
    update  = module.lambdas["invoice-data-updater"].lambda_function_name
  }
  statement_id  = "AllowInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.http_api.execution_arn}/*/*"
}

module "ddb_invoice_jobs" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "~> 4.0"

  name      = "InvoiceJobs"
  hash_key  = "PK"
  range_key = "SK"

  attributes = [
    { name = "PK",        type = "S" },
    { name = "SK",        type = "S" },
    { name = "userId",    type = "S" },
    { name = "createdAt", type = "N" },
    { name = "groupKey",  type = "S" }
  ]

  billing_mode = "PAY_PER_REQUEST"

  global_secondary_indexes = [
    { name = "GSI_Date",  hash_key = "userId",   range_key = "createdAt", projection_type = "ALL" },
    { name = "GSI_Group", hash_key = "groupKey", range_key = "createdAt", projection_type = "ALL" }
  ]

  tags = local.common_tags
}


