import { Image } from "expo-image"

const openPassageMark = require("../assets/brand-mark.png")

export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <Image
      source={openPassageMark}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
      accessibilityIgnoresInvertColors
    />
  )
}
