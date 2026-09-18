package dev.camp.MyApp.models;

import dev.camp.MyApp.models.types.Note;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findAllByUser_UsernameOrderByIdAsc(String username);
}