import { describe, it, expect } from "vitest"
import { getBookingLink } from "./get-booking-link"

const DEST = "Tokyo, Japan"

describe("getBookingLink", () => {
  // --- Experiences → Book on Viator ---

  it("returns Viator link for a theme park", () => {
    const result = getBookingLink(
      { attraction_name: "Tokyo DisneySea", attraction_data: { category: "Theme Park" } },
      DEST
    )
    expect(result?.label).toBe("Book on Viator")
    expect(result?.url).toContain("viator.com")
    expect(result?.url).toContain(encodeURIComponent("Tokyo DisneySea"))
    expect(result?.url).toContain(encodeURIComponent(DEST))
  })

  it("returns Viator link for a museum", () => {
    const result = getBookingLink(
      { attraction_name: "teamLab Borderless", attraction_data: { category: "Museum" } },
      DEST
    )
    expect(result?.label).toBe("Book on Viator")
  })

  it("returns Viator link for a park", () => {
    const result = getBookingLink(
      { attraction_name: "Shinjuku Gyoen National Garden", attraction_data: { category: "Park" } },
      DEST
    )
    expect(result?.label).toBe("Book on Viator")
  })

  it("returns Viator link when attraction_data is undefined", () => {
    const result = getBookingLink({ attraction_name: "Tokyo Tower" }, DEST)
    expect(result?.label).toBe("Book on Viator")
  })

  // --- Restaurants → Find on Yelp (if URL exists) ---

  it("returns Yelp link for a restaurant with yelpUrl", () => {
    const result = getBookingLink(
      {
        attraction_name: "Ichiran Ramen",
        attraction_data: { category: "Restaurant", yelpUrl: "https://yelp.com/ichiran" },
      },
      DEST
    )
    expect(result?.label).toBe("Find on Yelp")
    expect(result?.url).toBe("https://yelp.com/ichiran")
  })

  it("returns null for a restaurant without yelpUrl", () => {
    const result = getBookingLink(
      { attraction_name: "Ichiran Ramen", attraction_data: { category: "Restaurant" } },
      DEST
    )
    expect(result).toBeNull()
  })

  // --- Filtered by name keywords → null ---

  it("returns null for item with 'lunch' in name", () => {
    expect(getBookingLink({ attraction_name: "Lunch at Tsukiji Market" }, DEST)).toBeNull()
  })

  it("returns null for item with 'dinner' in name", () => {
    expect(getBookingLink({ attraction_name: "Dinner in Shinjuku" }, DEST)).toBeNull()
  })

  it("returns null for item with 'breakfast' in name", () => {
    expect(getBookingLink({ attraction_name: "Breakfast at the hotel" }, DEST)).toBeNull()
  })

  it("returns null for 'Coffee Break'", () => {
    expect(getBookingLink({ attraction_name: "Coffee Break" }, DEST)).toBeNull()
  })

  it("returns null for 'Nap time'", () => {
    expect(getBookingLink({ attraction_name: "Nap time" }, DEST)).toBeNull()
  })

  it("returns null for 'Free time at hotel'", () => {
    expect(getBookingLink({ attraction_name: "Free time at hotel" }, DEST)).toBeNull()
  })

  it("returns null for 'Downtime'", () => {
    expect(getBookingLink({ attraction_name: "Downtime" }, DEST)).toBeNull()
  })

  it("is case-insensitive for keywords", () => {
    expect(getBookingLink({ attraction_name: "LUNCH BREAK" }, DEST)).toBeNull()
    expect(getBookingLink({ attraction_name: "Rest At Hotel" }, DEST)).toBeNull()
  })
})
