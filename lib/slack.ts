const SLACK_WEBHOOK_TIMEOUT_MS = 3_000

/** Escape untrusted text before interpolating it into a Slack mrkdwn message. */
export function escapeSlackText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

/**
 * Best-effort Slack delivery. Feedback must never fail because Slack is
 * unavailable, slow, or misconfigured.
 */
export async function sendSlackWebhook(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL?.trim()
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(SLACK_WEBHOOK_TIMEOUT_MS),
    })
  } catch {
    // Slack delivery is optional and must never block feedback submission.
  }
}
