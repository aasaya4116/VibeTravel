import { vi } from "vitest"

// Operational telemetry is deliberately inert in unit tests. Route behavior is
// tested independently from Sentry's comparatively heavy runtime bundle.
vi.mock("@/lib/sentry-server", () => ({
  captureUnexpectedApiError: vi.fn(),
  isExpectedRequestInterruption(error: unknown) {
    return error instanceof Error && (
      error.name === "AbortError" || error.name === "TimeoutError"
    )
  },
  isExpectedDataRejection(error: unknown) {
    if (!error || typeof error !== "object") return false
    const code = (error as { code?: unknown }).code
    return typeof code === "string" && (
      code === "PGRST116" ||
      code === "42501" ||
      code.startsWith("22") ||
      code.startsWith("23")
    )
  },
}))
