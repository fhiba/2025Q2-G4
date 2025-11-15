import json
import boto3
import os
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
TABLE = os.environ.get("TABLE_NAME")
INDEX_NAME = os.environ.get("INDEX_NAME", "GSI_User_Group")


def _extract_username_from_event(event: dict):
    # 1) direct field (used when invoking lambda directly)
    if isinstance(event, dict) and event.get("username"):
        return event.get("username")

    # 2) query string parameters (HTTP API GET ?username=...)
    qsp = event.get("queryStringParameters") if isinstance(event, dict) else None
    if qsp and qsp.get("username"):
        return qsp.get("username")

    # 3) HTTP API v2 JWT authorizer claims
    try:
        claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
        if claims:
            # prefer cognito:username, then email, then sub
            return claims.get("cognito:username") or claims.get("email") or claims.get("sub")
    except Exception:
        pass

    return None


def handler(event, context):
    # Ensure env var
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

        facturas = response.get("Items", [])

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"username": username, "facturas": facturas}, ensure_ascii=False)
        }

    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
