# CLAUDE.md

Guidance for Claude Code when working in this repo. See `README.md` for the full setup/deploy walkthrough — this file covers conventions and machine-specific gotchas discovered while building it.

## What this is

Angular + Spring Boot + AWS CDK reference app with exactly two features: login and a read-only items list. See `README.md`'s Architecture section and `infra/`, `backend/`, `frontend/`, `e2e/` for the four pieces.

## Local dev loop

```bash
docker-compose up -d                                   # Postgres on :5432
cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local   # needs COGNITO_ISSUER_URI / COGNITO_APP_CLIENT_ID env vars
cd frontend && npm start                                # :4200
cd e2e && npm test                                      # needs e2e/.env (see e2e/.env.example)
```

FargateAuthStack is already deployed (real Cognito, no local emulator) — Cognito IDs live in `frontend/public/runtime-config.json`.

## Machine-specific gotcha: Avast TLS interception

This machine's Avast installs its own root CA for HTTPS inspection. It breaks HTTPS from tools whose trust store doesn't include it, and the fix differs per tool:

- **JVM (Maven/Spring Boot)**: the JDK's own `cacerts` fails PKIX validation against Cognito's issuer endpoint. Don't edit the real `cacerts` under `C:\Program Files\Java\jdk-17\lib\security\cacerts` — that needs admin rights. Instead copy it to a user-writable path and import Avast's root cert into the copy, then point the app at it:
  ```powershell
  Copy-Item "C:\Program Files\Java\jdk-17\lib\security\cacerts" "$env:TEMP\claude-cacerts" -Force
  $cert = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*Avast*" }
  Export-Certificate -Cert $cert -FilePath "$env:TEMP\avast-root.cer" -Type CERT
  & "C:\Program Files\Java\jdk-17\bin\keytool.exe" -importcert -noprompt -trustcacerts -alias avast-root -keystore "$env:TEMP\claude-cacerts" -storepass changeit -file "$env:TEMP\avast-root.cer"
  ```
  Then run the backend with that truststore passed to the *forked* app JVM specifically (`MAVEN_OPTS` only affects Maven's own JVM, not the app it forks):
  ```bash
  mvn spring-boot:run -Dspring-boot.run.profiles=local "-Dspring-boot.run.jvmArguments=-Djavax.net.ssl.trustStore=$TEMP/claude-cacerts -Djavax.net.ssl.trustStorePassword=changeit"
  ```
- **Playwright/Chromium**: a *different* failure — not a cert-trust error but `net::ERR_NETWORK_ACCESS_DENIED`, because Avast (or Windows Firewall) blocks network access for the freshly-downloaded, not-yet-approved Chromium binary outright. `ignoreHTTPSErrors` in `playwright.config.ts` does **not** fix this (tried it — it's not a TLS problem). Needs either an Avast allow/approve action or an elevated firewall rule for `chrome.exe` under `%LOCALAPPDATA%\ms-playwright\...` — both require user/admin interaction, not something to script around silently.
- **`curl.exe`** (Git Bash's bundled curl) hits the same kind of block independently of the above. `node -e "require('https').get(...)"` is a reliable way to test real connectivity from this shell when `curl` itself is misleading.

## AWS credentials

The `default` AWS CLI profile's session token expires and isn't refreshed automatically. Use `aws-app-sample` (`--profile aws-app-sample` or `$env:AWS_PROFILE`/`export AWS_PROFILE`) for anything needing live AWS calls (e.g. `admin-set-user-password` on the demo Cognito user) — check both before assuming AWS creds are dead.

## e2e test notes

- `e2e/.env` is loaded via Node's native `--env-file=.env` (see `e2e/package.json` scripts) — there's no `dotenv` dependency, so don't assume `.env` is picked up automatically by other invocations (e.g. running `npx playwright test` directly skips it).
- Don't clear `sessionStorage` in a Playwright `beforeEach` via `page.addInitScript` — it reruns on *every* navigation within a test, which breaks anything that stores state before a full-page redirect and reads it after (e.g. this app's PKCE verifier for the Hosted UI flow). Each Playwright test already gets a fresh, storage-isolated browser context, so it's unnecessary anyway.
- Cognito's Hosted UI renders duplicate desktop/mobile form elements with the same `id`s (one hidden via CSS) — scope locators with `:visible` rather than assuming a single match.

## Project naming

Project name is `aws-fargate-app` — `infra/`, `frontend/`, `e2e` package.json `name`, the backend Maven `artifactId`/`name`, and the docker-compose project name (top-level `name:` in `docker-compose.yml`) are all set to this.

CDK stack ids are prefixed `Fargate` (`FargateAuthStack`, `FargateDataStack`, `FargateBackendStack`, `FargateFrontendStack`) to match the sibling `AWS-Lambda-App` project's `Lambda*` convention and avoid CloudFormation stack-name collisions if both apps are ever deployed into the same account/region. The TypeScript class names inside `infra/lib/*.ts` (`AuthStack`, `DataStack`, etc.) were deliberately left unchanged — only the CDK construct id (the string passed as the 2nd constructor argument) carries the prefix, matching the Lambda sibling's own convention.

Renaming the stack ids from plain `AuthStack` etc. to `FargateAuthStack` etc. was **not** a simple rename in AWS terms: CloudFormation identifies stacks by name, so this created a brand-new `FargateAuthStack` (new Cognito User Pool, new demo user needed) while the original `AuthStack` became orphaned and was explicitly deleted (`aws cloudformation delete-stack`) after the new stack was verified. If this project's Cognito setup ever seems to have "reset" unexpectedly, check `git log`/session history for a stack-id rename like this rather than assuming something broke.

The Cognito Hosted UI domain is `items-fargate-app` (`infra/bin/infra.ts`'s `cognitoDomainPrefix`) — this one doesn't hit the earlier `items-sample-app` naming issue (Cognito domain prefixes cannot contain the reserved word `aws`; `items-fargate-app` doesn't, so no workaround was needed here).

The repo folder on disk is expected to become `AWS-Fargate-App` (renamed from `AWS-Sample-App`). Renaming a folder a running Claude Code session has open as its CWD is a known Windows-level lock issue in this environment (it blocked, then later succeeded, during the earlier `AWS-Claude-Setup` → `AWS-Sample-App` rename) — verify the actual folder name on disk before trusting this note if it's been a while.

## Backend CORS

CORS for local dev (`CorsConfig`, `@Profile("local")`) must be exposed as a `CorsConfigurationSource` bean and wired into `SecurityConfig` via `.cors(Customizer.withDefaults())` — a standalone `CorsFilter` bean runs *after* Spring Security's filter chain, so `anyRequest().authenticated()` rejects the browser's CORS preflight (`OPTIONS`) before the filter ever adds CORS headers. If CORS regresses, check that wiring first, not just the allowed-origins list.
