export const colors = {
  background: "#F3EFE7",
  surface: "#FAF8F4",
  surfaceMuted: "#E9E3DA",
  text: "#171512",
  textMuted: "#716960",
  border: "#D6CEC3",
  primary: "#A65636",
  primaryDark: "#6F321F",
  primarySoft: "#EEE0D5",
  success: "#526F61",
  successSoft: "#E3EAE5",
  warning: "#B86608",
  warningSoft: "#FFF2D8",
  danger: "#B83B31",
  dangerSoft: "#FBE7E5",
  dark: "#171512",
  darkSoft: "#26221D",
  whiteMuted: "rgba(255,255,255,0.68)",
} as const

export const radii = {
  small: 4,
  medium: 8,
  large: 12,
} as const

export const typography = {
  serif: "Georgia",
  sans: undefined,
} as const

export const shadows = {
  card: {
    shadowColor: "#2B251F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 7,
  },
} as const
