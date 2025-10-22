import json
import boto3
import os
import uuid


s3 = boto3.client("s3")
BUCKET = os.environ["UPLOAD_BUCKET"]

def handler(event, context):
    file_id = str(uuid.uuid4()) + ".pdf"
    presigned_url = s3.generate_presigned_post(Bucket=BUCKET, Key=f"{file_id}", ExpiresIn=3000)
    return {
        "statusCode": 200,
        "body": json.dumps({
            "upload_url": presigned_url,
            "file_key": file_id
        })

}
