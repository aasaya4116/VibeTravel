import { describe, expect, it } from "vitest"
import { absoluteMediaUrl, apiUrl, destinationPhotoUrl } from "./media"

describe("mobile media URLs", () => {
  it("turns web-relative Google photo proxies into native-loadable URLs", () => {
    expect(absoluteMediaUrl("/api/place-photo?ref=places%2Fabc%2Fphotos%2F123"))
      .toBe(`${apiUrl}/api/place-photo?ref=places%2Fabc%2Fphotos%2F123`)
  })

  it("builds destination-specific photo URLs instead of a generic travel image", () => {
    expect(destinationPhotoUrl("Addis Ababa, Ethiopia"))
      .toBe(`${apiUrl}/api/destination-photo?destination=Addis%20Ababa%2C%20Ethiopia`)
  })
})

