import { useEffect, useMemo, useState } from "react"
import { AccessibilityInfo, AppState, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text } from "@/components/typography"
import { colors, radii, shadows, typography } from "@/lib/theme"
import { addIsoCalendarDays, inclusiveTripDayCount, localTodayIso, MAX_TRIP_DAYS } from "@/lib/trip-dates"

type SelectionStage = "start" | "end"

interface DateRangePickerProps {
  visible: boolean
  startDate: string
  endDate: string
  initialSelection?: SelectionStage
  onChange: (startDate: string, endDate: string) => void
  onClose: () => void
}

const weekDays = [
  { short: "S", long: "Sunday" },
  { short: "M", long: "Monday" },
  { short: "T", long: "Tuesday" },
  { short: "W", long: "Wednesday" },
  { short: "T", long: "Thursday" },
  { short: "F", long: "Friday" },
  { short: "S", long: "Saturday" },
]
const monthFormatter = new Intl.DateTimeFormat(undefined, { calendar: "gregory", month: "long", year: "numeric", timeZone: "UTC" })
const accessibilityDateFormatter = new Intl.DateTimeFormat(undefined, {
  calendar: "gregory",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { calendar: "gregory", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function fromIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function firstOfMonth(value?: string) {
  if (value) {
    const date = fromIsoDate(value)
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  }
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
}

function addMonths(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
}

function formatShortDate(value: string) {
  return shortDateFormatter.format(fromIsoDate(value))
}

function buildMonth(date: Date) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: firstWeekday }, () => null)

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${year}-${pad(month + 1)}-${pad(day)}`)
  }

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function DateRangePicker({
  visible,
  startDate,
  endDate,
  initialSelection = "start",
  onChange,
  onClose,
}: DateRangePickerProps) {
  const insets = useSafeAreaInsets()
  const [minimumDate, setMinimumDate] = useState(localTodayIso)
  const minimumMonth = useMemo(() => firstOfMonth(minimumDate), [minimumDate])
  const [draftStart, setDraftStart] = useState(startDate)
  const [draftEnd, setDraftEnd] = useState(endDate)
  const [selectionStage, setSelectionStage] = useState<SelectionStage>(initialSelection)
  const [visibleMonth, setVisibleMonth] = useState(() => firstOfMonth(startDate || endDate || minimumDate))

  useEffect(() => {
    if (!visible) return
    setMinimumDate(localTodayIso())
    const nextStage = initialSelection === "end" && startDate ? "end" : "start"
    const anchor = nextStage === "end" ? endDate || startDate : startDate || endDate
    setDraftStart(startDate)
    setDraftEnd(endDate)
    setSelectionStage(nextStage)
    setVisibleMonth(firstOfMonth(anchor || minimumDate))
  }, [endDate, initialSelection, minimumDate, startDate, visible])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setMinimumDate(localTodayIso())
    })
    return () => subscription.remove()
  }, [])

  const monthCells = useMemo(() => buildMonth(visibleMonth), [visibleMonth])
  const previousDisabled = visibleMonth.getTime() <= minimumMonth.getTime()
  const rangeIsComplete = Boolean(draftStart && draftEnd)
  const tripDayCount = inclusiveTripDayCount(draftStart, draftEnd)
  const maximumEndDate = draftStart ? addIsoCalendarDays(draftStart, MAX_TRIP_DAYS - 1) : ""
  const maximumEndMonth = maximumEndDate ? firstOfMonth(maximumEndDate) : null
  const draftIsValid = (!draftStart && !draftEnd) || (rangeIsComplete && tripDayCount !== null && tripDayCount <= MAX_TRIP_DAYS)
  const nextDisabled = selectionStage === "end" && maximumEndMonth !== null && visibleMonth.getTime() >= maximumEndMonth.getTime()

  function selectDate(date: string) {
    if (date < minimumDate) return

    if (selectionStage === "start" || !draftStart) {
      setDraftStart(date)
      setDraftEnd("")
      setSelectionStage("end")
      return
    }

    if (date < draftStart) return
    setDraftEnd(date)
  }

  function clearDates() {
    setDraftStart("")
    setDraftEnd("")
    setSelectionStage("start")
    setVisibleMonth(minimumMonth)
  }

  function saveDates() {
    if (!draftIsValid) return
    onChange(draftStart, draftEnd)
    onClose()
  }

  function chooseSelectionStage(stage: SelectionStage) {
    const nextStage = stage === "end" && !draftStart ? "start" : stage
    setSelectionStage(nextStage)
    const anchor = nextStage === "start" ? draftStart : draftEnd || draftStart
    if (anchor) setVisibleMonth(firstOfMonth(anchor))
  }

  function changeMonth(amount: number) {
    setVisibleMonth((month) => {
      const nextMonth = addMonths(month, amount)
      requestAnimationFrame(() => AccessibilityInfo.announceForAccessibility(monthFormatter.format(nextMonth)))
      return nextMonth
    })
  }

  const selectionPrompt = selectionStage === "start" ? "Choose your first travel day" : `Now choose your return day — up to ${MAX_TRIP_DAYS} days`

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel="Trip date range picker"
    >
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]} onAccessibilityEscape={onClose}>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.handle} />
              <View style={styles.heroTopline}>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>TRIP DATES</Text>
                  <Text style={styles.title}>When are you going?</Text>
                  <Text accessibilityLiveRegion="polite" style={styles.prompt}>{selectionPrompt}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close date picker without saving"
                  onPress={onClose}
                  hitSlop={4}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={22} color="#F7F3EC" />
                </Pressable>
              </View>

              <View style={styles.rangeSummary} accessibilityLiveRegion="polite">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={draftStart ? `Start date ${formatShortDate(draftStart)}. Change start date.` : "Choose start date"}
                  accessibilityState={{ selected: selectionStage === "start" }}
                  onPress={() => chooseSelectionStage("start")}
                  style={({ pressed }) => [styles.rangeSegment, selectionStage === "start" && styles.rangeSegmentActive, pressed && styles.pressed]}
                >
                  <Text style={styles.rangeLabel}>START</Text>
                  <Text style={[styles.rangeValue, !draftStart && styles.rangePlaceholder]}>{draftStart ? formatShortDate(draftStart) : "Select date"}</Text>
                </Pressable>
                <Ionicons name="arrow-forward" size={16} color={colors.whiteMuted} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={draftEnd ? `End date ${formatShortDate(draftEnd)}. Change end date.` : "Choose end date"}
                  accessibilityState={{ selected: selectionStage === "end" }}
                  onPress={() => chooseSelectionStage("end")}
                  style={({ pressed }) => [styles.rangeSegment, selectionStage === "end" && styles.rangeSegmentActive, pressed && styles.pressed]}
                >
                  <Text style={styles.rangeLabel}>END</Text>
                  <Text style={[styles.rangeValue, !draftEnd && styles.rangePlaceholder]}>{draftEnd ? formatShortDate(draftEnd) : "Select date"}</Text>
                </Pressable>
              </View>
              {tripDayCount !== null ? (
                <Text accessibilityLiveRegion="polite" style={styles.tripLength}>
                  {tripDayCount === 1 ? "1 travel day" : `${tripDayCount} travel days`}
                </Text>
              ) : null}
            </View>

            <View style={styles.calendar}>
              <View style={styles.monthHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  accessibilityState={{ disabled: previousDisabled }}
                  disabled={previousDisabled}
                  onPress={() => changeMonth(-1)}
                  hitSlop={2}
                  style={({ pressed }) => [styles.monthButton, previousDisabled && styles.monthButtonDisabled, pressed && styles.pressed]}
                >
                  <Ionicons name="chevron-back" size={20} color={previousDisabled ? colors.textMuted : colors.text} />
                </Pressable>
                <Text accessibilityLiveRegion="polite" style={styles.monthTitle}>{monthFormatter.format(visibleMonth)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  accessibilityState={{ disabled: nextDisabled }}
                  disabled={nextDisabled}
                  onPress={() => changeMonth(1)}
                  hitSlop={2}
                  style={({ pressed }) => [styles.monthButton, nextDisabled && styles.monthButtonDisabled, pressed && styles.pressed]}
                >
                  <Ionicons name="chevron-forward" size={20} color={nextDisabled ? colors.textMuted : colors.text} />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {weekDays.map((day) => <Text key={day.long} accessibilityLabel={day.long} style={styles.weekDay}>{day.short}</Text>)}
              </View>

              <View style={styles.monthGrid}>
                {monthCells.map((date, index) => {
                  if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />

                  const isPast = date < minimumDate
                  const beforeStart = selectionStage === "end" && Boolean(draftStart) && date < draftStart
                  const afterMaximumEnd = selectionStage === "end" && Boolean(maximumEndDate) && date > maximumEndDate
                  const disabled = isPast || beforeStart || afterMaximumEnd
                  const isStart = date === draftStart
                  const isEnd = date === draftEnd
                  const inRange = Boolean(draftStart && draftEnd && date >= draftStart && date <= draftEnd)
                  const isToday = date === minimumDate
                  const rangeDescription = isStart ? "trip start" : isEnd ? "trip end" : inRange ? "within selected trip" : ""
                  const unavailableDescription = isPast ? "past date, unavailable" : beforeStart ? "before trip start, unavailable" : afterMaximumEnd ? `beyond the ${MAX_TRIP_DAYS}-day trip limit, unavailable` : ""
                  const accessibilityLabel = [accessibilityDateFormatter.format(fromIsoDate(date)), rangeDescription, unavailableDescription].filter(Boolean).join(", ")

                  return (
                    <Pressable
                      key={date}
                      accessibilityRole="button"
                      accessibilityLabel={accessibilityLabel}
                      accessibilityState={{ disabled, selected: isStart || isEnd || inRange }}
                      disabled={disabled}
                      onPress={() => selectDate(date)}
                      hitSlop={{ left: 1, right: 1 }}
                      style={({ pressed }) => [
                        styles.dayCell,
                        inRange && styles.dayCellInRange,
                        isStart && styles.dayCellRangeStart,
                        isEnd && styles.dayCellRangeEnd,
                        pressed && !disabled && styles.dayPressed,
                      ]}
                    >
                      <View style={[styles.dayCircle, isToday && !isStart && !isEnd && styles.todayCircle, (isStart || isEnd) && styles.selectedDayCircle]}>
                        <Text style={[styles.dayText, disabled && styles.dayTextDisabled, (isStart || isEnd) && styles.selectedDayText]}>{Number(date.slice(-2))}</Text>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear selected dates"
              onPress={clearDates}
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
            >
              <Text style={styles.clearText}>Clear dates</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={!draftStart && !draftEnd ? "Close date picker without adding dates" : draftIsValid ? "Save trip dates" : "Choose an end date before saving"}
              accessibilityState={{ disabled: !draftIsValid }}
              disabled={!draftIsValid}
              onPress={saveDates}
              style={({ pressed }) => [styles.saveButton, !draftIsValid && styles.saveButtonDisabled, pressed && styles.saveButtonPressed]}
            >
              <Text style={styles.saveText}>{draftStart && !draftEnd ? "Choose end date" : draftStart ? "Save dates" : "Done"}</Text>
              <Ionicons name="arrow-forward" size={17} color="#F7F3EC" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  sheet: {
    maxHeight: "94%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    ...shadows.floating,
  },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { flexGrow: 0 },
  hero: { backgroundColor: colors.dark, paddingHorizontal: 18, paddingBottom: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 9, marginBottom: 12, backgroundColor: "rgba(255,255,255,0.24)" },
  heroTopline: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroCopy: { flex: 1 },
  eyebrow: { color: "#C8A96E", fontSize: 10, fontWeight: "800", letterSpacing: 1.8 },
  title: { color: "#F7F3EC", fontSize: 25, lineHeight: 30, fontFamily: typography.serif, fontWeight: "700", marginTop: 5 },
  prompt: { color: colors.whiteMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  closeButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  rangeSummary: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 15 },
  rangeSegment: { minHeight: 64, flex: 1, borderRadius: radii.medium, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.055)", paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  rangeSegmentActive: { borderColor: "#C8A96E", backgroundColor: "rgba(200,169,110,0.12)" },
  rangeLabel: { color: "#C8A96E", fontSize: 9, fontWeight: "900", letterSpacing: 1.25 },
  rangeValue: { color: "#F7F3EC", fontSize: 13, fontWeight: "800", marginTop: 5 },
  rangePlaceholder: { color: colors.whiteMuted, fontWeight: "600" },
  tripLength: { color: "#C8A96E", fontSize: 11, fontWeight: "800", letterSpacing: 0.2, marginTop: 10 },
  calendar: { paddingHorizontal: 12, paddingTop: 10 },
  monthHeader: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  monthButtonDisabled: { opacity: 0.38 },
  monthTitle: { color: colors.text, fontSize: 18, fontFamily: typography.serif, fontWeight: "700" },
  weekRow: { flexDirection: "row", marginTop: 3, marginBottom: 2 },
  weekDay: { flex: 1, minHeight: 30, color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textAlign: "center", textAlignVertical: "center" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { flexBasis: "14.285714%", minHeight: 44, alignItems: "center", justifyContent: "center" },
  dayCellInRange: { backgroundColor: colors.primarySoft },
  dayCellRangeStart: { borderTopLeftRadius: 22, borderBottomLeftRadius: 22 },
  dayCellRangeEnd: { borderTopRightRadius: 22, borderBottomRightRadius: 22 },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  todayCircle: { borderWidth: 1, borderColor: colors.primary },
  selectedDayCircle: { backgroundColor: colors.dark },
  dayText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  dayTextDisabled: { color: colors.border },
  selectedDayText: { color: "#F7F3EC" },
  dayPressed: { opacity: 0.62 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 16, paddingTop: 12 },
  clearButton: { minHeight: 50, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  clearText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  saveButton: { minHeight: 50, flex: 1, borderRadius: 999, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.dark },
  saveButtonDisabled: { opacity: 0.42 },
  saveButtonPressed: { opacity: 0.82 },
  saveText: { color: "#F7F3EC", fontSize: 13, fontWeight: "900", letterSpacing: 0.2 },
  pressed: { opacity: 0.72 },
})
