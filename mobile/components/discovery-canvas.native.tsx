import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import MapView, { Marker } from "react-native-maps"
import { Text } from "@/components/typography"
import type { DestinationCard, DestinationLens } from "@/lib/destinations"
import { remoteImageSource } from "@/lib/media"
import { colors, radii, shadows, typography } from "@/lib/theme"

interface DiscoveryCanvasProps {
  destination: DestinationCard
  lens: DestinationLens
  searching: boolean
  onExplore: () => void
  accessToken?: string | null
}

export default function DiscoveryCanvas({ destination, lens, searching, onExplore, accessToken }: DiscoveryCanvasProps) {
  const hasCoordinates = Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude)
  const region = {
    latitude: destination.latitude ?? 0,
    longitude: destination.longitude ?? 0,
    latitudeDelta: 0.18,
    longitudeDelta: 0.18,
  }

  return (
    <View style={styles.canvas}>
      {hasCoordinates ? (
        <MapView
          key={destination.slug}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          showsCompass={false}
          showsUserLocation={false}
          toolbarEnabled={false}
        >
          <Marker
            coordinate={{ latitude: destination.latitude!, longitude: destination.longitude! }}
            title={destination.name}
            description={destination.headline}
            pinColor={colors.primary}
          />
        </MapView>
      ) : (
        <ImageBackground source={remoteImageSource(destination.imageUrl, accessToken)} style={StyleSheet.absoluteFill}>
          <View style={styles.fallbackShade} />
        </ImageBackground>
      )}

      <View pointerEvents="none" style={styles.mapLabel}>
        <Ionicons name="map-outline" size={13} color={colors.text} />
        <Text style={styles.mapLabelText}>{hasCoordinates ? `${lens.toUpperCase()} MAP` : "DESTINATION PREVIEW"}</Text>
      </View>

      <ImageBackground source={remoteImageSource(destination.imageUrl, accessToken)} style={styles.story} imageStyle={styles.storyImage}>
        <View style={styles.storyShade} />
        <View style={styles.storyCopy}>
          <Text style={styles.country}>{destination.country.toUpperCase()}</Text>
          <Text style={styles.title}>{destination.name}</Text>
          <Text style={styles.headline}>{destination.headline}</Text>
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
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      </ImageBackground>
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: { height: 455, marginHorizontal: 12, borderRadius: radii.medium, overflow: "hidden", backgroundColor: colors.surfaceMuted, ...shadows.floating },
  mapLabel: { position: "absolute", top: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, backgroundColor: "rgba(250,248,244,0.94)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  mapLabelText: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  story: { position: "absolute", left: 12, right: 12, bottom: 12, minHeight: 176, justifyContent: "flex-end", overflow: "hidden", borderRadius: radii.medium },
  storyImage: { borderRadius: radii.medium },
  storyShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(10,9,8,0.48)" },
  storyCopy: { padding: 16 },
  country: { color: "#D99B7B", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: "#FFFFFF", fontSize: 34, lineHeight: 38, fontFamily: typography.serif, fontWeight: "700", marginTop: 2 },
  headline: { color: "rgba(255,255,255,0.76)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  action: { minHeight: 38, marginTop: 13, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.48)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.68 },
  fallbackShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(10,9,8,0.2)" },
})
