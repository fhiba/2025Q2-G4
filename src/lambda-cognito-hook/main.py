import json
import urllib.parse
import requests
import os

# Constantes de Cognito extraídas de las variables de entorno
CLIENT_ID = os.environ['COGNITO_CLIENT_ID']
REDIRECT_URI = os.environ['COGNITO_REDIRECT_URI']
COGNITO_TOKEN_URL = "https://"  + os.environ['COGNITO_DOMAIN'] + ".auth.us-east-1.amazoncognito.com/oauth2/token"

def handler(event, context):
    try:
        print(f"Event: {json.dumps(event)}")
        
        # Manejar queryStringParameters que puede ser None
        query_params = event.get('queryStringParameters') or {}
        code = query_params.get('code')
        state = query_params.get('state')
        
        print(f"Received code: {code}")
        print(f"Received state: {state}")
        
        if not code:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'Missing code parameter'
                })
            }

        # Intercambiar el code por los tokens
        payload = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': REDIRECT_URI,
            'client_id': CLIENT_ID
        }

        print(f"Exchanging code for tokens with payload: {payload}")
        
        response = requests.post(
            COGNITO_TOKEN_URL, 
            data=payload, 
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        print(f"Token exchange response status: {response.status_code}")
        print(f"Token exchange response: {response.text}")

        if response.status_code != 200:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': f'Failed to exchange code for tokens: {response.text}'
                })
            }

        tokens = response.json()
        access_token = tokens.get('access_token')
        id_token = tokens.get('id_token')
        refresh_token = tokens.get('refresh_token')

        if not access_token:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'Access token not found in response'
                })
            }

        # Decodificar el ID token para obtener información del usuario
        # Nota: En producción deberías verificar la firma del JWT
        user_info = {}
        if id_token:
            try:
                # Decodificar el payload del JWT (sin verificar firma para simplicidad)
                import base64
                payload_part = id_token.split('.')[1]
                # Agregar padding si es necesario
                payload_part += '=' * (4 - len(payload_part) % 4)
                decoded_payload = base64.urlsafe_b64decode(payload_part)
                user_data = json.loads(decoded_payload)
                
                user_info = {
                    'email': user_data.get('email', ''),
                    'name': user_data.get('name', user_data.get('given_name', '')),
                    'sub': user_data.get('sub', '')
                }
            except Exception as e:
                print(f"Error decoding ID token: {e}")
                user_info = {
                    'email': 'user@example.com',
                    'name': 'User',
                    'sub': 'unknown'
                }

        # Retornar JSON con los tokens (no redirección)
        # Redirigir al frontend con los tokens en la URL
        redirect_url = f"http://localhost:3000?access_token={access_token}&id_token={id_token}&refresh_token={refresh_token}"

        return {
            'statusCode': 302,  # Redirección HTTP
            'headers': {
                'Location': redirect_url  # Redirigir a la página de la aplicación
            }
        }
        
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': f'Internal server error: {str(e)}'
            })
        }
