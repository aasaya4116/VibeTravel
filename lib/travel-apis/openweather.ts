const API_KEY = process.env.OPENWEATHER_API_KEY
const DAY_MS = 24 * 60 * 60 * 1000
const FORECAST_WINDOW_DAYS = 5
const WEATHER_DEADLINE_MS = 2_500

export function isConfigured() {
  return !!API_KEY
}

export interface DayForecast {
  date: string // YYYY-MM-DD
  tempHigh: number // Fahrenheit
  tempLow: number
  condition: string // "Sunny", "Partly Cloudy", "Rain", etc.
  rainChance: number // 0-100
  icon: string // emoji
}

export interface WeatherForecast {
  destination: string
  days: DayForecast[]
  summary: string // "Days 1-2 sunny, Day 3 expect rain — consider indoor activities"
}

function conditionToIcon(main: string): string {
  const map: Record<string, string> = {
    Clear: "☀️",
    Clouds: "⛅",
    Rain: "🌧️",
    Drizzle: "🌦️",
    Thunderstorm: "⛈️",
    Snow: "❄️",
    Mist: "🌫️",
    Fog: "🌫️",
    Haze: "🌫️",
  }
  return map[main] ?? "🌡️"
}

function kelvinToF(k: number): number {
  return Math.round((k - 273.15) * 9/5 + 32)
}

export function isWithinWeatherForecastWindow(
  startDate: string,
  endDate: string,
  now = new Date()
): boolean {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T23:59:59Z`)
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return false
  }

  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )
  const forecastEnd = today + FORECAST_WINDOW_DAYS * DAY_MS
  return end.getTime() >= today && start.getTime() <= forecastEnd
}

async function geocode(
  destination: string,
  signal: AbortSignal
): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(destination)}&limit=1&appid=${API_KEY}`,
      { signal }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: data[0].lat, lon: data[0].lon }
  } catch {
    return null
  }
}

export async function getWeatherForecast(
  destination: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
  options: { signal?: AbortSignal; now?: Date; timeoutMs?: number } = {}
): Promise<WeatherForecast | null> {
  if (
    !API_KEY ||
    !isWithinWeatherForecastWindow(startDate, endDate, options.now)
  ) {
    return null
  }

  try {
    // Share one small budget across geocoding and forecast retrieval instead
    // of allowing two sequential provider timeouts to delay generation.
    const deadlineSignal = AbortSignal.timeout(
      options.timeoutMs ?? WEATHER_DEADLINE_MS
    )
    const signal = options.signal
      ? AbortSignal.any([options.signal, deadlineSignal])
      : deadlineSignal
    const coords = await geocode(destination, signal)
    if (!coords) return null

    // Use 5-day forecast (free tier) — 3-hour intervals
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}&cnt=40`,
      { signal }
    )
    if (!res.ok) return null

    const data = await res.json()
    const list: {
      dt: number
      main: { temp_max: number; temp_min: number }
      weather: { main: string; description: string }[]
      pop: number
    }[] = data.list ?? []

    // Group by date
    const byDate = new Map<string, typeof list>()
    for (const item of list) {
      const date = new Date(item.dt * 1000).toISOString().split("T")[0]
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date)!.push(item)
    }

    const start = new Date(startDate + "T00:00:00")
    const end = new Date(endDate + "T00:00:00")
    const days: DayForecast[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0]
      const items = byDate.get(dateStr) ?? []
      if (items.length === 0) continue

      const tempHigh = Math.max(...items.map((i) => i.main.temp_max))
      const tempLow = Math.min(...items.map((i) => i.main.temp_min))
      const dominantWeather = items[Math.floor(items.length / 2)].weather[0]
      const rainChance = Math.round(Math.max(...items.map((i) => i.pop)) * 100)

      days.push({
        date: dateStr,
        tempHigh: kelvinToF(tempHigh),
        tempLow: kelvinToF(tempLow),
        condition: dominantWeather.description
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        rainChance,
        icon: conditionToIcon(dominantWeather.main),
      })
    }

    if (days.length === 0) return null

    const rainyDays = days.filter((d) => d.rainChance > 50)
    const summary =
      rainyDays.length === 0
        ? `Clear weather expected across all ${days.length} day(s).`
        : rainyDays.length === days.length
          ? `Rain likely throughout the trip — prioritize indoor activities.`
          : `Rain expected on ${rainyDays.map((d) => d.date).join(", ")} — schedule indoor attractions for those days.`

    return { destination, days, summary }
  } catch {
    return null
  }
}
