import json
import boto3
import os
import re
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


def _parse_filename_from_s3_key(file_key: str) -> str:
    """
    Extract filename from S3 key.
    Format: username_filename.pdf -> filename
    """
    try:
        # Get the basename (last part after /)
        basename = file_key.split('/')[-1]
        # Extract text between first _ and .pdf
        match = re.search(r'_(.+?)\.pdf$', basename, re.IGNORECASE)
        if match:
            return match.group(1)
        # Fallback: return basename without extension
        return basename.replace('.pdf', '').replace('.PDF', '')
    except Exception:
        return file_key


def handler(event, context):
    if not TABLE:
        return {"statusCode": 500, "body": json.dumps({"error": "Missing TABLE_NAME env var"})}

    username = _extract_username_from_event(event)
    if not username:
        return {"statusCode": 400, "body": json.dumps({"error": "Missing 'username' parameter or JWT claim"})}

    table = dynamodb.Table(TABLE)

    try:
        response = table.query(
            IndexName=INDEX_NAME,
            KeyConditionExpression=Key("userId").eq(username)
        )

        items = response.get("Items", [])
        
        # Build response with file_key and parsed filename
        facturas = []
        for item in items:
            file_key = item.get("file_key", "")
            filename = _parse_filename_from_s3_key(file_key)
            factura = {
                "file_key": file_key,
                "filename": filename
            }
            facturas.append(factura)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"username": username, "facturas": facturas}, ensure_ascii=False)
        }

    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
