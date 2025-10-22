import json
import boto3
import os
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
TABLE = os.environ["TABLE_NAME"]
INDEX_NAME = os.environ.get("INDEX_NAME", "GSI_Date")  # nombre real del índice

def lambda_handler(event, context):
    """
    Espera un input JSON como:
    {
        "username": "juan"
    }

    Devuelve:
    {
        "username": "juan",
        "facturas": [
            {
                "file_key": "abc123.pdf",
                "userId": "juan",
                "data": {
                    "total": "1200.50",
                    "fecha": "2025-10-22",
                    "proveedor": "AGROTECH SRL"
                }
            },
            ...
        ]
    }
    """
    username = event.get("username")
    if not username:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing 'username' parameter"})
        }

    table = dynamodb.Table(TABLE)

    try:
        # ✅ Consultar usando el índice correcto y la clave "userId"
        response = table.query(
            IndexName=INDEX_NAME,
            KeyConditionExpression=Key("userId").eq(username)
        )

        facturas = response.get("Items", [])

        return {
            "statusCode": 200,
            "body": json.dumps({
                "username": username,
                "facturas": facturas
            }, ensure_ascii=False)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
