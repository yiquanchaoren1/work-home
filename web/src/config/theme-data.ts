import { shadcnThemePresets } from "@/utils/shadcn-ui-theme-presets"
import { tweakcnPresets } from "@/utils/tweakcn-theme-presets"
import type { ColorTheme } from "@/types/theme-customizer"

// Tweakcn theme presets for the dropdown - convert from tweakcnPresets
export const tweakcnThemes: ColorTheme[] = Object.entries(tweakcnPresets).map(
  ([key, preset]) => ({
    name: preset.label || key,
    value: key,
    preset: preset,
  })
)

// Shadcn theme presets for the dropdown - convert from shadcnThemePresets
export const colorThemes: ColorTheme[] = Object.entries(shadcnThemePresets).map(
  ([key, preset]) => ({
    name: preset.label || key,
    value: key,
    preset: preset,
  })
)

// Value -> label maps so a Select shows the preset name, not its key
export const tweakcnThemeLabels = Object.fromEntries(
  tweakcnThemes.map((theme) => [theme.value, theme.name])
)
export const colorThemeLabels = Object.fromEntries(
  colorThemes.map((theme) => [theme.value, theme.name])
)
