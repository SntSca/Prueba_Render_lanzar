package com.EsiMediaG03.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import jakarta.annotation.PostConstruct;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowedOrigins:}")
    private String allowedOrigins;

    @PostConstruct
    void initCorsDefaults() {
        if (allowedOrigins == null || allowedOrigins.isBlank()) {
            allowedOrigins = "http://localhost:4200,https://front-prueba-rvjq.onrender.com";
        }
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = allowedOrigins.split("\\s*,\\s*");

        registry.addMapping("/**")
            .allowedOrigins(origins)
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);
    }
}
