import { describe, expect, it } from "vitest"
import { isWithinWeatherForecastWindow } from "./openweather"

describe("OpenWeather forecast window", () => {
  const now = new Date("2026-10-07T15:00:00Z")

  it("accepts a trip that overlaps the five-day provider window", () => {
    expect(
      isWithinWeatherForecastWindow("2026-10-11", "2026-10-14", now)
    ).toBe(true)
  })

  it("skips future trips that the provider cannot forecast yet", () => {
    expect(
      isWithinWeatherForecastWindow("2026-11-01", "2026-11-08", now)
    ).toBe(false)
  })

  it("skips trips that have already ended", () => {
    expect(
      isWithinWeatherForecastWindow("2026-09-01", "2026-09-08", now)
    ).toBe(false)
  })

  it("rejects invalid or reversed date ranges", () => {
    expect(
      isWithinWeatherForecastWindow("not-a-date", "2026-10-08", now)
    ).toBe(false)
    expect(
      isWithinWeatherForecastWindow("2026-10-09", "2026-10-08", now)
    ).toBe(false)
  })
})
