locals {

  # Configuración de DynamoDB
  dynamodb_config = {
    table_name   = "InvoiceJobs"
    hash_key     = "PK"  # userId o groupKey
    range_key    = "SK"  # invoiceId único
    billing_mode = "PAY_PER_REQUEST"
  }

  dynamodb_attributes = [
    { name = "PK", type = "S" },      # userId o groupKey
    { name = "SK", type = "S" },      # invoiceId único
    { name = "userId", type = "S" },
    { name = "groupKey", type = "S" }
  ]

  dynamodb_global_secondary_indexes = [
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

  # Configuración de Access Log Settings para API Gateway
  api_access_log_format = {
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
  }
}

