# Definición de los buckets para el entorno de producción
buckets = {

  facturas = {
    bucket_name_base       = "factu-table-facturas"
    enable_versioning      = true
    enable_website_hosting = false
    content_tag            = "facturas"
  },
  spa = {
    bucket_name_base       = "factu-table-spa"
    enable_versioning      = false
    enable_website_hosting = true
    content_tag            = "spa"
  }
}

#    source_path = string
#    handler     = string
#    runtime     = string

lambda_functions = {
  # 1. Hook de Cognito (Disparado por Cognito)
  "cognito-post-auth" = {
    source_path = "../src/lambda-cognito-hook"
    handler     = "main.handler"
    runtime     = "python3.13"
  },

  #2.1 (Disparado por API Gateway)
  "presigned-url-generator" = {
    source_path = "../src/lambda-presigned-url-generator"
    handler     = "main.handler"
    runtime     = "python3.13"
  },

  # 2.2 Procesador de Facturas (Disparado por S3)
  "invoice-processor" = {
    source_path = "../src/lambda-invoice-processor"
    handler     = "main.handler"
    runtime     = "python3.13"
  },

  # 3. Escritor de Base de Datos (Disparado por Step Function)
  "database-writer" = {
    source_path = "../src/lambda-database-writer"
    handler     = "main.handler"
    runtime     = "python3.13"
  },

  # 4. Generador de Reportes (Disparado por API Gateway)
  "report-generator" = {
    source_path = "../src/lambda-report-generator"
    handler     = "main.handler"
    runtime     = "python3.13"
  }

  # 5. Update invoice in database (Disparado por API Gateway)
  "invoice-data-updater" = {
    source_path = "../src/lambda-invoice-updater"
    handler     = "main.handler"
    runtime     = "python3.13"
  }

  "invoice-data-getter" = {
    source_path = "../src/lambda-invoice-getter"
    handler     = "main.handler"
    runtime     = "python3.13"
  }
}


