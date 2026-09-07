import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface AuthStackProps extends cdk.StackProps {
  cognitoDomainPrefix: string;
  callbackUrls: string[];
  logoutUrls: string[];
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly issuerUri: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // Self-signup is intentionally disabled: this sample has no signup feature.
    // Create a demo user manually — see README "Create a demo user".
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // One secret-less app client serves both login paths:
    //  - userPassword: true    -> custom Angular login form (InitiateAuth USER_PASSWORD_AUTH)
    //  - oAuth.flows.authorizationCodeGrant -> Cognito Hosted UI with PKCE
    // generateSecret stays false: a browser SPA cannot keep a client secret secret.
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: false,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: props.callbackUrls,
        logoutUrls: props.logoutUrls,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      preventUserExistenceErrors: true,
    });

    this.userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: { domainPrefix: props.cognitoDomainPrefix },
    });

    this.issuerUri = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
    });
    new cdk.CfnOutput(this, 'IssuerUri', { value: this.issuerUri });
  }
}
