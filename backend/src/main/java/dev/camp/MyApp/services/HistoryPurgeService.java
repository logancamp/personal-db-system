package dev.camp.MyApp.services;

import dev.camp.MyApp.models.ItemRevisionRepository;
import dev.camp.MyApp.models.UserRepository;
import dev.camp.MyApp.models.types.User;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class HistoryPurgeService {
    private final ItemRevisionRepository revisionRepository;
    private final UserRepository userRepository;

    public HistoryPurgeService(ItemRevisionRepository revisionRepository, UserRepository userRepository) {
        this.revisionRepository = revisionRepository;
        this.userRepository = userRepository;
    }

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void purgeExpiredHistory() {
        for (User user : userRepository.findAll()) {
            if (!user.historyEnabled) {
                purgeAllForUser(user.id);
            } else if (user.historyRetentionDays != null && user.historyRetentionDays > 0) {
                purgeOlderThan(user.id, user.historyRetentionDays);
            }
        }
    }

    @Transactional
    public int purgeAllForUser(Long userId) {
        return (int) revisionRepository.deleteByOwnerUserId(userId);
    }

    @Transactional
    public int purgeOlderThan(Long userId, int days) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        return (int) revisionRepository.deleteByOwnerUserIdAndChangedAtBefore(userId, cutoff);
    }
}