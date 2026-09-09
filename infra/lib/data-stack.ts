import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

export class DataStack extends cdk.Stack {
  // Used by Infra app entry when deploying and wiring props and deps between other stacks.
  public readonly vpc: ec2.Vpc;
  public readonly dbInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define VPC (Virtual Private Cloud) with public (Fargate Service) and isolated (RDS) subnets, no NAT gateways.
    // VPC: Everything that needs networking — the RDS database, the ECS Fargate tasks, the ALB — has to live inside some VPC.
    // It's the foundational network boundary for the whole app.
    // NAT gateway: managed AWS resource you can add to VPC's public subnet, whose only job is:
    // let things in a private subnet make outbound internet connections (pull a Docker image, call an external API)
    // without being reachable from the internet themselves. It's not a network of its own.
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // Create RDS (Relational Database Service) PostgreSQL instance in isolated subnet, not publicly accessible.
    // Prepared DB seed data is loaded by SpringBoot's Flyway migration.
    this.dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      databaseName: 'items',
      publiclyAccessible: false,
      allocatedStorage: 20,
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });
  }
}
