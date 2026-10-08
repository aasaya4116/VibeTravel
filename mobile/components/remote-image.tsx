import { useEffect, useRef, type PropsWithChildren } from "react"
import { Image, type ImageProps } from "expo-image"
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native"
import { remoteImageSource, type ImageSizePreset } from "@/lib/media"
import { startOperationTiming, type OperationTiming } from "@/lib/observability"

type SharedRemoteImageProps = {
  uri: string | null | undefined
  accessToken?: string | null
  preset?: ImageSizePreset
}

export type RemoteImageProps = SharedRemoteImageProps & Omit<ImageProps, "source">

export function RemoteImage({
  uri,
  accessToken,
  preset = "landscape",
  contentFit = "cover",
  cachePolicy = "memory-disk",
  enforceEarlyResizing = true,
  recyclingKey,
  onLoadStart,
  onLoad,
  onError,
  onLoadEnd,
  ...props
}: RemoteImageProps) {
  const source = remoteImageSource(uri, accessToken, preset)
  const timingRef = useRef<OperationTiming | null>(null)

  useEffect(() => () => {
    timingRef.current?.finish({ aborted: true })
    timingRef.current = null
  }, [])

  return (
    <Image
      {...props}
      source={source}
      contentFit={contentFit}
      cachePolicy={cachePolicy}
      enforceEarlyResizing={enforceEarlyResizing}
      recyclingKey={recyclingKey ?? source?.uri ?? null}
      onLoadStart={() => {
        timingRef.current?.finish({ aborted: true })
        timingRef.current = startOperationTiming(`image.load.${preset}`)
        onLoadStart?.()
      }}
      onLoad={(event) => {
        timingRef.current?.finish({ cache_hit: event.cacheType !== "none" })
        timingRef.current = null
        onLoad?.(event)
      }}
      onError={(event) => {
        // Broken image URLs are handled by each card's visual fallback. Record
        // their duration without producing a noisy error event per image.
        timingRef.current?.finish({ cache_hit: false })
        timingRef.current = null
        onError?.(event)
      }}
      onLoadEnd={() => {
        timingRef.current?.finish()
        timingRef.current = null
        onLoadEnd?.()
      }}
    />
  )
}

export type RemoteImageBackgroundProps = PropsWithChildren<
  SharedRemoteImageProps & Omit<ViewProps, "children"> & {
    imageStyle?: ImageProps["style"]
    imageProps?: Omit<ImageProps, "source" | "style">
    style?: StyleProp<ViewStyle>
  }
>

export function RemoteImageBackground({
  uri,
  accessToken,
  preset = "hero",
  imageStyle,
  imageProps,
  children,
  ...viewProps
}: RemoteImageBackgroundProps) {
  return (
    <View {...viewProps}>
      <RemoteImage
        {...imageProps}
        uri={uri}
        accessToken={accessToken}
        preset={preset}
        style={[StyleSheet.absoluteFill, imageStyle]}
      />
      {children}
    </View>
  )
}
