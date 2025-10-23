import json
import boto3
import os

s3 = boto3.client("s3")
BUCKET = os.environ["UPLOAD_BUCKET"]

def handler(event, context):
    """
    Espera un input JSON como:
    {
        "file_key": "a12b3c4d.pdf"
    }
    Devuelve un presigned URL de descarga válido 1 hora.
    """
    key = event.get("file_key")
    if not key:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing 'file_key' parameter"})
        }

    try:
        # Generar URL de descarga
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": key},
            ExpiresIn=3600  # segundos (1 hora)
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "download_url": presigned_url,
                "file_key": key
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
