import boto3
import json
import os
import io
import re
import pdfplumber
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


def lambda_handler(event, context):
    # Entrada esperada: {"bucket": "...", "key": "..."}
    bucket = event["bucket"]
    key = event["key"]

    # Descargar el PDF desde S3
    pdf_stream = io.BytesIO()
    s3.download_fileobj(bucket, key, pdf_stream)
    pdf_stream.seek(0)

    # Extraer texto con pdfplumber
    all_text = ""
    with pdfplumber.open(pdf_stream) as pdf:
        for page in pdf.pages:
            all_text += page.extract_text() + "\n"

    # Parsear datos relevantes
    extracted_data = parse_invoice_text(all_text)

    # Guardar en DynamoDB
    table = dynamodb.Table(TABLE)
    table.put_item(
        Item={
            "file_key": key,
            "data": json.loads(json.dumps(extracted_data), parse_float=Decimal)
        }
    )

    return {
        "statusCode": 200,
        "body": json.dumps(extracted_data)
    }
