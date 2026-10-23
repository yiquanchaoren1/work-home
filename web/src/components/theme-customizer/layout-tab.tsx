"use client"

import {
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"
import { useSidebar } from "@/components/ui/sidebar"
import {
  sidebarVariants,
  sidebarCollapsibleOptions,
  sidebarSideOptions,
} from "@/config/theme-customizer-constants"
import { cn } from "@/lib/utils"

export function LayoutTab() {
  const { config: sidebarConfig, updateConfig: updateSidebarConfig } =
    useSidebarConfig()
  const { toggleSidebar, state: sidebarState } = useSidebar()

  // Sidebar handler functions
  const handleSidebarVariantSelect = (
    variant: "sidebar" | "floating" | "inset"
  ) => {
    updateSidebarConfig({ variant })
  }

  const handleSidebarCollapsibleSelect = (
    collapsible: "offcanvas" | "icon" | "none"
  ) => {
    updateSidebarConfig({ collapsible })

    // If switching to icon mode and sidebar is currently expanded, auto-collapse it
    if (collapsible === "icon" && sidebarState === "expanded") {
      toggleSidebar()
    }
  }

  const handleSidebarSideSelect = (side: "left" | "right") => {
    updateSidebarConfig({ side })
  }

  return (
    <div className="flex flex-col p-4 gap-6">
      {/* Sidebar Configuration */}
      <FieldSet>
        <FieldLegend variant="label">Sidebar Variant</FieldLegend>
        {sidebarConfig.variant && (
          <FieldDescription>
            {sidebarConfig.variant === "sidebar" &&
              "Default: Standard sidebar layout"}
            {sidebarConfig.variant === "floating" &&
              "Floating: Floating sidebar with border"}
            {sidebarConfig.variant === "inset" &&
              "Inset: Inset sidebar with rounded corners"}
          </FieldDescription>
        )}
        <RadioGroup
          value={sidebarConfig.variant}
          onValueChange={(value) =>
            handleSidebarVariantSelect(
              value as "sidebar" | "floating" | "inset"
            )
          }
          className="grid grid-cols-3 gap-3"
        >
          {sidebarVariants.map((variant) => (
            <FieldLabel
              key={variant.value}
              htmlFor={`sidebar-variant-${variant.value}`}
              className="relative w-full cursor-pointer flex-col items-stretch gap-0 rounded-md border border-border p-4 transition-colors hover:border-border/60 has-data-checked:border-primary has-data-checked:bg-primary/10 dark:has-data-checked:border-primary dark:has-data-checked:bg-primary/10"
            >
              <RadioGroupItem
                id={`sidebar-variant-${variant.value}`}
                value={variant.value}
                className="sr-only absolute"
              />
              {/* Visual representation of sidebar variant */}
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-center">
                  {variant.name}
                </div>
                <div
                  className={cn(
                    "flex h-12 rounded border",
                    variant.value === "inset" ? "bg-muted" : "bg-background"
                  )}
                >
                  {/* Sidebar representation - smaller and more proportional */}
                  <div
                    className={cn(
                      "w-3 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1",
                      variant.value === "floating"
                        ? "border-r m-1 rounded"
                        : variant.value === "inset"
                          ? "m-1 ms-0 rounded bg-muted/80"
                          : "border-r"
                    )}
                  >
                    {/* Menu icon representations - clearer and more visible */}
                    <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                    <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                    <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                    <div className="h-0.5 w-3/4 bg-foreground/30 rounded"></div>
                  </div>
                  {/* Main content area - larger and more prominent */}
                  <div
                    className={cn(
                      "flex-1",
                      variant.value === "inset"
                        ? "bg-background ms-0"
                        : "bg-background/50",
                      "m-1 rounded-sm border-dashed border border-muted-foreground/20"
                    )}
                  ></div>
                </div>
              </div>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>

      <Separator />

      {/* Sidebar Collapsible Mode */}
      <FieldSet>
        <FieldLegend variant="label">Sidebar Collapsible Mode</FieldLegend>
        {sidebarConfig.collapsible && (
          <FieldDescription>
            {sidebarConfig.collapsible === "offcanvas" &&
              "Off Canvas: Slides out of view"}
            {sidebarConfig.collapsible === "icon" &&
              "Icon: Collapses to icon only"}
            {sidebarConfig.collapsible === "none" && "None: Always visible"}
          </FieldDescription>
        )}
        <RadioGroup
          value={sidebarConfig.collapsible}
          onValueChange={(value) =>
            handleSidebarCollapsibleSelect(
              value as "offcanvas" | "icon" | "none"
            )
          }
          className="grid grid-cols-3 gap-3"
        >
          {sidebarCollapsibleOptions.map((option) => (
            <FieldLabel
              key={option.value}
              htmlFor={`sidebar-collapsible-${option.value}`}
              className="relative w-full cursor-pointer flex-col items-stretch gap-0 rounded-md border border-border p-4 transition-colors hover:border-border/60 has-data-checked:border-primary has-data-checked:bg-primary/10 dark:has-data-checked:border-primary dark:has-data-checked:bg-primary/10"
            >
              <RadioGroupItem
                id={`sidebar-collapsible-${option.value}`}
                value={option.value}
                className="sr-only absolute"
              />
              {/* Visual representation of collapsible mode */}
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-center">
                  {option.name}
                </div>
                <div className="flex h-12 rounded border bg-background">
                  {/* Sidebar representation based on collapsible mode */}
                  {option.value === "offcanvas" ? (
                    // Off-canvas: Show collapsed state with hamburger menu
                    <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20 flex items-center justify-start pl-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="w-3 h-0.5 bg-foreground/60 rounded"></div>
                        <div className="w-3 h-0.5 bg-foreground/60 rounded"></div>
                        <div className="w-3 h-0.5 bg-foreground/60 rounded"></div>
                      </div>
                    </div>
                  ) : option.value === "icon" ? (
                    // Icon mode: Show thin icon sidebar with clear icons
                    <>
                      <div className="w-4 flex-shrink-0 bg-muted flex flex-col gap-1 p-1 border-r items-center">
                        <div className="size-2 bg-foreground/60 rounded-sm"></div>
                        <div className="size-2 bg-foreground/40 rounded-sm"></div>
                        <div className="size-2 bg-foreground/30 rounded-sm"></div>
                      </div>
                      <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20"></div>
                    </>
                  ) : (
                    // None: Always show full sidebar - more proportional
                    <>
                      <div className="w-6 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1 border-r">
                        <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                        <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                        <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                        <div className="h-0.5 w-3/4 bg-foreground/30 rounded"></div>
                      </div>
                      <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20"></div>
                    </>
                  )}
                </div>
              </div>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>

      <Separator />

      {/* Sidebar Side */}
      <FieldSet>
        <FieldLegend variant="label">Sidebar Position</FieldLegend>
        {sidebarConfig.side && (
          <FieldDescription>
            {sidebarConfig.side === "left" &&
              "Left: Sidebar positioned on the left side"}
            {sidebarConfig.side === "right" &&
              "Right: Sidebar positioned on the right side"}
          </FieldDescription>
        )}
        <RadioGroup
          value={sidebarConfig.side}
          onValueChange={(value) =>
            handleSidebarSideSelect(value as "left" | "right")
          }
          className="grid grid-cols-2 gap-3"
        >
          {sidebarSideOptions.map((side) => (
            <FieldLabel
              key={side.value}
              htmlFor={`sidebar-side-${side.value}`}
              className="relative w-full cursor-pointer flex-col items-stretch gap-0 rounded-md border border-border p-4 transition-colors hover:border-border/60 has-data-checked:border-primary has-data-checked:bg-primary/10 dark:has-data-checked:border-primary dark:has-data-checked:bg-primary/10"
            >
              <RadioGroupItem
                id={`sidebar-side-${side.value}`}
                value={side.value}
                className="sr-only absolute"
              />
              {/* Visual representation of sidebar side */}
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-center">
                  {side.name}
                </div>
                <div className="flex h-12 rounded border bg-background">
                  {side.value === "left" ? (
                    // Left sidebar layout - more proportional
                    <>
                      <div className="w-6 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1 border-r">
                        <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                        <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                        <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                        <div className="h-0.5 w-3/4 bg-foreground/30 rounded"></div>
                      </div>
                      <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20"></div>
                    </>
                  ) : (
                    // Right sidebar layout - more proportional
                    <>
                      <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20"></div>
                      <div className="w-6 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1 border-l">
                        <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                        <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                        <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                        <div className="h-0.5 w-3/4 bg-foreground/30 rounded"></div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>
    </div>
  )
}
