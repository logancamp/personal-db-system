package dev.camp.MyApp.services;

import dev.camp.MyApp.controllers.NoteUpdateRequest;
import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.NoteRepository;
import dev.camp.MyApp.models.types.Note;
import dev.camp.MyApp.models.types.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotesService {
    private final NoteRepository noteRepository;
    private final RevisionRecorder revisionRecorder;

    public NotesService(NoteRepository noteRepository, RevisionRecorder revisionRecorder) {
        this.noteRepository = noteRepository;
        this.revisionRecorder = revisionRecorder;
    }

    public Note create(Note note, Long userId) {
        return create(note, userId, CreationSource.WEB, null);
    }

    public Note create(Note note, Long userId, CreationSource source, String createdByPhone) {
        note.id = 0;
        note.user = new User();
        note.user.id = userId;
        note.createdAt = LocalDateTime.now();
        note.createdVia = source;
        note.createdByPhone = createdByPhone;
        Note saved = noteRepository.save(note);
        revisionRecorder.recordAdd(saved);
        return saved;
    }

    public List<Note> findAllForUser(String username) {
        return noteRepository.findAllByUser_UsernameOrderByIdAsc(username);
    }

    public Note update(Long id, NoteUpdateRequest updates, Long userId) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!note.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        if (updates.content() != null) {
            if (updates.content().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content cannot be empty.");
            }
            note.content = updates.content();
        }
        if (updates.section() != null) {
            note.section = updates.section().isBlank() ? null : updates.section();
        }

        Note saved = noteRepository.save(note);
        revisionRecorder.recordUpdate(saved);
        return saved;
    }

    public void delete(Long id, Long userId) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!note.user.id.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        revisionRecorder.recordDelete(note);
        noteRepository.delete(note);
    }
}