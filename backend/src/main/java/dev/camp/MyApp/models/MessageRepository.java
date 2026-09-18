package dev.camp.MyApp.models;

import dev.camp.MyApp.models.types.Message;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findAllByToUsernameOrderByIdAsc(String toUsername);

    List<Message> findAllByFrom_UsernameAndTo_UsernameOrFrom_UsernameAndTo_UsernameOrderByIdAsc(
            String fromA, String toA, String fromB, String toB);

    List<Message> findAllByFrom_UsernameAndTo_UsernameAndTargetOrFrom_UsernameAndTo_UsernameAndTargetOrderByIdAsc(
            String fromA, String toB, MessageTarget targetAB,
            String fromB, String toA, MessageTarget targetBA);

    List<Message> findAllByTo_UsernameAndReadAtIsNullOrderByIdAsc(String toUsername);

    List<Message> findAllByTo_UsernameAndFrom_UsernameAndReadAtIsNullOrderByIdAsc(
            String toUsername, String fromUsername);

    List<Message> findAllByTo_UsernameAndFrom_UsernameAndTargetAndReadAtIsNullOrderByIdAsc(
            String toUsername, String fromUsername, MessageTarget target);
}
