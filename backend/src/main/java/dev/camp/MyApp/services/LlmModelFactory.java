package dev.camp.MyApp.services;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Service;

@Service
public class LlmModelFactory {
    // Default when a user has no provider set. Chosen because its default model doesn't reason;
    // reasoning models break Spring AI's tool loop on the follow-up request.
    private static final String DEFAULT_PROVIDER = "CEREBRAS";

    private static final String CEREBRAS_DEFAULT_MODEL = "gemma-4-31b";
    private static final String GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";

    private static final String GROQ_DEFAULT_MODEL = "openai/gpt-oss-20b";

    public String defaultProvider() {
        return DEFAULT_PROVIDER;
    }

    public ChatModel build(String provider, String apiKey, String model) {
        String selected = provider != null ? provider : DEFAULT_PROVIDER;

        if ("ANTHROPIC".equalsIgnoreCase(selected)) {
            AnthropicChatOptions options = AnthropicChatOptions.builder()
                    .apiKey(apiKey)
                    .model(model != null ? model : "claude-sonnet-5")
                    .build();
            return AnthropicChatModel.builder().options(options).build();
        }

        if ("OPENAI".equalsIgnoreCase(selected)) {
            OpenAiChatOptions options = OpenAiChatOptions.builder()
                    .apiKey(apiKey)
                    .model(model != null ? model : "gpt-4o-mini")
                    .build();
            return OpenAiChatModel.builder().options(options).build();
        }

        if ("GEMINI".equalsIgnoreCase(selected)) {
            OpenAiChatOptions options = OpenAiChatOptions.builder()
                    .baseUrl("https://generativelanguage.googleapis.com/v1beta/openai/")
                    .apiKey(apiKey)
                    .model(model != null ? model : GEMINI_DEFAULT_MODEL)
                    .temperature(0.0)
                    .build();
            return OpenAiChatModel.builder().options(options).build();
        }

        if ("GROQ".equalsIgnoreCase(selected)) {
            OpenAiChatOptions options = OpenAiChatOptions.builder()
                    .baseUrl("https://api.groq.com/openai/v1")
                    .apiKey(apiKey)
                    .model(model != null ? model : GROQ_DEFAULT_MODEL)
                    .temperature(0.0)
                    .build();
            return OpenAiChatModel.builder().options(options).build();
        }

        OpenAiChatOptions cerebrasOptions = OpenAiChatOptions.builder()
                .baseUrl("https://api.cerebras.ai/v1")
                .apiKey(apiKey)
                .model(model != null ? model : CEREBRAS_DEFAULT_MODEL)
                .temperature(0.0)
                .build();
        return OpenAiChatModel.builder().options(cerebrasOptions).build();
    }
}