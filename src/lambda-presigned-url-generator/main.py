import json
import boto3
import os
import uuid


s3 = boto3.client("s3")
BUCKET = os.environ["UPLOAD_BUCKET"]

def handler(event, context):
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    # API Gateway may forward the POST body as a JSON string in event['body']
    file_name = None
    if isinstance(event, dict):
        file_name = event.get("fileName")
        body = event.get("body")
        if not file_name and body:
            try:
                parsed = json.loads(body)
                file_name = parsed.get("fileName")
            except Exception:
                file_name = None
    if not file_name:
        file_name = "document"
    file_id = str(uuid.uuid4()) + "_" + file_name + ".pdf"
    key = f"{user_id}/{file_id}"
    presigned_url = s3.generate_presigned_post(Bucket=BUCKET, Key=f"{key}", ExpiresIn=3000)
    return {
        "statusCode": 200,
        "body": json.dumps({
            "upload_url": presigned_url,
            "file_key": file_id
        })

}
