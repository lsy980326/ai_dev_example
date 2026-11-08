resource "aws_cloudwatch_log_group" "main" {
  name              = "/ecs/${var.name}"
  retention_in_days = 14
}
resource "aws_ecs_cluster" "main" { name = var.name }
resource "aws_service_discovery_http_namespace" "main" { name = "${var.name}.internal" }
locals {
  jdbc = "jdbc:postgresql://${aws_db_instance.main.address}:5432/study?sslmode=verify-full&sslrootcert=/app/rds-ca.pem"
  app_env = {
    APP_MODE      = "production"
    DATABASE_URL  = local.jdbc
    DATABASE_USER = "study_app"
    OIDC_ISSUER   = var.oidc_issuer
    OIDC_JWKS_URI = var.oidc_jwks_uri
  }
  env = {
    api       = local.app_env
    migration = { APP_MODE = "production", DATABASE_URL = local.jdbc, DATABASE_USER = "study_migrator" }
    bootstrap = { APP_MODE = "production", DATABASE_URL = local.jdbc, DATABASE_USER = "study_owner" }
    web = {
      APP_MODE     = "production", APP_ORIGIN = "https://${var.domain}", NEXTAUTH_URL = "https://${var.domain}",
      OIDC_ISSUER  = var.oidc_issuer, OIDC_DISCOVERY_URL = var.oidc_discovery_url, OIDC_CLIENT_ID = var.oidc_client_id,
      API_BASE_URL = "http://study-api:8080", HOSTNAME = "0.0.0.0", PORT = "3000"
    }
  }
  secrets = {
    api       = { DATABASE_PASSWORD = aws_secretsmanager_secret.app["app-db"].arn }
    migration = { DATABASE_PASSWORD = aws_secretsmanager_secret.app["migrator-db"].arn }
    bootstrap = { DATABASE_PASSWORD = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::", MIGRATOR_PASSWORD = aws_secretsmanager_secret.app["migrator-db"].arn, APP_DB_PASSWORD = aws_secretsmanager_secret.app["app-db"].arn }
    web       = { NEXTAUTH_SECRET = aws_secretsmanager_secret.app["web-session"].arn, OIDC_CLIENT_SECRET = aws_secretsmanager_secret.app["oidc-client"].arn }
  }
}
resource "aws_ecs_task_definition" "app" {
  for_each                 = toset(["web", "api", "migration", "bootstrap"])
  family                   = "${var.name}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution[each.key].arn
  task_role_arn            = aws_iam_role.task[each.key].arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
  # Foundation starts no containers. deploy.mjs replaces this reference with an ECR digest.
  container_definitions = jsonencode([merge({
    name             = each.key == "web" ? "web" : "api"
    image            = "${aws_ecr_repository.app[each.key == "web" ? "web" : "api"].repository_url}:foundation-not-pushed"
    essential        = true
    user             = "10001"
    environment      = [for name, value in local.env[each.key] : { name = name, value = value }]
    secrets          = [for name, value in local.secrets[each.key] : { name = name, valueFrom = value }]
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.main.name, awslogs-region = var.region, awslogs-stream-prefix = each.key } }
    linuxParameters  = { initProcessEnabled = true, capabilities = { drop = ["ALL"] } }
    }, contains(["web", "api"], each.key) ? { portMappings = [{ name = each.key, containerPort = each.key == "web" ? 3000 : 8080, protocol = "tcp", appProtocol = "http" }] } : {},
    each.key == "migration" ? { command = ["--spring.profiles.active=migration"] } : {},
    each.key == "bootstrap" ? { command = ["--spring.profiles.active=bootstrap"] } : {}
  )])
}
resource "aws_ecs_service" "app" {
  for_each                           = toset(["api", "web"])
  name                               = "${var.name}-${each.key}"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.app[each.key].arn
  desired_count                      = 0
  launch_type                        = "FARGATE"
  platform_version                   = "1.4.0"
  health_check_grace_period_seconds  = 90
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.service[each.key].id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.service[each.key].arn
    container_name   = each.key
    container_port   = each.key == "web" ? 3000 : 8080
  }
  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_http_namespace.main.arn
    dynamic "service" {
      for_each = each.key == "api" ? [1] : []
      content {
        port_name      = "api"
        discovery_name = "study-api"
        client_alias {
          dns_name = "study-api"
          port     = 8080
        }
      }
    }
    log_configuration {
      log_driver = "awslogs"
      options    = { awslogs-group = aws_cloudwatch_log_group.main.name, awslogs-region = var.region, awslogs-stream-prefix = "connect-${each.key}" }
    }
  }
  lifecycle { ignore_changes = [task_definition, desired_count] }
  depends_on = [aws_lb_listener_rule.route, aws_iam_role_policy.execution]
}
