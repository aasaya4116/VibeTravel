import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Screen } from "@/components/ui"
import { colors } from "@/lib/theme"

export function LegalDocument({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <Screen contentStyle={styles.page}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.updated}>Last updated {updated}</Text>
      <View style={styles.body}>{children}</View>
    </Screen>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.copy}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { paddingTop: 12 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800" },
  updated: { color: colors.textMuted, fontSize: 12, marginTop: -8 },
  body: { gap: 21, paddingBottom: 24 },
  section: { gap: 7 },
  heading: { color: colors.text, fontSize: 17, fontWeight: "800" },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
})
