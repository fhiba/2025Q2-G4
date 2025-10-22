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
    """
    key = event.get("file_key")
    updates = event.get("updates")

    if not key or not updates:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing file_key or updates"})
        }

    table = dynamodb.Table(TABLE)

    # Construir expresión de actualización
    update_expr = "SET " + ", ".join(f"#k{i} = :v{i}" for i, _ in enumerate(updates))
    expr_attr_names = {f"#k{i}": k for i, k in enumerate(updates)}
    expr_attr_values = {f":v{i}": v for i, v in enumerate(updates.values())}

    try:
        response = table.update_item(
            Key={"file_key": key},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_attr_names,
            ExpressionAttributeValues=expr_attr_values,
            ReturnValues="ALL_NEW"
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Factura actualizada correctamente",
                "updated_item": json.loads(json.dumps(response["Attributes"], parse_float=Decimal))
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
