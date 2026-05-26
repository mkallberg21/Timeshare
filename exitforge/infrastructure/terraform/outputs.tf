output "eks_cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}

output "rds_endpoint" {
  value     = module.rds.db_instance_endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = aws_elasticache_cluster.redis.cache_nodes[0].address
  sensitive = true
}

output "kafka_bootstrap_brokers" {
  value     = aws_msk_cluster.kafka.bootstrap_brokers_tls
  sensitive = true
}

output "s3_documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}
