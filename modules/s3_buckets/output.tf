output "bucket_name" {
  description = "El nombre del bucket creado."
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "El ARN del bucket."
  value       = aws_s3_bucket.this.arn
}

output "website_endpoint" {
  description = "El endpoint del sitio web (si está habilitado)."
  value       = var.enable_website_hosting ? aws_s3_bucket_website_configuration.this[0].website_endpoint : null
}
