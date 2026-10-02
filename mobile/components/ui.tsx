import type { ReactNode } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { colors, radii } from "@/lib/theme"

export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: StyleProp<ViewStyle>
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.screen, contentStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

interface ButtonProps extends PressableProps {
  children: ReactNode
  variant?: "primary" | "secondary" | "danger" | "ghost"
  loading?: boolean
}

export function Button({ children, variant = "primary", loading, disabled, style, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        variant === "ghost" && styles.buttonGhost,
        (disabled || loading) && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#FFFFFF" : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "primary" && styles.buttonTextLight,
            variant === "danger" && styles.buttonTextLight,
            variant === "ghost" && styles.buttonTextGhost,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </Card>
  )
}

export function OfflineBanner() {
  return (
    <View style={styles.offline}>
      <Text style={styles.offlineText}>Offline snapshot · reconnect to update this trip</Text>
    </View>
  )
}

export function LoadingScreen({ label = "Loading your travel world…" }: { label?: string }) {
  return (
    <SafeAreaView style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { paddingHorizontal: 18, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.large,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.danger },
  buttonGhost: { backgroundColor: "transparent", minHeight: 40 },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  buttonTextLight: { color: "#FFFFFF" },
  buttonTextGhost: { color: colors.primary },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  empty: { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptyBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 8 },
  offline: { backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  offlineText: { color: colors.warning, fontSize: 12, fontWeight: "700", textAlign: "center" },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
})
