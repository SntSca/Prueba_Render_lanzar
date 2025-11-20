package com.example.usersbe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
      // CSRF deshabilitado intencionadamente porque usamos JWT y no sesiones basadas en cookies
      http
        .csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth
          .requestMatchers("/auth/**").permitAll() // endpoints públicos
          .anyRequest().authenticated()           // todas las demás rutas requieren JWT
        );
      
      // Configuración adicional JWT (si la tienes)
      // .addFilterBefore(jwtFilter(), UsernamePasswordAuthenticationFilter.class)

      return http.build();
  }


  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }
}
