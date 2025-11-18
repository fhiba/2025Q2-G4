import json
import os
import boto3

def handler(event, context):
    """
    Procesa eventos de S3 cuando se sube un archivo PDF.
    Envía mensajes a SQS para que database-writer los procese de forma asíncrona.
    """
    try:
        # Obtener la URL de la cola SQS desde las variables de entorno
        queue_url = os.environ.get('SQS_QUEUE_URL')
        if not queue_url:
            raise ValueError("SQS_QUEUE_URL no está configurada en las variables de entorno")
        
        sqs_client = boto3.client('sqs')
        
        # Extraer información del evento de S3
        records = event.get('Records', [])
        processed_count = 0
        
        for record in records:
            if record['eventSource'] == 'aws:s3':
                bucket = record['s3']['bucket']['name']
                key = record['s3']['object']['key']
                
                print(f"Enviando archivo a cola SQS: {key} del bucket: {bucket}")
                
                # Extraer user_id del path del archivo
                parts = key.split('/', 1)
                user_id = parts[0] if len(parts) > 1 else None

                # Crear mensaje para SQS
                message_body = {
                    "bucket": bucket,
                    "key": key,
                    "userId": user_id
                }
                
                # Enviar mensaje a SQS
                response = sqs_client.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps(message_body)
                )
                
                print(f"Mensaje enviado a SQS. MessageId: {response['MessageId']}")
                processed_count += 1
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'message': f'{processed_count} archivo(s) enviado(s) a la cola SQS para procesamiento',
                'processed_files': processed_count
            })
        }
        
    except Exception as e:
        print(f"Error procesando archivo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': str(e)
            })
        }
