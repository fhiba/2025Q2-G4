variable "bucket_name" {
  description = "El nombre único global para el bucket S3."
  type        = string
    # longitud no excedida, nosotros sumamos un hash para asegurar uniqueness.
    validation {
    condition     = length(var.bucket_name) <= 56
    error_message = "El 'bucket_name' base no puede tener más de 56 caracteres, para dejar espacio al sufijo único (-xxxxxx)."
  }
    # nombre con formato correcto
    validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.bucket_name))
    
    error_message = "El 'bucket_name' base solo puede contener letras (a-z, A-Z), números (0-9) y guiones (-). No se permiten espacios, puntos, ni guiones bajos (_)."
  }
}

variable "enable_versioning" {
  description = "Activa el versionado"
  type        = bool
  default     = false
}

variable "enable_website_hosting" {
  description = "Configura el bucket para hostear un sitio web estático (para la SPA)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Etiquetas para el bucket."
  type        = map(string)
  default     = {}
}
