"use client"

import { Palette, Dices, Upload, ExternalLink, Sun, Moon } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
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
import type { ImportedTheme } from "@/types/theme-customizer"
import React from "react"
import "./circular-transition.css"

interface ThemeTabProps {
  selectedTheme: string
  setSelectedTheme: (theme: string) => void
  selectedTweakcnTheme: string
  setSelectedTweakcnTheme: (theme: string) => void
  selectedRadius: string
  setSelectedRadius: (radius: string) => void
  setImportedTheme: (theme: ImportedTheme | null) => void
  onImportClick: () => void
}

export function ThemeTab({
  selectedTheme,
  setSelectedTheme,
  selectedTweakcnTheme,
  setSelectedTweakcnTheme,
  selectedRadius,
  setSelectedRadius,
  setImportedTheme,
  onImportClick,
}: ThemeTabProps) {
  const {
    isDarkMode,
    brandColorsValues,
    setBrandColorsValues,
    applyTheme,
    applyTweakcnTheme,
    applyRadius,
    handleColorChange,
  } = useThemeManager()

  const { toggleTheme } = useCircularTransition()

  const handle随机Shadcn = () => {
    // Apply a random shadcn theme
    const randomTheme =
      colorThemes[Math.floor(Math.random() * colorThemes.length)]
    setSelectedTheme(randomTheme.value)
    setSelectedTweakcnTheme("") // Clear tweakcn selection
    setBrandColorsValues({}) // Clear brand colors state
    setImportedTheme(null) // Clear imported theme
    applyTheme(randomTheme.value, isDarkMode)
  }

  const handle随机Tweakcn = () => {
    // Apply a random tweakcn theme
    const randomTheme =
      tweakcnThemes[Math.floor(Math.random() * tweakcnThemes.length)]
    setSelectedTweakcnTheme(randomTheme.value)
    setSelectedTheme("") // Clear shadcn selection
    setBrandColorsValues({}) // Clear brand colors state
    setImportedTheme(null) // Clear imported theme
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

  return (
    <div className="flex flex-col p-4 gap-6">
      {/* Shadcn 经典配色 */}
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="customizer-shadcn-ui-theme">
            Shadcn 经典配色
          </FieldLabel>
          <Button
            variant="outline"
            size="sm"
            onClick={handle随机Shadcn}
            className="cursor-pointer"
          >
            <Dices data-icon="inline-start" />
            随机
          </Button>
        </div>

        <Select
          items={colorThemeLabels}
          value={selectedTheme || null}
          onValueChange={(value) => {
            if (!value) return
            setSelectedTheme(value)
            setSelectedTweakcnTheme("") // Clear tweakcn selection
            setBrandColorsValues({}) // Clear brand colors state
            setImportedTheme(null) // Clear imported theme
            applyTheme(value, isDarkMode)
          }}
        >
          <SelectTrigger
            id="customizer-shadcn-ui-theme"
            className="w-full cursor-pointer"
          >
            <SelectValue placeholder="选择经典配色" />
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
                          backgroundColor: theme.preset.styles.light.primary,
                        }}
                      />
                      <div
                        className="size-3 rounded-full border border-border/20"
                        style={{
                          backgroundColor: theme.preset.styles.light.secondary,
                        }}
                      />
                      <div
                        className="size-3 rounded-full border border-border/20"
                        style={{
                          backgroundColor: theme.preset.styles.light.accent,
                        }}
                      />
                      <div
                        className="size-3 rounded-full border border-border/20"
                        style={{
                          backgroundColor: theme.preset.styles.light.muted,
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

      {/* Tweakcn 设计主题 */}
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="customizer-tweakcn-theme">
            Tweakcn 设计主题
          </FieldLabel>
          <Button
            variant="outline"
            size="sm"
            onClick={handle随机Tweakcn}
            className="cursor-pointer"
          >
            <Dices data-icon="inline-start" />
            随机
          </Button>
        </div>

        <Select
          items={tweakcnThemeLabels}
          value={selectedTweakcnTheme || null}
          onValueChange={(value) => {
            if (!value) return
            setSelectedTweakcnTheme(value)
            setSelectedTheme("") // Clear shadcn selection
            setBrandColorsValues({}) // Clear brand colors state
            setImportedTheme(null) // Clear imported theme
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
            <SelectValue placeholder="选择设计主题" />
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
                          backgroundColor: theme.preset.styles.light.primary,
                        }}
                      />
                      <div
                        className="size-3 rounded-full border border-border/20"
                        style={{
                          backgroundColor: theme.preset.styles.light.secondary,
                        }}
                      />
                      <div
                        className="size-3 rounded-full border border-border/20"
                        style={{
                          backgroundColor: theme.preset.styles.light.accent,
                        }}
                      />
                      <div
                        className="size-3 rounded-full border border-border/20"
                        style={{
                          backgroundColor: theme.preset.styles.light.muted,
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
        <FieldLegend variant="label">圆角</FieldLegend>
        <ToggleGroup
          variant="outline"
          spacing={2}
          value={[selectedRadius]}
          onValueChange={(value) => value[0] && handleRadiusSelect(value[0])}
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

      {/* Mode Section */}
      <FieldSet>
        <FieldLegend variant="label">明暗模式</FieldLegend>
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
            浅色
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            onClick={handleDarkMode}
            className="cursor-pointer"
          >
            <Moon />
            深色
          </ToggleGroupItem>
        </ToggleGroup>
      </FieldSet>

      <Separator />

      {/* Import Theme Button */}
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={onImportClick}
          className="w-full cursor-pointer"
        >
          <Upload data-icon="inline-start" />
          导入主题 CSS
        </Button>
      </div>

      {/* Brand Colors Section */}
      <Accordion className="w-full border-b rounded-lg">
        <AccordionItem
          value="brand-colors"
          className="border border-border rounded-lg overflow-hidden"
        >
          <AccordionTrigger className="items-center px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors">
            <span className="text-sm font-medium">自定义颜色</span>
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
          <span className="text-sm font-medium">更多主题参考</span>
        </div>
        <p className="text-xs text-muted-foreground">
          For advanced theme customization with real-time preview, visual color
          picker, and hundreds of prebuilt themes, visit{" "}
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
          打开 Tweakcn
        </Button>
      </div>
    </div>
  )
}
