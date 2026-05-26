variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "eks_cluster_version" {
  type    = string
  default = "1.30"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "kafka_broker_count" {
  type    = number
  default = 3
}
