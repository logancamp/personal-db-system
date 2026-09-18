import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof UnauthorizedError) return false;
        return failureCount < 2;
      },
      staleTime: 10_000,
    },
    mutations: {
      retry: false,
    },
  },
});
