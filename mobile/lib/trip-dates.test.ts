import { describe, expect, it } from "vitest"
import { addIsoCalendarDays, inclusiveTripDayCount, isValidIsoDate, localTodayIso, MAX_TRIP_DAYS, tripLengthLabel } from "./trip-dates"

describe("mobile trip date helpers", () => {
  it("counts same-day trips as one travel day", () => {
    expect(inclusiveTripDayCount("2027-03-15", "2027-03-15")).toBe(1)
    expect(tripLengthLabel("2027-03-15", "2027-03-15")).toBe("1 day")
  })

  it("counts inclusive ranges across months and years", () => {
    expect(inclusiveTripDayCount("2027-03-30", "2027-04-02")).toBe(4)
    expect(inclusiveTripDayCount("2027-12-30", "2028-01-02")).toBe(4)
    expect(tripLengthLabel("2027-12-30", "2028-01-02")).toBe("4 days")
  })

  it("handles leap days without timezone drift", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true)
    expect(inclusiveTripDayCount("2028-02-28", "2028-03-01")).toBe(3)
    expect(addIsoCalendarDays("2028-02-28", 2)).toBe("2028-03-01")
  })

  it("rejects impossible and reversed dates", () => {
    expect(isValidIsoDate("2027-02-29")).toBe(false)
    expect(isValidIsoDate("2027-13-01")).toBe(false)
    expect(inclusiveTripDayCount("2027-04-02", "2027-03-30")).toBeNull()
    expect(tripLengthLabel("2027-04-02", "2027-03-30")).toBe("")
  })

  it("uses the device-local calendar day for the minimum date", () => {
    expect(localTodayIso(new Date(2027, 6, 4, 23, 59))).toBe("2027-07-04")
  })

  it("defines the itinerary-supported maximum range", () => {
    expect(MAX_TRIP_DAYS).toBe(90)
    expect(inclusiveTripDayCount("2027-01-01", addIsoCalendarDays("2027-01-01", MAX_TRIP_DAYS - 1))).toBe(MAX_TRIP_DAYS)
  })
})
