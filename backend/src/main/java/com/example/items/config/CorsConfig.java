package com.example.items.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * AWS: production serves the API through the same CloudFront distribution
 * as the SPA (see infra/lib/frontend-stack.ts), so it's same-origin and
 * needs no CORS. Local dev runs Angular on :4200 against the backend on
 * :8080, which IS cross-origin, hence this profile-scoped source.
 *
 * Exposed as a CorsConfigurationSource (not a raw CorsFilter) so
 * SecurityConfig's .cors(...) picks it up and applies it inside Spring
 * Security's own filter chain, ahead of the authorization check -- a
 * standalone CorsFilter bean runs too late to unblock the preflight
 * OPTIONS request, which anyRequest().authenticated() would otherwise
 * reject before any CORS headers are added.
 */
@Configuration
@Profile("local")
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:4200"));
        configuration.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
