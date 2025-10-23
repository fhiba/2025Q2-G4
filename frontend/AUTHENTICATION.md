# Flujo de Autenticación con Cognito

## Flujo Correcto Implementado

### 1. **Inicio del Login**
- Usuario hace clic en el botón "Login"
- Frontend redirige directamente a **Cognito Hosted UI**
- URL: `https://factutable.auth.us-east-1.amazoncognito.com/oauth2/authorize`

### 2. **Autenticación en Cognito**
- Usuario ve la página de login oficial de Cognito
- Ingresa sus credenciales
- Cognito valida las credenciales

### 3. **Callback a tu Lambda**
- Cognito redirige de vuelta a tu aplicación con un código de autorización
- Tu **Lambda** recibe el callback en: `/auth/callback`
- La Lambda intercambia el código por tokens de Cognito
- La Lambda redirige al frontend con los tokens

### 4. **Frontend Recibe Tokens**
- El frontend recibe los tokens y los almacena
- La aplicación se actualiza para mostrar el estado autenticado

## Configuración Requerida

### 1. **Cognito User Pool**
- **User Pool ID**: `us-east-1_qHAOMktEx`
- **App Client ID**: `420n6qdmj501gimcc11q6rb4ri`
- **Domain**: `factutable.auth.us-east-1.amazoncognito.com`

### 2. **Callback URLs en Cognito**
Configurar en tu User Pool las siguientes URLs de callback:
- `http://localhost:3000` (desarrollo)
- `https://tu-dominio-s3.com` (producción)

### 3. **Lambda de Callback**
Tu lambda debe manejar el endpoint `/auth/callback` con:

**Request:**
```json
{
  "code": "código_de_autorización_de_cognito",
  "state": "estado_de_seguridad",
  "redirectUri": "http://localhost:3000"
}
```

**Response:**
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

## Código de la Lambda de Callback

```python
import json
import boto3
from urllib.parse import parse_qs

def lambda_handler(event, context):
    # Parse the request body
    body = json.loads(event['body'])
    code = body['code']
    state = body['state']
    redirect_uri = body['redirectUri']
    
    # Exchange code for tokens using Cognito
    cognito_client = boto3.client('cognito-idp')
    
    try:
        response = cognito_client.initiate_auth(
            ClientId='420n6qdmj501gimcc11q6rb4ri',
            AuthFlow='AUTHORIZATION_CODE',
            AuthParameters={
                'CODE': code,
                'REDIRECT_URI': redirect_uri
            }
        )
        
        tokens = response['AuthenticationResult']
        
        # Get user info from ID token (you might want to decode it)
        # For now, we'll return basic info
        user_info = {
            'email': 'user@example.com',  # Extract from ID token
            'name': 'User Name',          # Extract from ID token
            'sub': 'user-id'              # Extract from ID token
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'tokens': {
                    'accessToken': tokens['AccessToken'],
                    'idToken': tokens['IdToken'],
                    'refreshToken': tokens['RefreshToken']
                },
                'user': user_info
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 400,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
```

## Configuración del Frontend

### Variables de Configuración
```javascript
export const CONFIG = {
  COGNITO: {
    region: "us-east-1",
    userPoolId: "us-east-1_qHAOMktEx",
    userPoolWebClientId: "420n6qdmj501gimcc11q6rb4ri",
    domain: "factutable.auth.us-east-1.amazoncognito.com"
  },
  COGNITO_CALLBACK_ENDPOINT: "https://z1kcp1gyik.execute-api.us-east-1.amazonaws.com/prod/auth/callback"
};
```

## Flujo de Logout

1. Usuario hace clic en "Logout"
2. Frontend limpia los tokens locales
3. Frontend redirige a Cognito logout
4. Cognito redirige de vuelta a la aplicación

## Ventajas de este Flujo

- ✅ **Seguro**: Los tokens nunca pasan por el frontend durante el intercambio
- ✅ **Estándar**: Usa OAuth2/OpenID Connect estándar
- ✅ **UI Oficial**: Usa la página de login oficial de Cognito
- ✅ **Escalable**: Cognito maneja la autenticación y autorización
- ✅ **MFA**: Soporte automático para MFA si está configurado

## Testing

1. **Desarrollo Local**: `http://localhost:3000`
2. **Producción**: Tu dominio S3 configurado en Cognito
3. **Verificar**: Que las URLs de callback estén configuradas en Cognito
