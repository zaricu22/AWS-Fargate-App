import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface BackendStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbInstance: rds.DatabaseInstance;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  issuerUri: string;
}

export class BackendStack extends cdk.Stack {
  // Used by Infra app entry when deploying and wiring props and deps between other stacks.
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });

    // Backend Service as Fargate Stateless Container with ALB (App Load Balancer):
    // Tasks sit in PUBLIC subnets of VPC (Virtual Private Cloud)
    // (can access/be accessed to/from internet, less secure, no need for NAT gateway - only private subnet)
    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'BackendService', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true,
      publicLoadBalancer: true,
      healthCheckGracePeriod: cdk.Duration.seconds(150),
      // 'docker build' local Dockerfile with db env variables
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../backend'),
        containerPort: 8080,
        environment: {
          COGNITO_ISSUER_URI: props.issuerUri,
          COGNITO_APP_CLIENT_ID: props.userPoolClient.userPoolClientId,
          SPRING_DATASOURCE_URL: `jdbc:postgresql://${props.dbInstance.instanceEndpoint.hostname}:${props.dbInstance.instanceEndpoint.port}/items`,
        },
        secrets: {
          SPRING_DATASOURCE_USERNAME: ecs.Secret.fromSecretsManager(props.dbInstance.secret!, 'username'),
          SPRING_DATASOURCE_PASSWORD: ecs.Secret.fromSecretsManager(props.dbInstance.secret!, 'password'),
        },
      },
    });

    // Configured in SpringBoot's application.yml
    this.service.targetGroup.configureHealthCheck({
      path: '/actuator/health',
    });

    // Re-import (not allowDefaultPortFrom) so the ingress rule is created here,
    // not in DataStack -- avoids a DataStack -> BackendStack cycle.
    const dbSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedDbSecurityGroup',
      props.dbInstance.connections.securityGroups[0].securityGroupId,
      { mutable: true },
    );
    dbSecurityGroup.addIngressRule(
      this.service.service.connections.securityGroups[0],
      ec2.Port.tcp(5432),
    );

    // If you execute stacks directly with cdk deploy, you can see these outputs in the console (like info return messages).
    new cdk.CfnOutput(this, 'BackendUrl', {
      value: `http://${this.service.loadBalancer.loadBalancerDnsName}`,
    });
  }
}
