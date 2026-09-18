package dev.camp.MyApp.models;

import dev.camp.MyApp.models.types.Todo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TodoRepository extends JpaRepository<Todo, Long> {
    List<Todo> findAllByUser_UsernameOrderByIdAsc(String username);

    List<Todo> findAllByUser_UsernameOrderBySortOrderAscIdAsc(String username);

    Optional<Todo> findFirstByUser_IdOrderBySortOrderDesc(Long userId);
}