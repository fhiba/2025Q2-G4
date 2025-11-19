import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
TABLE = os.environ["TABLE_NAME"]

def handler(event, context):
    """
    Espera un input JSON como:
    {
        "file_key": "a12b3c4d.pdf",
        "updates": {
            "total": "25000.50",
            "fecha": "2025-10-22",
            "proveedor": "AGRO S.A."
        }
    }
    API Gateway v2 usually forwards the JSON body as a string in event['body'].
    """
    # Handle API Gateway proxy integration - body may be a string
    body = event.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            body = {}
    
    # Try to get from body first, then from event directly (for local testing)
    key = body.get("file_key") or event.get("file_key")
    updates = body.get("updates") or event.get("updates")

    if not key or not updates:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing file_key or updates"})
        }

    # Filtrar valores None/vacíos si es necesario, pero permitir null explícitos
    # Convertir strings vacíos a None para mantener consistencia
    filtered_updates = {}
    for field, value in updates.items():
        if value is not None and value != "":
            filtered_updates[field] = value
        elif value == "":
            # Permitir strings vacíos como None
            filtered_updates[field] = None
        else:
            filtered_updates[field] = value
    
    if not filtered_updates:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "No valid updates provided"})
        }

    table = dynamodb.Table(TABLE)

    # Construir expresión de actualización
    # Los campos se actualizan dentro del objeto "data"
    update_parts = []
    expr_attr_names = {"#data": "data"}  # Mapear #data a "data"
    expr_attr_values = {}
    
    for i, (field, value) in enumerate(filtered_updates.items()):
        update_parts.append(f"#data.#k{i} = :v{i}")
        expr_attr_names[f"#k{i}"] = field
        # Convertir None a null para DynamoDB
        expr_attr_values[f":v{i}"] = value if value is not None else None
    
    update_expr = "SET " + ", ".join(update_parts)

    try:
        # La tabla usa PK (file_key) y SK ("META#1") como claves primarias
        response = table.update_item(
            Key={
                "PK": key,      # Hash key
                "SK": "META#1"  # Range key (según database-writer)
            },
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_attr_names,
            ExpressionAttributeValues=expr_attr_values,
            ReturnValues="ALL_NEW"
        )

        # Convertir Decimal a tipos nativos de Python para JSON
        def convert_decimal(obj):
            """Convert Decimal objects to float for JSON serialization"""
            if isinstance(obj, Decimal):
                return float(obj)
            if isinstance(obj, dict):
                return {k: convert_decimal(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [convert_decimal(item) for item in obj]
            return obj
        
        updated_item = convert_decimal(response["Attributes"])
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Factura actualizada correctamente",
                "updated_item": updated_item
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
