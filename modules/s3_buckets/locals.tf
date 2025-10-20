locals {
  name_lower = lower(var.bucket_name)

  unique_suffix = random_id.suffix.hex

  final_bucket_name = format("%s-%s", local.name_lower, local.unique_suffix)
}
