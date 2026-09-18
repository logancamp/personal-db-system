const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

// Basic auth sends credentials on every request, so refuse plaintext production builds.
if (import.meta.env.PROD && !rawBaseUrl.startsWith("https://")) {
  throw new Error(
    "VITE_API_BASE_URL must be an https:// origin in production builds " +
      "(Basic auth credentials are sent on every request).",
  );
}

export const config = {
  apiBaseUrl: rawBaseUrl.replace(/\/+$/, ""),
} as const;
