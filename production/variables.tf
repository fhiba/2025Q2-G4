variable "buckets" {
  description = "Un mapa de configuraciones para todos los buckets S3 del entorno."
  type = map(object({
    bucket_name_base       = string
    enable_versioning      = bool
    enable_website_hosting = bool
    content_tag            = string
  }))
  default = {}
}

variable "lambda_functions" {
  description = "Un mapa de configuraciones para las funciones Lambda."
  type = map(object({
    source_path = string
    handler     = string
    runtime     = string
    environment = optional(map(string))
  }))
  default = {}
}

variable "academy_role" {
  description = "El nombre del rol IAM para el laboratorio de la academia."
  type        = string
  default     = "LabRole"
}

variable "region" {
  description = "La región de AWS para desplegar los recursos."
  type        = string
  default     = "us-east-1"
}


variable "manage_iam" {
  description = "Whether Terraform should create/modify IAM roles/policies (Learner Lab often forbids this)."
  type        = bool
  default     = false
}


variable "manage_lambda_log_group" {
  description = "Whether Terraform should create the Lambda log group explicitly. If false, let Lambda create it automatically."
  type        = bool
  default     = false
}
