## Descripción General

FactuTable es una aplicación serverless que permite:
- **Autenticación** mediante AWS Cognito
- **Carga de facturas** con URLs pre-firmadas
- **Procesamiento automático** de facturas PDF
- **Almacenamiento** en DynamoDB
- **Generación de reportes** y descarga de documentos
- **API REST** para gestión de datos

## Arquitectura

![Arquitectura FactuTable](cloud%20entrega%202.jpg)

## Módulos

### 1. Módulo S3 Buckets (`modules/s3_buckets/`)

**Características**:
- **Nombres únicos**: Genera nombres únicos usando sufijos aleatorios
- **Configuración dual**: Soporte para versionado O hosting web (mutuamente excluyentes)
- **CORS habilitado**: Para comunicación con frontend
- **Políticas de acceso**: Configuración automática según el tipo de bucket

**Recursos creados**:
- `aws_s3_bucket`: Bucket principal
- `aws_s3_bucket_versioning`: Versionado (opcional)
- `aws_s3_bucket_website_configuration`: Hosting web (opcional)
- `aws_s3_bucket_public_access_block`: Control de acceso público
- `aws_s3_bucket_policy`: Política de acceso para sitios web

**Variables**:
- `bucket_name`: Nombre base del bucket (máx. 56 caracteres)
- `enable_versioning`: Activa versionado
- `enable_website_hosting`: Configura para hosting web
- `tags`: Etiquetas personalizadas

### 2. Módulo Principal (`production/`)

**Componentes principales**:
- **Cognito**: Autenticación y autorización
- **Lambda Functions**: Procesamiento serverless
- **API Gateway**: Endpoints REST
- **DynamoDB**: Almacenamiento de datos
- **CloudWatch**: Logging y monitoreo

## Funciones Lambda Implementadas

### 1. `cognito-post-auth`
- **Trigger**: Cognito Post Authentication Hook
- **Propósito**: Procesamiento post-autenticación

### 2. `presigned-url-generator`
- **Trigger**: API Gateway (POST /uploads/presign)
- **Propósito**: Genera URLs pre-firmadas para carga de archivos
- **Autenticación**: JWT (Cognito)

## Funciones Lambda a Implementar (NO FUNCIONALES)

### 3. `invoice-processor`
- **Trigger**: S3 Object Created Event
- **Propósito**: Procesa facturas PDF automáticamente

### 4. `database-writer`
- **Trigger**: Step Functions
- **Propósito**: Escribe datos procesados a DynamoDB
- **Variables de entorno**: `TABLE_NAME`

### 5. `report-generator`
- **Trigger**: API Gateway (GET /download)
- **Propósito**: Genera y sirve reportes
- **Autenticación**: JWT (Cognito)

### 6. `invoice-data-updater`
- **Trigger**: API Gateway (PUT /invoices/{id})
- **Propósito**: Actualiza datos de facturas
- **Autenticación**: JWT (Cognito)

### 7. `invoice-data-getter`
- **Trigger**: API Gateway (GET /invoices)
- **Propósito**: Obtiene listado de facturas
- **Variables de entorno**: `TABLE_NAME`, `INDEX_NAME`
- **Autenticación**: JWT (Cognito)

## Meta-argumentos y Configuraciones

### `for_each`

```hcl
module "s3_buckets" {
  for_each = var.buckets
  # Crea un bucket por cada entrada en var.buckets
}

module "lambdas" {
  for_each = var.lambda_functions
  # Crea una función Lambda por cada entrada en var.lambda_functions
}
```

### `merge()`

```hcl
environment_variables = merge(
  # Variables por defecto
  {
    UPLOAD_BUCKET = module.s3_buckets["facturas"].bucket_name
  },
  # Variables de Cognito para todas las lambdas
  {
    COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.app_client.id
    COGNITO_REDIRECT_URI = "${module.http_api.api_endpoint}/prod/auth/callback"
    COGNITO_DOMAIN       = aws_cognito_user_pool_domain.user_pool_domain.domain
    COGNITO_USER_POOL_ID = aws_cognito_user_pool.user_pool.id
  },
  # Variables condicionales
  each.key == "database-writer" ? {
    TABLE_NAME = module.ddb_invoice_jobs.dynamodb_table_id
  } : {}
)
```

### `depends_on`

```hcl
resource "aws_s3_bucket_notification" "uploads_trigger" {
  depends_on = [
    aws_lambda_permission.s3_invoke_processor
  ]
}
```

### `count`

```hcl
resource "aws_s3_bucket_versioning" "this" {
  count  = var.enable_versioning ? 1 : 0
  # Solo se crea si enable_versioning es true
}
```

## Guía de Ejecución

### Paso 1: Inicializar Terraform

```bash
# Inicializar el directorio de trabajo
terraform init

```

### Paso 2: Terraform Plan

```bash
terraform plan 

```

### Paso 3: Terraform Apply

```bash
terraform apply
```

### Paso 4: Ir al factu-front y actualizar los siguientes archivos:

en el config.ts del src modificar todo menos el COGNITO.domain con lo que corresponda, estos datos son accesibles desde la consola de aws


   ```typescript
  export const CONFIG = {
  // API Gateway endpoint
  API_GATEWAY_ENDPOINT: "https://f5o8rmaoa4.execute-api.us-east-1.amazonaws.com/prod",
  
  // Cognito callback endpoint (where Cognito redirects after login)
  COGNITO_CALLBACK_ENDPOINT: "https://f5o8rmaoa4.execute-api.us-east-1.amazonaws.com/prod/auth/callback",
  
  // Cognito configuration
  COGNITO: {
    region: "us-east-1",
    userPoolId: "us-east-1_5M9YXKeOe",
    userPoolWebClientId: "7nilk1q7pj4k2adn54ocjhkg0u",
    domain: "factutable-auth.auth.us-east-1.amazoncognito.com"
  }
};
   ```
### Paso 5: Buildear el proyecto

```bash
  npm run build
```
### Paso 6: Subir el contenido de dist al bucket
<img width="1444" height="231" alt="image" src="https://github.com/user-attachments/assets/a58594aa-fbcb-4d41-92b6-756b1bd7d1a5" />
Se deberia ver asi como en la foto.

