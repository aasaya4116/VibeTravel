import { describe, expect, it } from "vitest"
import {
  absoluteMediaUrl,
  apiUrl,
  destinationPhotoUrl,
  optimizedMediaUrl,
  remoteImageSource,
} from "./media"

describe("mobile media URLs", () => {
  it("turns web-relative Google photo proxies into native-loadable URLs", () => {
    expect(absoluteMediaUrl("/api/place-photo?ref=places%2Fabc%2Fphotos%2F123"))
      .toBe(`${apiUrl}/api/place-photo?ref=places%2Fabc%2Fphotos%2F123`)
  })

  it("builds destination-specific photo URLs instead of a generic travel image", () => {
    expect(destinationPhotoUrl("Addis Ababa, Ethiopia"))
      .toBe(`${apiUrl}/api/destination-photo?destination=Addis%20Ababa%2C%20Ethiopia`)
  })

  it("requests bounded dimensions and quality from Unsplash", () => {
    const value = optimizedMediaUrl(
      "https://images.unsplash.com/photo-example?ixlib=rb-4.1.0&w=4000",
      "thumbnail"
    )
    const result = new URL(value!)

    expect(result.searchParams.get("ixlib")).toBe("rb-4.1.0")
    expect(result.searchParams.get("w")).toBe("240")
    expect(result.searchParams.get("h")).toBe("240")
    expect(result.searchParams.get("q")).toBe("72")
    expect(result.searchParams.get("fit")).toBe("crop")
    expect(result.searchParams.get("auto")).toBe("format")
  })

  it("adds preset dimensions to VibeTravel photo endpoints", () => {
    const value = optimizedMediaUrl(
      "/api/place-photo?ref=places%2Fabc%2Fphotos%2F123",
      "hero"
    )
    const result = new URL(value!)

    expect(result.origin).toBe(new URL(apiUrl).origin)
    expect(result.searchParams.get("ref")).toBe("places/abc/photos/123")
    expect(result.searchParams.get("width")).toBe("1200")
    expect(result.searchParams.get("height")).toBe("900")
  })

  it("leaves unknown image providers unchanged", () => {
    const value = "https://cdn.example.com/image.jpg?width=4096"
    expect(optimizedMediaUrl(value, "thumbnail")).toBe(value)
  })

  it("only sends authorization to the exact configured API origin", () => {
    const ownSource = remoteImageSource("/api/destination-photo?destination=Tokyo", "secret", "hero")
    const configuredApiUrl = new URL(apiUrl)
    const lookalikeSource = remoteImageSource(
      `${configuredApiUrl.protocol}//${configuredApiUrl.hostname}.attacker.example/photo.jpg`,
      "secret",
      "hero"
    )

    expect(ownSource?.headers).toEqual({ Authorization: "Bearer secret" })
    expect(lookalikeSource?.headers).toBeUndefined()
  })
})

