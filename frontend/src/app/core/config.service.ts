import { Injectable } from '@angular/core';

// AWS: fetched at bootstrap rather than baked into environment.ts at build
// time -- CDK doesn't know the Cognito IDs until FargateAuthStack deploys, and
// redeploying infra shouldn't force an `ng build`. See infra/lib/frontend-
// stack.ts, which writes this file's production contents directly from
// CDK-known values (Cognito user pool/client/domain, region, API base URL).
export interface RuntimeConfig {
  cognitoUserPoolId: string;
  cognitoClientId: string;
  cognitoDomain: string;
  region: string;
  apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config?: RuntimeConfig;

  async load(): Promise<void> {
    const response = await fetch('/runtime-config.json');
    if (!response.ok) {
      throw new Error(`Failed to load runtime-config.json: ${response.status}`);
    }
    this.config = (await response.json()) as RuntimeConfig;
  }

  get(): RuntimeConfig {
    if (!this.config) {
      throw new Error('ConfigService.load() must complete before use');
    }
    return this.config;
  }
}
