package dev.camp.MyApp.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    @Value("${dev.camp.security.environment:prod}")
    private String env;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity) {
        boolean dev = env.equals("dev");

        httpSecurity
                .cors(Customizer.withDefaults())
                // Stateless Basic auth: credentials arrive on every request and no cookies are
                // used, so there is no session to protect from CSRF.
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests((requests) -> {
                    requests.requestMatchers("/error").permitAll()

                            .requestMatchers(HttpMethod.POST, "/users").permitAll()
                            .requestMatchers(HttpMethod.PATCH, "/users/*").permitAll()
                            .requestMatchers(HttpMethod.GET, "/users").hasAnyAuthority(Roles.ADMIN, Roles.AGENT)

                            .requestMatchers(HttpMethod.GET, "/message").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.GET, "/todo").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.GET, "/note").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.GET, "/typeItems").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.GET, "/types").hasAuthority(Roles.ADMIN)

                            .requestMatchers(HttpMethod.PUT, "/todo/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.PUT, "/note/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.PUT, "/typeItems/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.PUT, "/types/**").hasAuthority(Roles.ADMIN)

                            .requestMatchers(HttpMethod.DELETE, "/todo/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.DELETE, "/note/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.DELETE, "/typeItems/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.DELETE, "/types/**").hasAuthority(Roles.ADMIN)

                            .requestMatchers(HttpMethod.POST, "/message").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers(HttpMethod.POST, "/todo").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers(HttpMethod.POST, "/note").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers(HttpMethod.POST, "/typeItems").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers(HttpMethod.POST, "/types").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers(HttpMethod.GET, "/message/conversation/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.GET, "/message/unread").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.PUT, "/message/conversation/**").hasAuthority(Roles.ADMIN)

                            .requestMatchers(HttpMethod.GET, "/inbox/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.GET, "/history/**").hasAuthority(Roles.ADMIN)
                            .requestMatchers(HttpMethod.DELETE, "/history/**").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)

                            // Unverified accounts carry no authorities, so they are excluded here too.
                            .requestMatchers(HttpMethod.GET, "/users/me").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers(HttpMethod.PUT, "/users/me/**").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers(HttpMethod.DELETE, "/users/me/llm-key").hasAnyAuthority(Roles.AGENT, Roles.ADMIN)
                            .requestMatchers("/tools/**").hasAnyAuthority(Roles.AGENT, Roles.ADMIN);

                    if (dev) {
                        requests.requestMatchers("/h2c/**").permitAll();
                    }
                    requests.anyRequest().denyAll();
                }).httpBasic(Customizer.withDefaults());

        if (dev) {
            // The H2 console renders inside frames.
            httpSecurity.headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()));
        } else {
            httpSecurity
                    .headers((headers) ->
                            headers.contentSecurityPolicy((csp) -> csp
                                    .policyDirectives("script-src 'self'"))
                    );
        }
        return httpSecurity.build();
    }
}
