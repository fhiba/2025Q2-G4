import json
import os
import boto3
import csv
import io
import base64
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
TABLE = os.environ.get("TABLE_NAME")
INDEX_NAME = os.environ.get("INDEX_NAME", "GSI_User_Group")


def _extract_username_from_event(event: dict):
    # Extract username from JWT via API Gateway
    if isinstance(event, dict) and event.get("username"):
        return event.get("username")
    qsp = event.get("queryStringParameters") if isinstance(event, dict) else None
    if qsp and qsp.get("username"):
        return qsp.get("username")
    try:
        claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
        if claims:
            return claims.get("cognito:username") or claims.get("email") or claims.get("sub")
    except Exception:
        pass
    return None


def handler(event, context):
    if not TABLE:
        return {"statusCode": 500, "body": json.dumps({"error": "Missing TABLE_NAME env var"})}

    username = _extract_username_from_event(event)
    if not username:
        return {"statusCode": 400, "body": json.dumps({"error": "Missing 'username' parameter or JWT claim"})}

    table = dynamodb.Table(TABLE)

    try:
        # Query solo los items del usuario autenticado
        response = table.query(
            IndexName=INDEX_NAME,
            KeyConditionExpression=Key("userId").eq(username)
        )
        items = response.get("Items", [])

        # Build CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["fecha", "proveedor", "total", "cuit"])
        writer.writeheader()
        
        for item in items:
            data = item.get("data", {})
            row = {
                "fecha": data.get("fecha", ""),
                "proveedor": data.get("proveedor", ""),
                "total": data.get("total", ""),
                "cuit": data.get("cuit", "")
            }
            writer.writerow(row)

        csv_bytes = output.getvalue().encode("utf-8")
        encoded = base64.b64encode(csv_bytes).decode("utf-8")

        return {
            "statusCode": 200,
            "isBase64Encoded": True,
            "headers": {
                "Content-Type": "text/csv",
                "Content-Disposition": f"attachment; filename=export_{username}.csv"
            },
            "body": encoded
        }

    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}

