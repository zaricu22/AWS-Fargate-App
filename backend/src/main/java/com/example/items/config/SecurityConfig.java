package com.example.items.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // issuerUri ← app.cognito.issuer-uri ← ${COGNITO_ISSUER_URI} (application.yml)
    //  ← COGNITO_ISSUER_URI env-var on ECS task (backend-stack) ← props.issuerUri ← AuthStack.issuerUri
    private final String issuerUri;
    // appClientId ← app.cognito.app-client-id ← ${COGNITO_APP_CLIENT_ID} (application.yml)
    //  ← COGNITO_APP_CLIENT_ID env-var on ECS task (backend-stack) ← props.userPoolClient.userPoolClientId ← AuthStack.appClientId
    private final String appClientId;

    public SecurityConfig(
            @Value("${app.cognito.issuer-uri}") String issuerUri,
            @Value("${app.cognito.app-client-id}") String appClientId) {
        this.issuerUri = issuerUri;
        this.appClientId = appClientId;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .anyRequest().authenticated())
                // Wire custom Jwt decoder for Cognito JWT token validation
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(jwtDecoder)));

        return http.build();
    }

    // Define custom JWT decoder for Cognito JWT token validation
    @Bean
    public JwtDecoder jwtDecoder() {
        // AWS: withIssuerLocation fetches Cognito's public signing keys (JWKS)
        // over HTTPS from <issuerUri>/.well-known/openid-configuration at
        // startup, then verifies each incoming token's signature against them.
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(issuerUri).build();

        // Define custom validators for issuerUri
        OAuth2TokenValidator<Jwt> withIssuer = JwtValidators.createDefaultWithIssuer(issuerUri);
        // Use custom defined CognitoClientIdValidator
        OAuth2TokenValidator<Jwt> withClientId = new CognitoClientIdValidator(appClientId);
        // Wire two custom validators to the decoder
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(withIssuer, withClientId));

        return decoder;
    }
}
