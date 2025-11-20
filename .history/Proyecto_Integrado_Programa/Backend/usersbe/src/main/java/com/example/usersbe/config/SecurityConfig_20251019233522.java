@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
      .cors(Customizer.withDefaults())           // <- habilita CORS en Security
      .csrf(csrf -> csrf.disable())              // <- JWT/stateless: sin CSRF
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        // preflight CORS del navegador
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

        // rutas públicas de auth
        .requestMatchers("/auth/**").permitAll()

        // (opcional) públicas auxiliares si quieres:
        .requestMatchers(HttpMethod.GET, "/users/check-alias/**", "/users/check-email/**").permitAll()
        .requestMatchers("/users/Registrar", "/users/forgot-password", "/users/reset-password").permitAll()

        // admin: ajusta a tu política real
        //.requestMatchers("/users/admin/**").hasRole("ADMINISTRADOR")
        //.requestMatchers(HttpMethod.GET, "/users/listarUsuarios").hasRole("ADMINISTRADOR")

        // resto requiere autenticación
        .anyRequest().authenticated()
      )
      // si usas JWT:
      .oauth2ResourceServer(o -> o.jwt());

    return http.build();
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration c = new CorsConfiguration();
    c.setAllowedOriginPatterns(List.of("http://localhost:4200", "http://127.0.0.1:4200"));
    c.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
    c.setAllowedHeaders(List.of("Authorization","Content-Type","X-Requested-With"));
    c.setExposedHeaders(List.of("Authorization"));
    c.setAllowCredentials(true); // si mandas cookies o necesitas credenciales
    UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
    s.registerCorsConfiguration("/**", c);
    return s;
  }

  @Bean
  public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
}
