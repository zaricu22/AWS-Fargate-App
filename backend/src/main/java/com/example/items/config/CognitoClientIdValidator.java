package com.example.items.config;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * AWS: Cognito access tokens (inside request from Frontend side)
 * carry a `client_id` claim instead of a standard `aud` claim,
 * so Spring's default issuer-uri validation (only checks iss/exp/nbf)
 * never checks that a token was actually issued for Cognito App Client.
 * Referenced by SecurityConfig's JwtDecoder bean.
 */
public class CognitoClientIdValidator implements OAuth2TokenValidator<Jwt> {

    private final String expectedClientId;

    public CognitoClientIdValidator(String expectedClientId) {
        this.expectedClientId = expectedClientId;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String clientId = token.getClaimAsString("client_id");
        if (expectedClientId.equals(clientId)) {
            return OAuth2TokenValidatorResult.success();
        }
        OAuth2Error error = new OAuth2Error(
                "invalid_token",
                "The token was not issued for this app client",
                null);
        return OAuth2TokenValidatorResult.failure(error);
    }
}
