output "deploy_config" {
  value = {
    region             = var.region
    cluster            = aws_ecs_cluster.main.name
    subnets            = aws_subnet.private[*].id
    api_security_group = aws_security_group.service["api"].id
    repositories       = { for k, r in aws_ecr_repository.app : k => r.repository_url }
    services           = { for k, s in aws_ecs_service.app : k => s.name }
    tasks              = { for k, t in aws_ecs_task_definition.app : k => t.arn }
    secret_arns        = { for k, s in aws_secretsmanager_secret.app : k => s.arn }
    deploy_role_arn    = aws_iam_role.deploy.arn
    app_url            = "https://${var.domain}"
    api_url            = "https://api.${var.domain}"
  }
}
