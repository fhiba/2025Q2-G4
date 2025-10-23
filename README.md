# Cloud Terraform - FactuTable Infrastructure

Este proyecto define la infraestructura completa para la aplicación **FactuTable**, un sistema de procesamiento de facturas basado en AWS. La infraestructura está construida usando Terraform con un enfoque modular y escalable.

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Arquitectura](#arquitectura)
- [Módulos](#módulos)
- [Funciones Lambda](#funciones-lambda)
- [Meta-argumentos y Configuraciones](#meta-argumentos-y-configuraciones)
- [Guía de Ejecución](#guía-de-ejecución)
- [Variables de Configuración](#variables-de-configuración)
- [Estructura del Proyecto](#estructura-del-proyecto)

## 🏗️ Descripción General

FactuTable es una aplicación serverless que permite:
- **Autenticación** mediante AWS Cognito
- **Carga de facturas** con URLs pre-firmadas
- **Procesamiento automático** de facturas PDF
- **Almacenamiento** en DynamoDB
- **Generación de reportes** y descarga de documentos
- **API REST** para gestión de datos

## 🏛️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend SPA  │    │   API Gateway   │    │   Cognito Auth  │
│   (S3 Website)  │◄──►│   (HTTP API)    │◄──►│   (User Pool)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Lambda Layer  │    │   Lambda Funcs  │    │   S3 Buckets    │
│   (Dependencies)│    │   (Processing)  │    │   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DynamoDB      │    │   CloudWatch    │    │   Step Functions │
│   (Data Store)  │    │   (Logging)     │    │   (Orchestration)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Módulos

### 1. Módulo S3 Buckets (`modules/s3_buckets/`)

**Propósito**: Gestiona buckets S3 con configuraciones específicas para diferentes casos de uso.

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

**Propósito**: Orquesta todos los recursos de la aplicación.

**Componentes principales**:
- **Cognito**: Autenticación y autorización
- **Lambda Functions**: Procesamiento serverless
- **API Gateway**: Endpoints REST
- **DynamoDB**: Almacenamiento de datos
- **CloudWatch**: Logging y monitoreo

## 🔧 Funciones Lambda

### 1. `cognito-post-auth`
- **Trigger**: Cognito Post Authentication Hook
- **Propósito**: Procesamiento post-autenticación
- **Runtime**: Python 3.12

### 2. `presigned-url-generator`
- **Trigger**: API Gateway (POST /uploads/presign)
- **Propósito**: Genera URLs pre-firmadas para carga de archivos
- **Autenticación**: JWT (Cognito)
- **Runtime**: Python 3.12

### 3. `invoice-processor`
- **Trigger**: S3 Object Created Event
- **Propósito**: Procesa facturas PDF automáticamente
- **Runtime**: Python 3.12

### 4. `database-writer`
- **Trigger**: Step Functions
- **Propósito**: Escribe datos procesados a DynamoDB
- **Variables de entorno**: `TABLE_NAME`
- **Runtime**: Python 3.12

### 5. `report-generator`
- **Trigger**: API Gateway (GET /download)
- **Propósito**: Genera y sirve reportes
- **Autenticación**: JWT (Cognito)
- **Runtime**: Python 3.12

### 6. `invoice-data-updater`
- **Trigger**: API Gateway (PUT /invoices/{id})
- **Propósito**: Actualiza datos de facturas
- **Autenticación**: JWT (Cognito)
- **Runtime**: Python 3.12

### 7. `invoice-data-getter`
- **Trigger**: API Gateway (GET /invoices)
- **Propósito**: Obtiene listado de facturas
- **Variables de entorno**: `TABLE_NAME`, `INDEX_NAME`
- **Autenticación**: JWT (Cognito)
- **Runtime**: Python 3.12

## ⚙️ Meta-argumentos y Configuraciones

### `for_each` - Iteración de Recursos

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

### `merge()` - Combinación de Variables

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

### `depends_on` - Dependencias Explícitas

```hcl
resource "aws_s3_bucket_notification" "uploads_trigger" {
  depends_on = [
    aws_lambda_permission.s3_invoke_processor
  ]
}
```

### `count` - Recursos Condicionales

```hcl
resource "aws_s3_bucket_versioning" "this" {
  count  = var.enable_versioning ? 1 : 0
  # Solo se crea si enable_versioning es true
}
```

## 🚀 Guía de Ejecución

### Prerrequisitos

1. **AWS CLI configurado**:
   ```bash
   aws configure
   ```

2. **Terraform instalado** (versión >= 1.0):
   ```bash
   terraform --version
   ```

3. **Permisos IAM necesarios**:
   - S3: Full access
   - Lambda: Full access
   - API Gateway: Full access
   - Cognito: Full access
   - DynamoDB: Full access
   - CloudWatch: Logs access

### Paso 1: Preparar el Entorno

```bash
# Clonar el repositorio
git clone <repository-url>
cd cloud-terraform

# Navegar al directorio de producción
cd production
```

### Paso 2: Configurar Variables

Editar `terraform.tfvars` según tus necesidades:

```hcl
# Configuración de buckets
buckets = {
  facturas = {
    bucket_name_base       = "mi-app-facturas"
    enable_versioning      = true
    enable_website_hosting = false
    content_tag            = "facturas"
  },
  spa = {
    bucket_name_base       = "mi-app-spa"
    enable_versioning      = false
    enable_website_hosting = true
    content_tag            = "spa"
  }
}

# Configuración de funciones Lambda
lambda_functions = {
  "cognito-post-auth" = {
    source_path = "../src/lambda-cognito-hook"
    handler     = "main.handler"
    runtime     = "python3.12"
  }
  # ... más funciones
}
```

### Paso 3: Inicializar Terraform

```bash
# Inicializar el directorio de trabajo
terraform init

# Verificar la configuración
terraform validate
```

### Paso 4: Planificar el Despliegue

```bash
# Crear un plan de ejecución
terraform plan -out=tfplan

# Revisar los recursos que se van a crear
terraform show tfplan
```

### Paso 5: Desplegar la Infraestructura

```bash
# Aplicar los cambios
terraform apply tfplan

# O aplicar directamente
terraform apply
```

### Paso 6: Verificar el Despliegue

```bash
# Ver el estado actual
terraform state list

# Ver outputs importantes
terraform output
```

### Paso 7: Configuración Post-Despliegue

1. **Configurar el frontend**:
   ```bash
   # Subir archivos del frontend al bucket SPA
   aws s3 sync ../frontend/ s3://<bucket-spa-name>/
   ```

2. **Configurar permisos IAM** (si es necesario):
   - Agregar políticas S3 al rol `LabRole`
   - Configurar permisos DynamoDB

3. **Probar la API**:
   ```bash
   # Obtener el endpoint de la API
   terraform output api_endpoint
   ```

## 📊 Variables de Configuración

### Variables Principales

| Variable | Tipo | Descripción | Valor por Defecto |
|----------|------|-------------|-------------------|
| `buckets` | `map(object)` | Configuración de buckets S3 | `{}` |
| `lambda_functions` | `map(object)` | Configuración de funciones Lambda | `{}` |
| `academy_role` | `string` | Nombre del rol IAM | `"LabRole"` |
| `region` | `string` | Región de AWS | `"us-east-1"` |
| `manage_iam` | `bool` | Gestionar roles IAM | `false` |
| `manage_lambda_log_group` | `bool` | Crear grupos de logs | `false` |

### Variables del Módulo S3

| Variable | Tipo | Descripción | Validaciones |
|----------|------|-------------|--------------|
| `bucket_name` | `string` | Nombre base del bucket | Máx. 56 caracteres, solo alfanuméricos y guiones |
| `enable_versioning` | `bool` | Activar versionado | - |
| `enable_website_hosting` | `bool` | Configurar para hosting web | Mutuamente excluyente con versioning |
| `tags` | `map(string)` | Etiquetas del bucket | - |

## 📁 Estructura del Proyecto

```
cloud-terraform/
├── modules/
│   └── s3_buckets/           # Módulo reutilizable para buckets S3
│       ├── main.tf           # Recursos principales
│       ├── variables.tf      # Variables de entrada
│       ├── outputs.tf        # Valores de salida
│       ├── locals.tf         # Cálculos locales
│       └── providers.tf      # Configuración de providers
├── production/               # Entorno de producción
│   ├── main.tf              # Recursos principales
│   ├── variables.tf         # Variables del entorno
│   ├── terraform.tfvars     # Valores de las variables
│   ├── providers.tf         # Configuración de providers
│   └── builds/              # Archivos de build
├── src/                     # Código fuente de las funciones Lambda
│   ├── lambda-cognito-hook/
│   ├── lambda-database-writer/
│   ├── lambda-invoice-processor/
│   ├── lambda-presigned-url-generator/
│   ├── lambda-report-generator/
│   ├── lambda-invoice-updater/
│   ├── lambda-invoice-getter/
│   └── lambda-layer.zip     # Dependencias compartidas
├── frontend/                # Aplicación frontend
│   ├── index.html
│   ├── main.js
│   ├── style.css
│   └── package.json
└── README.md               # Este archivo
```

## 🔧 Comandos Útiles

### Gestión de Estado

```bash
# Ver recursos desplegados
terraform state list

# Ver detalles de un recurso
terraform state show aws_s3_bucket.this

# Importar un recurso existente
terraform import aws_s3_bucket.this bucket-name

# Eliminar un recurso del estado
terraform state rm aws_s3_bucket.this
```

### Debugging

```bash
# Habilitar logs detallados
export TF_LOG=DEBUG
terraform apply

# Ver logs de una función Lambda
aws logs tail /aws/lambda/function-name --follow
```

### Limpieza

```bash
# Destruir todos los recursos
terraform destroy

# Destruir recursos específicos
terraform destroy -target=aws_s3_bucket.this
```

## 🚨 Consideraciones Importantes

1. **Nombres únicos**: Los buckets S3 requieren nombres globalmente únicos
2. **Permisos IAM**: Algunos entornos (como AWS Academy) tienen restricciones
3. **Costos**: Monitorear el uso de recursos para evitar costos inesperados
4. **Regiones**: Asegurar que todos los recursos estén en la misma región
5. **Dependencias**: Algunos recursos requieren configuración manual post-despliegue

## 📞 Soporte

Para problemas o preguntas:
1. Revisar los logs de CloudWatch
2. Verificar la configuración de permisos IAM
3. Consultar la documentación de AWS
4. Revisar el estado de Terraform con `terraform state list`

---

**Nota**: Este proyecto está diseñado para entornos de aprendizaje y desarrollo. Para producción, considerar implementar mejores prácticas de seguridad, monitoreo y respaldo.
