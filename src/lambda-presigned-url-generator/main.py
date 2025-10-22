import json
import boto3
import os
import uuid


s3 = boto3.client("s3")
BUCKET = os.environ["UPLOAD_BUCKET"]

def handler(event, context):
    file_id = str(uuid.uuid4()) + ".pdf"
    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": file_id, "ContentType": "application/pdf"},
        ExpiresIn=3600
    )
    return {
        "statusCode": 200,
        "body": json.dumps({
            "upload_url": presigned_url,
            "file_key": file_id
        })

}
