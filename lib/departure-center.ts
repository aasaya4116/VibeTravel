import { getReadinessStats } from "./trip-readiness"
import type { ItineraryDay, Trip, TripReadinessState } from "./types"

export type DeparturePhase =
  | "no_dates"
  | "planning"
  | "booking"
  | "final_checks"
  | "departure_day"
  | "traveling"
  | "past"

export interface DepartureStatus {
  phase: DeparturePhase
  title: string
  description: string
  daysUntil: number | null
  ready: boolean
  unresolvedBookings: number
  incompleteTasks: number
  progress: number
}

function parseTripDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function dayDifference(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000)
}

export function getDepartureStatus(
  trip: Pick<Trip, "start_date" | "end_date" | "status" | "itinerary">,
  readiness: TripReadinessState,
  now = new Date()
): DepartureStatus {
  const stats = getReadinessStats(readiness, trip.itinerary ?? [])
  const currentBookings = (trip.itinerary ?? []).flatMap((day) =>
    day.items.map((item) => readiness.bookings[item.id]?.status ?? "unreviewed")
  )
  const unresolvedBookings = currentBookings.filter(
    (status) => status === "unreviewed" || status === "to_book"
  ).length
  const incompleteTasks = readiness.checklist.filter((item) => !item.completed).length
  const ready =
    (trip.itinerary?.length ?? 0) > 0 && unresolvedBookings === 0 && incompleteTasks === 0
  const startDate = parseTripDate(trip.start_date)
  const endDate = parseTripDate(trip.end_date)

  if (!startDate) {
    return {
      phase: "no_dates",
      title: ready ? "Your plan is ready" : "Add dates to start the countdown",
      description: ready
        ? "Your itinerary and pre-trip checks are complete. Add dates when the trip is confirmed."
        : "Trip dates unlock a departure countdown and time-sensitive reminders.",
      daysUntil: null,
      ready,
      unresolvedBookings,
      incompleteTasks,
      progress: stats.progress,
    }
  }

  const daysUntil = dayDifference(now, startDate)
  const tripEnded = endDate ? dayDifference(endDate, now) > 0 : daysUntil < 0 && trip.status === "completed"

  if (trip.status === "completed" || tripEnded) {
    return {
      phase: "past",
      title: "Trip complete",
      description: "Your offline trip pack remains available to download for your records.",
      daysUntil,
      ready,
      unresolvedBookings,
      incompleteTasks,
      progress: stats.progress,
    }
  }

  if (daysUntil < 0) {
    return {
      phase: "traveling",
      title: "You’re on the trip",
      description: ready
        ? "Everything is checked off. Keep the offline trip pack handy while you explore."
        : "A few planning items remain, but your day-by-day plan is ready when you need it.",
      daysUntil,
      ready,
      unresolvedBookings,
      incompleteTasks,
      progress: stats.progress,
    }
  }

  if (daysUntil === 0) {
    return {
      phase: "departure_day",
      title: ready ? "Ready to leave" : "Departure day",
      description: ready
        ? "Everything is checked off. Have an amazing family trip."
        : "Review the remaining items once more, then keep your offline pack close.",
      daysUntil,
      ready,
      unresolvedBookings,
      incompleteTasks,
      progress: stats.progress,
    }
  }

  if (daysUntil <= 7) {
    return {
      phase: "final_checks",
      title: ready ? `${daysUntil} ${daysUntil === 1 ? "day" : "days"} to go — ready` : "Final checks",
      description: ready
        ? "Bookings and pre-trip tasks are complete. Download the offline pack before you leave."
        : `${daysUntil} ${daysUntil === 1 ? "day" : "days"} to go. Focus on anything still marked for attention.`,
      daysUntil,
      ready,
      unresolvedBookings,
      incompleteTasks,
      progress: stats.progress,
    }
  }

  if (daysUntil <= 30) {
    return {
      phase: "booking",
      title: `${daysUntil} days to go`,
      description: ready
        ? "The plan is ready. Recheck opening hours and download the offline pack closer to departure."
        : "This is the ideal window to finish tickets, reservations, and transportation.",
      daysUntil,
      ready,
      unresolvedBookings,
      incompleteTasks,
      progress: stats.progress,
    }
  }

  return {
    phase: "planning",
    title: `${daysUntil} days to go`,
    description: ready
      ? "You’re ahead of schedule. Your plan is ready whenever departure day arrives."
      : "Plenty of time to finish the itinerary, reservations, and family checklist.",
    daysUntil,
    ready,
    unresolvedBookings,
    incompleteTasks,
    progress: stats.progress,
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatDate(value: string | null) {
  if (!value) return "Dates not set"
  const parsed = parseTripDate(value)
  if (!parsed) return escapeHtml(value)
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function renderOfflineDay(day: ItineraryDay, dayIndex: number, destination: string) {
  const items = day.items
    .map((item) => {
      const location = item.attraction_data?.location
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${item.attraction_name}, ${location || destination}`
      )}`

      return `<li class="stop">
        <div class="time">${escapeHtml(item.start_time || "Flexible")}${
          item.end_time ? `<span>– ${escapeHtml(item.end_time)}</span>` : ""
        }</div>
        <div class="stop-body">
          <h3>${escapeHtml(item.attraction_name)}</h3>
          ${location ? `<p>${escapeHtml(location)}</p>` : ""}
          <a href="${escapeHtml(mapsUrl)}">Open in Maps</a>
        </div>
      </li>`
    })
    .join("")

  return `<section class="day">
    <div class="day-heading">
      <span>Day ${dayIndex + 1}</span>
      <h2>${formatDate(day.date)}</h2>
    </div>
    <ol>${items || '<li class="empty">No stops planned for this day.</li>'}</ol>
  </section>`
}

export function buildOfflineTripHtml(
  trip: Pick<
    Trip,
    "title" | "destination" | "start_date" | "end_date" | "accommodation_area" | "itinerary"
  >,
  readiness: TripReadinessState,
  generatedAt = new Date()
) {
  const status = getDepartureStatus(
    { ...trip, status: "planning" },
    readiness,
    generatedAt
  )
  const days = (trip.itinerary ?? [])
    .map((day, index) => renderOfflineDay(day, index, trip.destination))
    .join("")
  const dateRange = trip.end_date
    ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
    : formatDate(trip.start_date)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(trip.title)} — Offline Trip Pack</title>
  <style>
    :root { color-scheme: light; --ink:#2b2521; --muted:#71645d; --line:#eadfd6; --paper:#fffdf9; --soft:#f7f0ea; --orange:#df6729; --green:#3f9a7b; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--soft); color:var(--ink); font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    main { max-width:760px; margin:0 auto; background:var(--paper); min-height:100vh; }
    header { padding:44px 28px 32px; color:white; background:linear-gradient(135deg,#d6531c,#b83d1f 55%,#296b5c); }
    .eyebrow { margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; opacity:.86; }
    h1 { margin:0; font:42px/1.05 Georgia,serif; }
    .meta { display:flex; flex-wrap:wrap; gap:8px 18px; margin-top:18px; font-size:14px; opacity:.9; }
    .overview { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:18px 28px; border-bottom:1px solid var(--line); }
    .stat { padding:12px; border-radius:12px; background:var(--soft); text-align:center; }
    .stat strong { display:block; font-size:18px; }
    .stat span { color:var(--muted); font-size:11px; }
    .notice { margin:22px 28px 0; padding:13px 15px; border:1px solid #bee0d4; border-radius:12px; background:#f0faf6; color:#286c57; font-size:13px; }
    .actions { display:flex; gap:10px; padding:18px 28px 0; }
    button { border:0; border-radius:10px; background:var(--orange); color:white; padding:10px 16px; font:600 13px system-ui; cursor:pointer; }
    .days { padding:26px 28px 48px; }
    .day { margin-bottom:24px; overflow:hidden; border:1px solid var(--line); border-radius:16px; break-inside:avoid; }
    .day-heading { padding:15px 18px; background:var(--soft); border-bottom:1px solid var(--line); }
    .day-heading span { color:var(--orange); font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    .day-heading h2 { margin:2px 0 0; font:23px/1.2 Georgia,serif; }
    ol { margin:0; padding:0; list-style:none; }
    .stop { display:grid; grid-template-columns:112px 1fr; gap:16px; padding:18px; border-bottom:1px solid var(--line); }
    .stop:last-child { border-bottom:0; }
    .time { font-weight:700; font-size:13px; }
    .time span { display:block; color:var(--muted); font-weight:400; }
    .stop-body h3 { margin:0; font-size:16px; }
    .stop-body p { margin:3px 0; color:var(--muted); font-size:13px; }
    .stop-body a { color:var(--orange); font-size:12px; font-weight:700; }
    .empty { padding:22px; color:var(--muted); text-align:center; }
    footer { padding:24px 28px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; text-align:center; }
    @media (max-width:560px) { h1{font-size:34px}.overview{padding:14px}.days{padding:20px 14px}.notice,.actions{margin-left:14px;margin-right:14px}.actions{padding-left:0}.stop{grid-template-columns:86px 1fr;padding:15px}.meta{display:grid} }
    @media print { body{background:white}.actions{display:none}main{max-width:none}.day{break-inside:avoid} }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">VibeTravel · Offline Trip Pack</p>
      <h1>${escapeHtml(trip.title)}</h1>
      <div class="meta">
        <span>${escapeHtml(trip.destination)}</span>
        <span>${dateRange}</span>
        ${trip.accommodation_area ? `<span>Staying near ${escapeHtml(trip.accommodation_area)}</span>` : ""}
      </div>
    </header>
    <div class="overview">
      <div class="stat"><strong>${status.progress}%</strong><span>ready</span></div>
      <div class="stat"><strong>${status.unresolvedBookings}</strong><span>bookings to review</span></div>
      <div class="stat"><strong>${status.incompleteTasks}</strong><span>tasks remaining</span></div>
    </div>
    <div class="notice">This offline-safe copy excludes costs, confirmation numbers, booking links, and private notes.</div>
    <div class="actions"><button onclick="window.print()">Print or save as PDF</button></div>
    <div class="days">${days || '<p class="empty">No itinerary has been added yet.</p>'}</div>
    <footer>Generated ${escapeHtml(generatedAt.toLocaleString("en-US"))} · Open this file anytime without internet.</footer>
  </main>
</body>
</html>`
}

export function offlineTripFilename(title: string) {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return `${safeTitle || "vibetravel-trip"}-offline.html`
}
