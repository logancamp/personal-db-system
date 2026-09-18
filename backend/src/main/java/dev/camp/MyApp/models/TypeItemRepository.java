package dev.camp.MyApp.models;

import dev.camp.MyApp.models.types.TypeItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TypeItemRepository extends JpaRepository<TypeItem, Long> {
    List<TypeItem> findAllByUser_UsernameAndType_IdOrderByIdAsc(String username, Long typeId);
    List<TypeItem> findAllByType_Id(Long typeId);
    List<TypeItem> findAllByUser_UsernameOrderByIdAsc(String username);
}