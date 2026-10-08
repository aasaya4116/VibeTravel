import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/typography"
import { RemoteImageBackground } from "@/components/remote-image"
import type { DestinationCard, DestinationLens } from "@/lib/destinations"
import { colors, radii, shadows, typography } from "@/lib/theme"

interface DiscoveryCanvasProps {
  destination: DestinationCard
  lens: DestinationLens
  searching: boolean
  onExplore: () => void
  accessToken?: string | null
}

export default function DiscoveryCanvas({ destination, lens, searching, onExplore, accessToken }: DiscoveryCanvasProps) {
  return (
    <RemoteImageBackground uri={destination.imageUrl} accessToken={accessToken} preset="hero" style={styles.hero} imageStyle={styles.heroImage}>
      <View style={styles.shade} />
      <View style={styles.previewPill}>
        <Ionicons name="location" size={13} color="#FFFFFF" />
        <Text style={styles.previewText}>{lens.toUpperCase()} PREVIEW</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.country}>{destination.country.toUpperCase()}</Text>
        <Text style={styles.title}>{destination.name}</Text>
        <Text style={styles.headline}>{destination.headline}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{destination.energy}</Text>
          <Text style={styles.meta}>Ideal: {destination.idealStay}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Explore ${destination.name}`}
          disabled={searching}
          onPress={onExplore}
          style={({ pressed }) => [styles.action, pressed && styles.pressed, searching && styles.disabled]}
        >
          {searching ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <Text style={styles.actionText}>Explore {destination.name}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </RemoteImageBackground>
  )
}

const styles = StyleSheet.create({
  hero: { height: 430, marginHorizontal: 12, justifyContent: "space-between", overflow: "hidden", borderRadius: radii.medium, ...shadows.floating },
  heroImage: { borderRadius: radii.medium },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12,10,8,0.43)" },
  previewPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, margin: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.24)", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 },
  previewText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  copy: { padding: 19, backgroundColor: "rgba(0,0,0,0.24)" },
  country: { color: "#D48A67", fontSize: 10, fontWeight: "800", letterSpacing: 1.7 },
  title: { color: "#FFFFFF", fontSize: 52, lineHeight: 58, fontFamily: typography.serif, fontWeight: "700", marginTop: 4 },
  headline: { color: "rgba(255,255,255,0.82)", fontSize: 16, fontWeight: "600", marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 17 },
  meta: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 },
  action: { minHeight: 48, marginTop: 18, paddingHorizontal: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.55)", backgroundColor: "transparent", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  actionText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.72 },
})
