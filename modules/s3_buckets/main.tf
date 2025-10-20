# para asegurar el nombre unico

resource "random_id" "suffix" {
  byte_length = 3
}


resource "aws_s3_bucket" "this" {
bucket = local.final_bucket_name
  tags   = merge(
    { "Name" = var.bucket_name },
    var.tags
  )

    lifecycle {
    precondition {
      condition     = !(var.enable_versioning && var.enable_website_hosting)
      
      error_message = "Error de configuración: Un bucket no puede ser un 'Sitio Web' y tener 'Versionado' al mismo tiempo. Elija solo una opción o ninguna."
    }
  }
}

resource "aws_s3_bucket_versioning" "this" {
  count  = var.enable_versioning ? 1 : 0

  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_website_configuration" "this" {
  count  = var.enable_website_hosting ? 1 : 0

  bucket = aws_s3_bucket.this.id

  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "error.html"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  # Si NO es un sitio web, bloquea todo.
  # Si ES un sitio web, permite el acceso público.
  block_public_acls       = !var.enable_website_hosting
  block_public_policy     = !var.enable_website_hosting
  ignore_public_acls      = !var.enable_website_hosting
  restrict_public_buckets = !var.enable_website_hosting
}

resource "aws_s3_bucket_policy" "this" {
  count  = var.enable_website_hosting ? 1 : 0
  bucket = aws_s3_bucket.this.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = "*",
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.this.arn}/*"
      }
    ]
  })
    depends_on = [
    aws_s3_bucket_public_access_block.this
  ]
}
