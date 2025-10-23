# Factutable Frontend

Aplicación frontend para el sistema de procesamiento de facturas PDF con autenticación Cognito y upload mediante presigned URLs.

## Características

- 🔐 Autenticación con AWS Cognito a través de lambda intermedia
- 📁 Upload de archivos PDF usando presigned URLs de S3
- 🎨 Interfaz moderna y responsiva
- ⚡ Procesamiento asíncrono de archivos

## Configuración

### 1. Endpoints de API

Antes de usar la aplicación, necesitas configurar los endpoints en `config.js`:

```javascript
export const CONFIG = {
  // Reemplaza con tu API Gateway endpoint real
  API_GATEWAY_ENDPOINT: "https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/prod",
  
  // Reemplaza con tu lambda de autenticación Cognito
  COGNITO_LAMBDA_ENDPOINT: "https://your-api-gateway-id.execute-api.us-east-1.amazonaws.com/prod/auth",
  
  // Configuración de Cognito (se obtiene dinámicamente de la lambda)
  COGNITO: {
    region: "us-east-1",
    userPoolId: "us-east-1_XXXXXXXXX", // Se proporciona por la lambda
    userPoolWebClientId: "xxxxxxxxxxxxxxxxxxxxxxxxxx", // Se proporciona por la lambda
    identityPoolId: "us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" // Se proporciona por la lambda
  }
};
```

### 2. Lambda de Autenticación Cognito

La aplicación espera que tengas una lambda que maneje la autenticación con Cognito. Esta lambda debe exponer los siguientes endpoints:

#### GET `/auth/config`
Retorna la configuración de Cognito:
```json
{
  "userPoolId": "us-east-1_XXXXXXXXX",
  "userPoolWebClientId": "xxxxxxxxxxxxxxxxxxxxxxxxxx",
  "identityPoolId": "us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "region": "us-east-1"
}
```

#### GET `/auth/login`
Inicia el flujo de autenticación OAuth2 con Cognito. Debe redirigir al usuario a Cognito.

#### POST `/auth/callback`
Maneja el callback de Cognito y retorna los tokens:
```json
{
  "success": true,
  "tokens": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ..."
  },
  "user": {
    "email": "user@example.com",
    "name": "John Doe",
    "sub": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

#### GET `/auth/logout`
Cierra la sesión del usuario en Cognito.

### 3. API Gateway para Presigned URLs

La aplicación necesita un endpoint que genere presigned URLs para S3:

#### POST `/presigned-url`
Genera una presigned URL para upload:
```json
{
  "fileName": "invoice.pdf",
  "fileType": "application/pdf"
}
```

Respuesta:
```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/invoice.pdf?X-Amz-Algorithm=...",
  "fileName": "processed-invoice.pdf",
  "expiresIn": 3600
}
```

#### POST `/process`
Procesa un archivo subido:
```json
{
  "fileName": "processed-invoice.pdf"
}
```

Respuesta:
```json
{
  "success": true,
  "result": {
    "invoiceId": "inv_123456",
    "status": "processed",
    "extractedData": { ... }
  }
}
```

## Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Construir para producción
npm run build
```

## Flujo de Autenticación

1. El usuario hace clic en "Login"
2. Se redirige a la lambda de autenticación
3. La lambda redirige a Cognito
4. El usuario se autentica en Cognito
5. Cognito redirige de vuelta a la lambda con un código de autorización
6. La lambda intercambia el código por tokens
7. La lambda redirige al frontend con los tokens
8. El frontend almacena los tokens y actualiza la UI

## Flujo de Upload

1. El usuario selecciona un archivo PDF
2. Al enviar, se solicita una presigned URL al API Gateway
3. Se sube el archivo directamente a S3 usando la presigned URL
4. Se llama al endpoint de procesamiento
5. Se muestra el resultado al usuario

## Estructura de Archivos

- `index.html` - Página principal
- `main.js` - Lógica principal de la aplicación
- `config.js` - Configuración y manejo de autenticación
- `uploadService.js` - Servicio para manejo de uploads
- `style.css` - Estilos de la aplicación
- `package.json` - Dependencias del proyecto

## Dependencias

- `aws-amplify` - SDK de AWS para autenticación
- `aws-sdk` - SDK de AWS para servicios
- `vite` - Herramienta de build y desarrollo

## Notas de Seguridad

- Los tokens se almacenan en localStorage (considera usar sessionStorage para mayor seguridad)
- Todas las llamadas a la API incluyen el token de autorización
- Las presigned URLs tienen tiempo de expiración limitado
- El frontend no maneja credenciales de AWS directamente