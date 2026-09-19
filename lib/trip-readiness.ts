import type {
  BookingStatus,
  ItineraryDay,
  ReadinessCategory,
  ReadinessChecklistItem,
  TripBooking,
  TripReadinessState,
} from "@/lib/types"

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const

export const DEFAULT_CHECKLIST: ReadinessChecklistItem[] = [
  {
    id: "ready-accommodation",
    label: "Confirm accommodation",
    category: "accommodation",
    completed: false,
    cost: null,
    confirmation_code: "",
    booking_url: "",
  },
  {
    id: "ready-arrival",
    label: "Arrange arrival transportation",
    category: "transport",
    completed: false,
    cost: null,
    confirmation_code: "",
    booking_url: "",
  },
  {
    id: "ready-local-transport",
    label: "Plan local transportation",
    category: "transport",
    completed: false,
    cost: null,
    confirmation_code: "",
    booking_url: "",
  },
  {
    id: "ready-tickets",
    label: "Download tickets and passes",
    category: "tickets",
    completed: false,
    cost: null,
    confirmation_code: "",
    booking_url: "",
  },
  {
    id: "ready-documents",
    label: "Check travel documents",
    category: "documents",
    completed: false,
    cost: null,
    confirmation_code: "",
    booking_url: "",
  },
  {
    id: "ready-packing",
    label: "Pack family essentials and medicines",
    category: "packing",
    completed: false,
    cost: null,
    confirmation_code: "",
    booking_url: "",
  },
]

const BOOKING_STATUSES = new Set<BookingStatus>([
  "unreviewed",
  "to_book",
  "booked",
  "not_needed",
])

const READINESS_CATEGORIES = new Set<ReadinessCategory>([
  "accommodation",
  "transport",
  "tickets",
  "documents",
  "packing",
  "other",
])

function normalizeCost(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeBooking(value: unknown): TripBooking {
  const booking = value && typeof value === "object" ? (value as Partial<TripBooking>) : {}
  return {
    status: BOOKING_STATUSES.has(booking.status as BookingStatus)
      ? (booking.status as BookingStatus)
      : "unreviewed",
    cost: normalizeCost(booking.cost),
    confirmation_code: typeof booking.confirmation_code === "string" ? booking.confirmation_code : "",
    booking_url: typeof booking.booking_url === "string" ? booking.booking_url : "",
  }
}

function normalizeChecklistItem(value: unknown, index: number): ReadinessChecklistItem | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<ReadinessChecklistItem>
  if (typeof item.label !== "string" || !item.label.trim()) return null

  return {
    id: typeof item.id === "string" && item.id ? item.id : `readiness-item-${index}`,
    label: item.label.trim(),
    category: READINESS_CATEGORIES.has(item.category as ReadinessCategory)
      ? (item.category as ReadinessCategory)
      : "other",
    completed: item.completed === true,
    cost: normalizeCost(item.cost),
    confirmation_code: typeof item.confirmation_code === "string" ? item.confirmation_code : "",
    booking_url: typeof item.booking_url === "string" ? item.booking_url : "",
  }
}

function cloneDefaultChecklist() {
  return DEFAULT_CHECKLIST.map((item) => ({ ...item }))
}

export function createDefaultReadiness(): TripReadinessState {
  return {
    currency: "USD",
    budget_target: null,
    bookings: {},
    checklist: cloneDefaultChecklist(),
  }
}

export function normalizeTripReadiness(value: unknown): TripReadinessState {
  if (!value || typeof value !== "object") return createDefaultReadiness()
  const input = value as Partial<TripReadinessState>
  const bookings: Record<string, TripBooking> = {}

  if (input.bookings && typeof input.bookings === "object" && !Array.isArray(input.bookings)) {
    for (const [itemId, booking] of Object.entries(input.bookings)) {
      if (itemId) bookings[itemId] = normalizeBooking(booking)
    }
  }

  const checklist = Array.isArray(input.checklist)
    ? input.checklist
        .map((item, index) => normalizeChecklistItem(item, index))
        .filter((item): item is ReadinessChecklistItem => item !== null)
    : cloneDefaultChecklist()

  return {
    currency: SUPPORTED_CURRENCIES.includes(input.currency as (typeof SUPPORTED_CURRENCIES)[number])
      ? (input.currency as string)
      : "USD",
    budget_target: normalizeCost(input.budget_target),
    bookings,
    checklist,
  }
}

export function getBooking(bookings: Record<string, TripBooking>, itemId: string): TripBooking {
  return bookings[itemId] ?? {
    status: "unreviewed",
    cost: null,
    confirmation_code: "",
    booking_url: "",
  }
}

export function reconcileBookings(
  itinerary: ItineraryDay[],
  bookings: Record<string, TripBooking>
) {
  const validIds = new Set(itinerary.flatMap((day) => day.items.map((item) => item.id)))
  return Object.fromEntries(Object.entries(bookings).filter(([itemId]) => validIds.has(itemId)))
}

export function getReadinessStats(state: TripReadinessState, itinerary: ItineraryDay[]) {
  const itineraryItems = itinerary.flatMap((day) => day.items)
  const currentBookings = itineraryItems.map((item) => getBooking(state.bookings, item.id))
  const reviewedBookings = currentBookings.filter((booking) => booking.status !== "unreviewed").length
  const booked = currentBookings.filter((booking) => booking.status === "booked").length
  const toBook = currentBookings.filter((booking) => booking.status === "to_book").length
  const resolvedBookings = currentBookings.filter(
    (booking) => booking.status === "booked" || booking.status === "not_needed"
  ).length
  const completedTasks = state.checklist.filter((item) => item.completed).length
  const bookingCosts = currentBookings.reduce((total, booking) => total + (booking.cost ?? 0), 0)
  const checklistCosts = state.checklist.reduce((total, item) => total + (item.cost ?? 0), 0)
  const trackedSpend = bookingCosts + checklistCosts
  const totalSteps = itineraryItems.length + state.checklist.length
  const completedSteps = resolvedBookings + completedTasks

  return {
    itineraryItems: itineraryItems.length,
    reviewedBookings,
    booked,
    toBook,
    completedTasks,
    totalTasks: state.checklist.length,
    trackedSpend,
    remainingBudget:
      state.budget_target === null ? null : Math.max(state.budget_target - trackedSpend, 0),
    overBudget:
      state.budget_target === null ? 0 : Math.max(trackedSpend - state.budget_target, 0),
    progress: totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100),
  }
}

export function formatReadinessCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value)
}
