import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { escapeSlackText, sendSlackWebhook } from "./slack"

describe("Slack webhook helper", () => {
  const originalWebhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL

  beforeEach(() => {
    process.env.SLACK_FEEDBACK_WEBHOOK_URL = "https://hooks.slack.test/services/example"
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    if (originalWebhook === undefined) {
      delete process.env.SLACK_FEEDBACK_WEBHOOK_URL
    } else {
      process.env.SLACK_FEEDBACK_WEBHOOK_URL = originalWebhook
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("escapes characters Slack interprets in dynamic mrkdwn content", () => {
    expect(escapeSlackText('Family & kids <script> > "quoted"')).toBe(
      'Family &amp; kids &lt;script&gt; &gt; "quoted"'
    )
  })

  it("posts JSON with a three-second timeout", async () => {
    const timeoutSignal = new AbortController().signal
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal)
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }))

    await expect(sendSlackWebhook("hello *Slack*")).resolves.toBeUndefined()

    expect(timeoutSpy).toHaveBeenCalledWith(3_000)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.test/services/example",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello *Slack*" }),
        signal: timeoutSignal,
      })
    )
  })

  it("does nothing when the webhook is not configured", async () => {
    delete process.env.SLACK_FEEDBACK_WEBHOOK_URL

    await expect(sendSlackWebhook("hello")).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("absorbs non-success responses", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("no", { status: 500 }))

    await expect(sendSlackWebhook("hello")).resolves.toBeUndefined()
  })

  it("absorbs network and timeout failures", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("webhook failed"))

    await expect(sendSlackWebhook("hello")).resolves.toBeUndefined()
  })
})
