import boto3
import json
import os
import io
import re
import PyPDF2
from decimal import Decimal

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
TABLE = os.environ["TABLE_NAME"]


# --- helpers para detectar campos comunes ---
def parse_invoice_text(text):
    data = {}

    # Buscar monto total (números con coma o punto)
    match_total = re.search(r"(total|importe)\D+([\d.,]+)", text, re.IGNORECASE)
    if match_total:
        data["total"] = match_total.group(2).replace(",", ".")

    # Buscar fecha
    match_date = re.search(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text)
    if match_date:
        data["fecha"] = match_date.group(1)

    # Buscar CUIT
    match_cuit = re.search(r"(?:CUIT|C.U.I.T)\D*(\d{2}-\d{8}-\d)", text, re.IGNORECASE)
    if match_cuit:
        data["cuit"] = match_cuit.group(1)

    # Buscar proveedor
    match_prov = re.search(r"(?:razón social|proveedor|empresa):?\s*([A-ZÁÉÍÓÚÑ ]+)", text, re.IGNORECASE)
    if match_prov:
        data["proveedor"] = match_prov.group(1).strip()

    return data


def handler(event, context):
    # Entrada esperada: {"bucket": "...", "key": "..."}
    bucket = event["bucket"]
    key = event["key"]
    user_id = event["userId"]
    try:
        # Descargar el PDF desde S3
        pdf_stream = io.BytesIO()
        s3.download_fileobj(bucket, key, pdf_stream)
        pdf_stream.seek(0)
        
        # Verificar el tamaño del archivo
        file_size = pdf_stream.getbuffer().nbytes
        if file_size < 100:  # PDFs válidos son generalmente más grandes
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": f"Archivo muy pequeño ({file_size} bytes), posiblemente corrupto",
                    "file_key": key
                })
            }

        # Extraer texto con PyPDF2
        all_text = ""
        try:
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            for page in pdf_reader.pages:
                all_text += page.extract_text() + "\n"
        except Exception as pdf_error:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": f"Error al leer PDF: {str(pdf_error)}",
                    "file_key": key,
                    "file_size": file_size
                })
            }

        # Parsear datos relevantes
        extracted_data = parse_invoice_text(all_text)
        extracted_data["file_size"] = file_size
        extracted_data["text_length"] = len(all_text)

        # Guardar en DynamoDB
        table = dynamodb.Table(TABLE)
        table.put_item(
            Item={
                "PK": key,                 # must match your Dynamo table PK
                "SK": "META#1",
                "file_key": key,
                "userId": user_id,
                "groupKey": "group_key",
                "data": json.loads(json.dumps(extracted_data), parse_float=Decimal)
            }
        )

        return {
            "statusCode": 200,
            "body": json.dumps(extracted_data)
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e),
                "file_key": key
            })
        }
