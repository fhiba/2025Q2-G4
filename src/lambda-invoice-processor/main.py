import json
import boto3

def handler(event, context):
    """
    Procesa eventos de S3 cuando se sube un archivo PDF.
    Llama a database-writer para procesar el PDF.
    """
    try:
        # Extraer información del evento de S3
        records = event.get('Records', [])
        
        for record in records:
            if record['eventSource'] == 'aws:s3':
                bucket = record['s3']['bucket']['name']
                key = record['s3']['object']['key']
                
                print(f"Procesando archivo: {key} del bucket: {bucket}")
                
                # Llamar a database-writer para procesar el PDF
                lambda_client = boto3.client('lambda')
                
                payload = {
                    "bucket": bucket,
                    "key": key
                }
                
                response = lambda_client.invoke(
                    FunctionName='database-writer',
                    InvocationType='RequestResponse',
                    Payload=json.dumps(payload)
                )
                
                result = json.loads(response['Payload'].read())
                print(f"Resultado de database-writer: {result}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'message': 'PDF procesado correctamente',
                'processed_files': len(records)
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
