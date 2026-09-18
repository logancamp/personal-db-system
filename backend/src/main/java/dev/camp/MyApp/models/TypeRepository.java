package dev.camp.MyApp.models;

import dev.camp.MyApp.models.types.Type;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TypeRepository extends JpaRepository<Type, Long> {
    List<Type> findAllByUser_UsernameOrderByNameAsc(String username);
    Optional<Type> findByUser_UsernameAndNameIgnoreCase(String username, String name);
}
