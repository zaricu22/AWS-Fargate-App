import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface FrontendStackProps extends cdk.StackProps {
  loadBalancer: elbv2.ApplicationLoadBalancer;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  userPoolDomain: cognito.UserPoolDomain;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // Routes /api/* to the ALB through the SAME distribution, so the
      // Angular app's API calls are same-origin -> no CORS needed in prod.
      // CloudFront->ALB hop is plain HTTP (no ACM cert for this sample);
      // the public-facing hop is still HTTPS via CloudFront.
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(props.loadBalancer.loadBalancerDnsName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      // SPA deep-link/refresh fix: unknown paths (client-side routes) fall
      // back to index.html instead of a raw S3 404.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    const cognitoDomain = `https://${props.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`;

    // Written directly from CDK-known values so redeploying infra alone
    // (without an `ng build`) still reaches the frontend on next page load.
    new s3deploy.BucketDeployment(this, 'DeployRuntimeConfig', {
      sources: [
        s3deploy.Source.jsonData('runtime-config.json', {
          cognitoUserPoolId: props.userPool.userPoolId,
          cognitoClientId: props.userPoolClient.userPoolClientId,
          cognitoDomain,
          region: this.region,
          apiBaseUrl: '/api',
        }),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/runtime-config.json'],
      cacheControl: [s3deploy.CacheControl.noCache()],
      prune: false,
    });

    // Hashed JS/CSS bundles: long cache, safe because Angular's build hashes
    // filenames on every change.
    new s3deploy.BucketDeployment(this, 'DeploySiteAssets', {
      sources: [s3deploy.Source.asset('../frontend/dist/frontend/browser')],
      destinationBucket: siteBucket,
      cacheControl: [s3deploy.CacheControl.maxAge(cdk.Duration.days(365))],
      exclude: ['index.html'],
      prune: false,
    });

    // index.html: no-cache, so a new deploy is picked up immediately.
    new s3deploy.BucketDeployment(this, 'DeployIndexHtml', {
      sources: [s3deploy.Source.asset('../frontend/dist/frontend/browser', { exclude: ['*', '!index.html'] })],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/index.html', '/'],
      cacheControl: [s3deploy.CacheControl.noCache()],
      prune: false,
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
  }
}
