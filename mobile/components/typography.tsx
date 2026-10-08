import { forwardRef, type ComponentRef } from "react"
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native"
import { typography } from "@/lib/theme"

type SupportedFontWeight = TextStyle["fontWeight"]

function sansFamilyForWeight(weight: SupportedFontWeight) {
  if (weight === "bold" || weight === "700") return typography.sansBold
  if (weight === "500") return typography.sansMedium
  if (weight === "600") return typography.sansSemiBold
  if (weight === "800") return typography.sansExtraBold
  if (weight === "900") return typography.sansBlack

  if (typeof weight === "number") {
    if (weight >= 900) return typography.sansBlack
    if (weight >= 800) return typography.sansExtraBold
    if (weight >= 700) return typography.sansBold
    if (weight >= 600) return typography.sansSemiBold
    if (weight >= 500) return typography.sansMedium
  }

  return typography.sansRegular
}

function resolvedTypographyStyle(style: TextProps["style"] | TextInputProps["style"]): TextStyle {
  const flattenedStyle = StyleSheet.flatten(style)
  const fontFamily = flattenedStyle?.fontFamily ?? sansFamilyForWeight(flattenedStyle?.fontWeight)

  // Each bundled weight is registered as its own family. Reset fontWeight so
  // React Native does not synthesize or look for a missing face on Android.
  return { fontFamily, fontWeight: "normal" }
}

export type Text = ComponentRef<typeof NativeText>
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function Text(
  { style, ...props },
  ref,
) {
  return <NativeText ref={ref} {...props} style={[style, resolvedTypographyStyle(style)]} />
})

export type TextInput = ComponentRef<typeof NativeTextInput>
export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(function TextInput(
  { style, ...props },
  ref,
) {
  return <NativeTextInput ref={ref} {...props} style={[style, resolvedTypographyStyle(style)]} />
})
