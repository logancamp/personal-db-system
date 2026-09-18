package dev.camp.MyApp.security;

import java.util.Collection;
import java.util.List;

import dev.camp.MyApp.models.types.User;
import org.jspecify.annotations.NonNull;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class UserPrincipal implements UserDetails {
    private final User user;

    public UserPrincipal(User user) {
        this.user = user;
    }

    public @NonNull Collection<? extends GrantedAuthority> getAuthorities() {
        if (!user.verified) {
            return List.of();
        }
        return List.of(new SimpleGrantedAuthority(user.role));
    }

    public String getPassword() {
        return this.user.password;
    }

    public @NonNull String getUsername() {
        return this.user.username;
    }

    public Long getId() { return this.user.id; }
}
