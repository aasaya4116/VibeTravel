import type { ReactNode, Ref } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { colors, radii, shadows, typography } from "@/lib/theme"

export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  scrollRef,
}: {
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: StyleProp<ViewStyle>
  scrollRef?: Ref<ScrollView>
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.screen, contentStyle]}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(23,21,18,0.14)",
    padding: 18,
    ...shadows.card,
  },
  button: {
    minHeight: 50,
    borderRadius: radii.medium,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.dark },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.danger },
  buttonGhost: { backgroundColor: "transparent", minHeight: 40 },
  buttonText: { color: colors.text, fontSize: 13, fontWeight: "800", letterSpacing: 0.25 },
  buttonTextLight: { color: "#FFFFFF" },
  buttonTextGhost: { color: colors.primary },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  empty: { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 22, fontFamily: typography.serif, fontWeight: "700", textAlign: "center" },
  emptyBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 8 },
  offline: { backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  offlineText: { color: colors.warning, fontSize: 12, fontWeight: "700", textAlign: "center" },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 14 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
})
