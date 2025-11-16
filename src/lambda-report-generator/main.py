import json
import os
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")


def _convert_decimal(obj):
    """Convert Decimal objects to string for JSON serialization"""
    if isinstance(obj, Decimal):
        return str(obj)
    raise TypeError
TABLE = os.environ.get("TABLE_NAME")
INDEX_NAME = os.environ.get("INDEX_NAME", "GSI_User_Group")


def _extract_username_from_event(event: dict):
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


def _get_file_key_from_event(event: dict):
    """Extract file_key from query string parameters"""
    qsp = event.get("queryStringParameters") if isinstance(event, dict) else None
    if qsp:
        return qsp.get("file_key")
    return None


def handler(event, context):
    if not TABLE:
        return {"statusCode": 500, "body": json.dumps({"error": "Missing TABLE_NAME env var"})}

    username = _extract_username_from_event(event)
    if not username:
        return {"statusCode": 400, "body": json.dumps({"error": "Missing 'username' parameter or JWT claim"})}

    file_key = _get_file_key_from_event(event)
    
    table = dynamodb.Table(TABLE)

    try:
        response = table.query(
            IndexName=INDEX_NAME,
            KeyConditionExpression=Key("userId").eq(username)
        )
        items = response.get("Items", [])

        # Filter by file_key if provided
        if file_key:
            items = [item for item in items if item.get("file_key") == file_key]
            if not items:
                return {"statusCode": 404, "body": json.dumps({"error": "Invoice not found"}, default=_convert_decimal)}
            # Return single invoice data
            item = items[0]
            data = item.get("data", {})
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"file_key": file_key, "data": data}, ensure_ascii=False, default=_convert_decimal)
            }
        
        # Return all invoices (filtered only fields needed)
        facturas = []
        for item in items:
            data = item.get("data", {})
            factura = {
                "fecha": data.get("fecha", None),
                "total": data.get("total", None),
                "proveedor": data.get("proveedor", None),
                "cuit": data.get("cuit", None),
                "text_length": data.get("text_length", None),
                "file_size": data.get("file_size", None)
            }
            facturas.append(factura)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"username": username, "facturas": facturas}, ensure_ascii=False, default=_convert_decimal),
        }

    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
