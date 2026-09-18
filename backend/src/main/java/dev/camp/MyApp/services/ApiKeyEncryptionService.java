package dev.camp.MyApp.services;

import dev.camp.MyApp.security.CryptoUtility;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ApiKeyEncryptionService {
    private final String masterPassword;

    private static final int MIN_PASSWORD_LENGTH = 16;

    public ApiKeyEncryptionService(@Value("${app.key.password}") String masterPassword) {
        if (masterPassword == null || masterPassword.length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalStateException(
                    "KEY_PASSWORD must be set to at least " + MIN_PASSWORD_LENGTH + " characters.");
        }
        this.masterPassword = masterPassword;
    }

    // Stored as base64(salt):base64(iv):base64(ciphertext).
    public String encrypt(String plaintext) {
        if (plaintext == null) return null;
        try {
            byte[] salt = CryptoUtility.generateSalt();
            byte[] iv = CryptoUtility.generateIv();
            byte[] ciphertext = CryptoUtility.encrypt(masterPassword, salt, iv, plaintext);
            return CryptoUtility.toBase64(salt) + ":" + CryptoUtility.toBase64(iv) + ":" + CryptoUtility.toBase64(ciphertext);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt value for storage", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null) return null;
        try {
            String[] parts = stored.split(":", 3);
            if (parts.length != 3) {
                throw new IllegalStateException("Stored value is not in the expected salt:iv:ciphertext format");
            }
            byte[] salt = CryptoUtility.fromBase64(parts[0]);
            byte[] iv = CryptoUtility.fromBase64(parts[1]);
            byte[] ciphertext = CryptoUtility.fromBase64(parts[2]);
            return CryptoUtility.decrypt(masterPassword, salt, iv, ciphertext);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt stored value -- wrong password, or the value predates encryption", e);
        }
    }
}