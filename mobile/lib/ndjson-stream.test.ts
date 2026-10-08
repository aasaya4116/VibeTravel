import { describe, expect, it, vi } from "vitest"
import { consumeNdjson } from "./ndjson-stream"

const encoder = new TextEncoder()

function streamingResponse(chunks: Uint8Array[]) {
  let index = 0
  const cancel = vi.fn().mockResolvedValue(undefined)
  const releaseLock = vi.fn()
  return {
    response: {
      body: {
        getReader: () => ({
          read: vi.fn(async () => index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true }),
          cancel,
          releaseLock,
        }),
      },
      text: vi.fn(async () => ""),
    },
    cancel,
    releaseLock,
  }
}

describe("consumeNdjson", () => {
  it("decodes fragmented UTF-8, data prefixes, CRLF, and a final unterminated line", async () => {
    const bytes = encoder.encode('data: {"name":"Café ☕"}\r\n{"name":"Museum"}\n{"summary":"done"}')
    const coffeeSymbolStart = bytes.findIndex((byte) => byte === 0xe2)
    const { response } = streamingResponse([
      bytes.slice(0, coffeeSymbolStart + 1),
      bytes.slice(coffeeSymbolStart + 1, coffeeSymbolStart + 2),
      bytes.slice(coffeeSymbolStart + 2),
    ])
    const values: Array<Record<string, string>> = []

    const result = await consumeNdjson<Record<string, string>>(response, {
      onValue: (value) => values.push(value),
    })

    expect(values).toEqual([
      { name: "Café ☕" },
      { name: "Museum" },
      { summary: "done" },
    ])
    expect(result).toEqual({ valueCount: 3, malformedLineCount: 0, receivedDone: false })
  })

  it("uses response text when a stream reader is unavailable", async () => {
    const values: Array<Record<string, string>> = []
    const response = {
      body: null,
      text: vi.fn(async () => '{"name":"Park"}\n[DONE]\n'),
    }

    const result = await consumeNdjson<Record<string, string>>(response, {
      onValue: (value) => values.push(value),
    })

    expect(values).toEqual([{ name: "Park" }])
    expect(result.receivedDone).toBe(true)
  })

  it("recovers after malformed lines", async () => {
    const { response } = streamingResponse([
      encoder.encode('{bad json}\n{"name":"Market"}\n'),
    ])
    const values: Array<Record<string, string>> = []

    const result = await consumeNdjson<Record<string, string>>(response, {
      onValue: (value) => values.push(value),
    })

    expect(values).toEqual([{ name: "Market" }])
    expect(result.malformedLineCount).toBe(1)
  })

  it("publishes values before the stream completes", async () => {
    let finishSecondChunk!: () => void
    const secondChunk = new Promise<void>((resolve) => { finishSecondChunk = resolve })
    let reads = 0
    const response = {
      body: {
        getReader: () => ({
          read: async () => {
            reads += 1
            if (reads === 1) return { done: false, value: encoder.encode('{"name":"First"}\n') }
            if (reads === 2) {
              await secondChunk
              return { done: false, value: encoder.encode('{"name":"Second"}\n') }
            }
            return { done: true }
          },
        }),
      },
      text: async () => "",
    }
    const values: string[] = []
    const parsing = consumeNdjson<Record<string, string>>(response, {
      onValue: (value) => values.push(value.name),
    })

    await vi.waitFor(() => expect(values).toEqual(["First"]))
    finishSecondChunk()
    await parsing
    expect(values).toEqual(["First", "Second"])
  })

  it("cancels the reader and rejects with AbortError", async () => {
    const controller = new AbortController()
    let finishRead!: () => void
    const pendingRead = new Promise<void>((resolve) => { finishRead = resolve })
    const cancel = vi.fn(async () => finishRead())
    const releaseLock = vi.fn()
    const response = {
      body: {
        getReader: () => ({
          read: async () => {
            await pendingRead
            return { done: true }
          },
          cancel,
          releaseLock,
        }),
      },
      text: async () => "",
    }
    const parsing = consumeNdjson(response, { onValue: () => undefined, signal: controller.signal })

    controller.abort()

    await expect(parsing).rejects.toMatchObject({ name: "AbortError" })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(releaseLock).toHaveBeenCalledTimes(1)
  })

  it("rejects an unterminated line that exceeds the configured bound", async () => {
    const { response } = streamingResponse([encoder.encode("123456")])

    await expect(consumeNdjson(response, {
      onValue: () => undefined,
      maxLineLength: 5,
      maxBufferLength: 5,
    })).rejects.toThrow(/size limit/i)
  })

  it("bounds the total decoded response even when individual lines are small", async () => {
    const { response } = streamingResponse([
      encoder.encode('{}\n{}\n'),
      encoder.encode('{}\n{}\n'),
    ])

    await expect(consumeNdjson(response, {
      onValue: () => undefined,
      maxLineLength: 4,
      maxBufferLength: 10,
    })).rejects.toThrow(/size limit/i)
  })
})
