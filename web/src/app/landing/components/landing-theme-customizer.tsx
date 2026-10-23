"use client"

import React from "react"
import {
  Palette,
  RotateCcw,
  Settings,
  X,
  Dices,
  Upload,
  ExternalLink,
  Sun,
  Moon,
} from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useThemeManager } from "@/hooks/use-theme-manager"
import { useCircularTransition } from "@/hooks/use-circular-transition"
import {
  colorThemes,
  colorThemeLabels,
  tweakcnThemes,
  tweakcnThemeLabels,
} from "@/config/theme-data"
import { radiusOptions, baseColors } from "@/config/theme-customizer-constants"
import { ColorPicker } from "@/components/color-picker"
import { ImportModal } from "@/components/theme-customizer/import-modal"
import { cn } from "@/lib/utils"
import type { ImportedTheme } from "@/types/theme-customizer"
import "@/components/theme-customizer/circular-transition.css"

interface LandingThemeCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LandingThemeCustomizer({
  open,
  onOpenChange,
}: LandingThemeCustomizerProps) {
  const {
    applyImportedTheme,
    isDarkMode,
    resetTheme,
    applyRadius,
    setBrandColorsValues,
    applyTheme,
    applyTweakcnTheme,
    brandColorsValues,
    handleColorChange,
  } = useThemeManager()

  const { toggleTheme } = useCircularTransition()

  const [selectedTheme, setSelectedTheme] = React.useState("default")
  const [selectedTweakcnTheme, setSelectedTweakcnTheme] = React.useState("")
  const [selectedRadius, setSelectedRadius] = React.useState("0.5rem")
  const [importModalOpen, setImportModalOpen] = React.useState(false)
  const [importedTheme, setImportedTheme] =
    React.useState<ImportedTheme | null>(null)

  const handleReset = () => {
    // Reset all state variables to initial values
    setSelectedTheme("")
    setSelectedTweakcnTheme("")
    setSelectedRadius("0.5rem")
    setImportedTheme(null)
    setBrandColorsValues({})

    // Reset theme and radius to defaults
    resetTheme()
    applyRadius("0.5rem")
  }

  const handleImport = (themeData: ImportedTheme) => {
    setImportedTheme(themeData)
    // Clear other selections to indicate custom import is active
    setSelectedTheme("")
    setSelectedTweakcnTheme("")

    // Apply the imported theme
    applyImportedTheme(themeData, isDarkMode)
  }

  const handleImportClick = () => {
    setImportModalOpen(true)
  }

  const handleRandomShadcn = () => {
    // Apply a random shadcn theme
    const randomTheme =
      colorThemes[Math.floor(Math.random() * colorThemes.length)]
    setSelectedTheme(randomTheme.value)
    setSelectedTweakcnTheme("")
    setBrandColorsValues({})
    setImportedTheme(null)
    applyTheme(randomTheme.value, isDarkMode)
  }

  const handleRandomTweakcn = () => {
    // Apply a random tweakcn theme
    const randomTheme =
      tweakcnThemes[Math.floor(Math.random() * tweakcnThemes.length)]
    setSelectedTweakcnTheme(randomTheme.value)
    setSelectedTheme("")
    setBrandColorsValues({})
    setImportedTheme(null)
    applyTweakcnTheme(randomTheme.preset, isDarkMode)
  }

  const handleRadiusSelect = (radius: string) => {
    setSelectedRadius(radius)
    applyRadius(radius)
  }

  const handleLightMode = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDarkMode === false) return
    toggleTheme(event)
  }

  const handleDarkMode = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDarkMode === true) return
    toggleTheme(event)
  }

  // Re-apply themes when theme mode changes
  React.useEffect(() => {
    if (importedTheme) {
      applyImportedTheme(importedTheme, isDarkMode)
    } else if (selectedTheme) {
      applyTheme(selectedTheme, isDarkMode)
    } else if (selectedTweakcnTheme) {
      const selectedPreset = tweakcnThemes.find(
        (t) => t.value === selectedTweakcnTheme
      )?.preset
      if (selectedPreset) {
        applyTweakcnTheme(selectedPreset, isDarkMode)
      }
    }
  }, [
    isDarkMode,
    importedTheme,
    selectedTheme,
    selectedTweakcnTheme,
    applyImportedTheme,
    applyTheme,
    applyTweakcnTheme,
  ])

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen, details) => {
          // Keep the sheet open while the import dialog is open
          if (
            !nextOpen &&
            importModalOpen &&
            details.reason === "outside-press"
          ) {
            details.cancel()
            return
          }
          onOpenChange(nextOpen)
        }}
        modal={false}
      >
        <SheetContent
          showCloseButton={false}
          side="right"
          className="w-[400px] p-0 gap-0 pointer-events-auto overflow-hidden flex flex-col bg-background"
        >
          <SheetHeader className="gap-0 p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="size-4" />
              </div>
              <SheetTitle className="text-lg font-semibold">
                Theme Customizer
              </SheetTitle>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  className="cursor-pointer size-8"
                >
                  <RotateCcw />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer size-8"
                >
                  <X />
                </Button>
              </div>
            </div>
            <SheetDescription className="text-sm text-muted-foreground">
              Customize the theme and colors of your landing page.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-6">
            {/* Mode Section */}
            <FieldSet>
              <FieldLegend variant="label">Mode</FieldLegend>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={2}
                value={[isDarkMode ? "dark" : "light"]}
                className="grid w-full grid-cols-2"
              >
                <ToggleGroupItem
                  value="light"
                  onClick={handleLightMode}
                  className="cursor-pointer"
                >
                  <Sun />
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dark"
                  onClick={handleDarkMode}
                  className="cursor-pointer"
                >
                  <Moon />
                  Dark
                </ToggleGroupItem>
              </ToggleGroup>
            </FieldSet>

            <Separator />

            {/* Shadcn UI Theme Presets */}
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="customizer-shadcn-ui-theme">
                  Shadcn UI Theme Presets
                </FieldLabel>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRandomShadcn}
                  className="cursor-pointer"
                >
                  <Dices data-icon="inline-start" />
                  Random
                </Button>
              </div>

              <Select
                items={colorThemeLabels}
                value={selectedTheme || null}
                onValueChange={(value) => {
                  if (!value) return
                  setSelectedTheme(value)
                  setSelectedTweakcnTheme("")
                  setBrandColorsValues({})
                  setImportedTheme(null)
                  applyTheme(value, isDarkMode)
                }}
              >
                <SelectTrigger
                  id="customizer-shadcn-ui-theme"
                  className="w-full cursor-pointer"
                >
                  <SelectValue placeholder="Choose Shadcn Theme" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectGroup>
                    {colorThemes.map((theme) => (
                      <SelectItem
                        key={theme.value}
                        value={theme.value}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.primary,
                              }}
                            />
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.secondary,
                              }}
                            />
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.accent,
                              }}
                            />
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.muted,
                              }}
                            />
                          </div>
                          <span>{theme.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Separator />

            {/* Tweakcn Theme Presets */}
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="customizer-tweakcn-theme">
                  Tweakcn Theme Presets
                </FieldLabel>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRandomTweakcn}
                  className="cursor-pointer"
                >
                  <Dices data-icon="inline-start" />
                  Random
                </Button>
              </div>

              <Select
                items={tweakcnThemeLabels}
                value={selectedTweakcnTheme || null}
                onValueChange={(value) => {
                  if (!value) return
                  setSelectedTweakcnTheme(value)
                  setSelectedTheme("")
                  setBrandColorsValues({})
                  setImportedTheme(null)
                  const selectedPreset = tweakcnThemes.find(
                    (t) => t.value === value
                  )?.preset
                  if (selectedPreset) {
                    applyTweakcnTheme(selectedPreset, isDarkMode)
                  }
                }}
              >
                <SelectTrigger
                  id="customizer-tweakcn-theme"
                  className="w-full cursor-pointer"
                >
                  <SelectValue placeholder="Choose Tweakcn Theme" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectGroup>
                    {tweakcnThemes.map((theme) => (
                      <SelectItem
                        key={theme.value}
                        value={theme.value}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.primary,
                              }}
                            />
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.secondary,
                              }}
                            />
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.accent,
                              }}
                            />
                            <div
                              className="size-3 rounded-full border border-border/20"
                              style={{
                                backgroundColor:
                                  theme.preset.styles.light.muted,
                              }}
                            />
                          </div>
                          <span>{theme.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Separator />

            {/* Radius Selection */}
            <FieldSet>
              <FieldLegend variant="label">Radius</FieldLegend>
              <ToggleGroup
                variant="outline"
                spacing={2}
                value={[selectedRadius]}
                onValueChange={(value) =>
                  value[0] && handleRadiusSelect(value[0])
                }
                className="grid w-full grid-cols-5"
              >
                {radiusOptions.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="cursor-pointer text-xs"
                  >
                    {option.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>

            <Separator />

            {/* Import Theme Button */}
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={handleImportClick}
                className="w-full cursor-pointer"
              >
                <Upload data-icon="inline-start" />
                Import Theme
              </Button>
            </div>

            {/* Brand Colors Section */}
            <Accordion className="w-full border-b rounded-lg">
              <AccordionItem
                value="brand-colors"
                className="border border-border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="items-center px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium">Brand Colors</span>
                </AccordionTrigger>
                <AccordionContent className="flex flex-col px-4 pb-4 pt-2 gap-3 border-t border-border bg-muted/20">
                  {baseColors.map((color) => (
                    <div
                      key={color.cssVar}
                      className="flex items-center justify-between"
                    >
                      <ColorPicker
                        label={color.name}
                        cssVar={color.cssVar}
                        value={brandColorsValues[color.cssVar] || ""}
                        onChange={handleColorChange}
                      />
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Tweakcn */}
            <div className="flex flex-col p-4 bg-muted rounded-lg gap-3">
              <div className="flex items-center gap-2">
                <Palette className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  Advanced Customization
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                For advanced theme customization with real-time preview, visual
                color picker, and hundreds of prebuilt themes, visit{" "}
                <a
                  href="https://tweakcn.com/editor/theme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium cursor-pointer"
                >
                  tweakcn.com
                </a>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full cursor-pointer"
                onClick={() =>
                  window.open("https://tweakcn.com/editor/theme", "_blank")
                }
              >
                <ExternalLink data-icon="inline-start" />
                Open Tweakcn
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImport}
      />
    </>
  )
}

// Floating trigger button for landing page
export function LandingThemeCustomizerTrigger({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        "fixed top-1/2 -mt-6 size-12 rounded-full shadow-lg z-50 active:not-aria-[haspopup]:translate-y-0 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer right-4"
      )}
    >
      <Settings className="size-5" />
    </Button>
  )
}
