import { describe, expect, it } from "vitest"
import { isCompleteItineraryGeneration, isSavedPlaceDraft, itineraryGenerationOptions } from "./itinerary-generation"

describe("mobile itinerary generation handoff", () => {
  it("uses the full planner for the first itinerary", () => {
    expect(itineraryGenerationOptions(false)).toEqual({})
  })

  it("uses the safe saved-place merge only when an itinerary already exists", () => {
    expect(itineraryGenerationOptions(true)).toMatchObject({
      fastDraft: true,
      instruction: expect.stringContaining("Preserve all existing traveler picks"),
    })
  })

  it("does not present the API fallback draft as a completed itinerary", () => {
    expect(isCompleteItineraryGeneration({
      itinerary: [],
      inclusion: {
        savedCount: 4,
        includedCount: 4,
        missingNames: [],
        requestId: "request-1",
        generationMode: "saved-picks-only",
      },
    })).toBe(false)

    expect(isCompleteItineraryGeneration({
      itinerary: [],
      inclusion: {
        savedCount: 4,
        includedCount: 4,
        missingNames: [],
        requestId: "request-2",
        generationMode: "full",
      },
    })).toBe(true)
  })

  it("recognizes a persisted saved-place-only draft without misclassifying a full plan", () => {
    const savedDraft = [{
      date: "2027-01-10",
      items: [{
        id: "pick-1",
        attraction_name: "National Museum",
        start_time: "09:00",
        end_time: "10:30",
        recommended: false,
      }],
    }]

    expect(isSavedPlaceDraft(savedDraft, [" national   museum "])).toBe(true)
    expect(isSavedPlaceDraft([{...savedDraft[0], items: [
      ...savedDraft[0].items,
      {
        id: "suggestion-1",
        attraction_name: "Family lunch",
        start_time: "12:00",
        end_time: "13:00",
        recommended: true,
      },
    ]}], ["National Museum"])).toBe(false)
  })
})
