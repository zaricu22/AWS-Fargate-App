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
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });

    // Tasks sit in PUBLIC subnets (no NAT gateway exists — see DataStack).
    // The task security group only allows inbound from the ALB's security
    // group (wired automatically by this L3 construct), so this is not
    // meaningfully less secure than a private subnet + NAT for a sample.
    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'BackendService', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      assignPublicIp: true,
      publicLoadBalancer: true,
      healthCheckGracePeriod: cdk.Duration.seconds(150),
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

    this.service.targetGroup.configureHealthCheck({
      path: '/actuator/health',
    });

    // dbInstance.connections.allowDefaultPortFrom(...) would add the ingress
    // rule to the DB's security group, which lives in DataStack, and that
    // rule would reference this stack's service SG -- creating a DataStack
    // -> BackendStack reference that cycles with BackendStack's existing
    // dependency on DataStack. Importing the DB's SG *into this stack* (as
    // mutable) keeps the new rule -- and the only cross-stack dependency --
    // in this stack instead.
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

    new cdk.CfnOutput(this, 'BackendUrl', {
      value: `http://${this.service.loadBalancer.loadBalancerDnsName}`,
    });
  }
}
