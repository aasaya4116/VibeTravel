export const colors = {
  background: "#F4F1EB",
  surface: "#FFFFFF",
  surfaceMuted: "#ECE7DF",
  text: "#201D19",
  textMuted: "#6E675F",
  border: "#DDD5CB",
  primary: "#EF5A27",
  primaryDark: "#B43F18",
  primarySoft: "#FCE7DC",
  success: "#4F8A73",
  successSoft: "#E6F0EB",
  warning: "#B86608",
  warningSoft: "#FFF2D8",
  danger: "#B83B31",
  dangerSoft: "#FBE7E5",
  dark: "#171512",
  darkSoft: "#25211D",
  whiteMuted: "rgba(255,255,255,0.68)",
} as const

export const radii = {
  small: 10,
  medium: 16,
  large: 28,
} as const

export const typography = {
  serif: "Georgia",
  sans: undefined,
} as const

export const shadows = {
  card: {
    shadowColor: "#2B251F",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 10,
  },
} as const
