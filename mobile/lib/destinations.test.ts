import { describe, expect, it } from "vitest"
import {
  findDestinationCard,
  getDestinationQueryForLens,
  resolveDestinationCard,
} from "./destinations"

describe("mobile destination discovery", () => {
  it("keeps Lagos as the selected trip destination", () => {
    const destination = resolveDestinationCard("Lagos, Nigeria")

    expect(destination?.name).toBe("Lagos")
    expect(destination?.country).toBe("Nigeria")
    expect(destination?.latitude).toBeCloseTo(6.5244)
  })

  it("creates an explorable destination instead of falling back to Tokyo", () => {
    const destination = resolveDestinationCard("Accra, Ghana")

    expect(destination?.name).toBe("Accra")
    expect(destination?.country).toBe("Ghana")
    expect(destination?.destination).toBe("Accra, Ghana")
    expect(destination?.slug).toBe("custom-accra-ghana")
  })

  it("uses the active lens when the search field is empty", () => {
    const lagos = findDestinationCard("Lagos")

    expect(lagos).not.toBeNull()
    expect(getDestinationQueryForLens(lagos!, "Food + culture")).toContain("food markets")
  })
})
