@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
      .cors(c -> {})                          // CORS dentro de Security
      .csrf(csrf -> csrf.disable())           // JWT: sin CSRF
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .requestMatchers("/auth/**").permitAll()
        // públicas que sí quieres:
        .requestMatchers(HttpMethod.GET, "/users/check-alias/**", "/users/check-email/**").permitAll()
        .requestMatchers("/users/Registrar", "/users/forgot-password", "/users/reset-password").permitAll()
        // si listarUsuarios debe ser SOLO para Admin:
        // .requestMatchers(HttpMethod.GET, "/users/listarUsuarios").hasRole("ADMINISTRADOR")
        .anyRequest().authenticated()
      )
      .oauth2ResourceServer(o -> o.jwt());    // <-- si usas Bearer JWT

    return http.build();
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    var c = new CorsConfiguration();
    c.setAllowedOriginPatterns(List.of("http://localhost:4200","http://127.0.0.1:4200"));
    c.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
    c.setAllowedHeaders(List.of("Authorization","Content-Type","X-Requested-With"));
    c.setExposedHeaders(List.of("Authorization"));
    c.setAllowCredentials(true);
    var s = new UrlBasedCorsConfigurationSource();
    s.registerCorsConfiguration("/**", c);
    return s;
  }

  @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
}
