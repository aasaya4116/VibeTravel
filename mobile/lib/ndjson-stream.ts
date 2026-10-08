const defaultMaxLineLength = 256 * 1024
const defaultMaxBufferLength = 512 * 1024

type NdjsonReader = {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>
  cancel?: (reason?: unknown) => Promise<unknown>
  releaseLock?: () => void
}

type NdjsonResponse = {
  body?: {
    getReader?: () => NdjsonReader
  } | null
  text: () => Promise<string>
}

export interface ConsumeNdjsonOptions<T> {
  onValue: (value: T) => void
  signal?: AbortSignal
  maxLineLength?: number
  maxBufferLength?: number
}

export interface ConsumeNdjsonResult {
  valueCount: number
  malformedLineCount: number
  receivedDone: boolean
}

function createAbortError() {
  const error = new Error("The operation was aborted")
  error.name = "AbortError"
  return error
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError()
}

export async function consumeNdjson<T>(
  response: NdjsonResponse,
  {
    onValue,
    signal,
    maxLineLength = defaultMaxLineLength,
    maxBufferLength = defaultMaxBufferLength,
  }: ConsumeNdjsonOptions<T>
): Promise<ConsumeNdjsonResult> {
  if (maxLineLength <= 0 || maxBufferLength < maxLineLength) {
    throw new Error("Invalid NDJSON buffer limits")
  }

  throwIfAborted(signal)
  let valueCount = 0
  let malformedLineCount = 0
  let receivedDone = false
  let buffer = ""
  let decodedLength = 0

  const consumeLine = (line: string) => {
    if (line.length > maxLineLength) throw new Error("NDJSON line exceeded the size limit")
    const normalized = line.trim().replace(/^data:\s*/i, "")
    if (!normalized) return true
    if (normalized === "[DONE]") {
      receivedDone = true
      return false
    }

    let value: T
    try {
      value = JSON.parse(normalized) as T
    } catch {
      malformedLineCount += 1
      return true
    }
    onValue(value)
    valueCount += 1
    return true
  }

  const consumeText = (text: string, final = false) => {
    decodedLength += text.length
    if (decodedLength > maxBufferLength) {
      throw new Error("NDJSON stream exceeded the size limit")
    }
    buffer += text
    let newlineIndex = buffer.indexOf("\n")
    while (newlineIndex >= 0 && !receivedDone) {
      const line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      if (!consumeLine(line)) break
      newlineIndex = buffer.indexOf("\n")
    }

    if (receivedDone) {
      buffer = ""
      return
    }
    if (buffer.length > maxLineLength) {
      throw new Error("NDJSON buffer exceeded the size limit")
    }
    if (final && buffer) {
      consumeLine(buffer)
      buffer = ""
    }
  }

  const reader = response.body?.getReader?.()
  if (!reader) {
    const text = await response.text()
    throwIfAborted(signal)
    consumeText(text, true)
    return { valueCount, malformedLineCount, receivedDone }
  }

  const decoder = new TextDecoder("utf-8")
  let cancelRequested = false
  let readerFinished = false
  const cancelReaderSafely = async (reason?: unknown) => {
    try {
      await reader.cancel?.(reason)
    } catch {
      // Cancellation is best-effort; the original abort or parse error wins.
    }
  }
  const cancelReader = () => {
    cancelRequested = true
    void cancelReaderSafely(createAbortError())
  }
  signal?.addEventListener("abort", cancelReader, { once: true })

  try {
    while (!receivedDone) {
      throwIfAborted(signal)
      const { done, value } = await reader.read()
      throwIfAborted(signal)
      if (done) {
        readerFinished = true
        consumeText(decoder.decode(), true)
        break
      }
      if (value) consumeText(decoder.decode(value, { stream: true }))
    }

    if (receivedDone && !cancelRequested) {
      await cancelReaderSafely()
    }
    return { valueCount, malformedLineCount, receivedDone }
  } finally {
    signal?.removeEventListener("abort", cancelReader)
    if (!readerFinished && !receivedDone && !cancelRequested) {
      await cancelReaderSafely()
    }
    try {
      reader.releaseLock?.()
    } catch {
      // Some runtimes release the lock as part of cancellation.
    }
  }
}
