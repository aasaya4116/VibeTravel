import { describe, expect, it } from "vitest"
import { getAttractionImage } from "./attraction-images"

describe("curated attraction images", () => {
  it("always requests a high-resolution landscape fallback", () => {
    const image = new URL(getAttractionImage("Museum", "City Museum"))

    expect(image.searchParams.get("w")).toBe("1280")
    expect(image.searchParams.get("h")).toBe("854")
    expect(image.searchParams.get("q")).toBe("85")
    expect(image.searchParams.get("fit")).toBe("crop")
  })
})
