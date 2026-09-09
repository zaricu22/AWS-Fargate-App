package com.example.items.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Purpose: Only for Local-Dev Profile - runs Angular on :4200 against the backend on :8080, which IS cross-origin,
 * hence this profile-scoped source, referenced by SecurityConfig's .cors(...) filter chain.
 * AWS: Production-Env - Frontend Bucket and Backend Fargate are placed under
 * the same CloudFront distribution, so it's same-origin and needs no CORS.
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
