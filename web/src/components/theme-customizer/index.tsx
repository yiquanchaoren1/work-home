"use client"

import React from "react"
import { Layout, Palette, RotateCcw, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useThemeManager } from "@/hooks/use-theme-manager"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"
import {useWorkspace} from "@/hub/workspace"
import { tweakcnThemes,colorThemes } from "@/config/theme-data"
import { ThemeTab } from "./theme-tab"
import { LayoutTab } from "./layout-tab"
import { ImportModal } from "./import-modal"
import { cn } from "@/lib/utils"
import type { ImportedTheme } from "@/types/theme-customizer"

interface ThemeCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThemeCustomizer({ open, onOpenChange }: ThemeCustomizerProps) {
  const w=useWorkspace()
  React.useEffect(()=>()=>{const root=document.documentElement;for(const k of Array.from(root.style))if(k.startsWith('--'))root.style.removeProperty(k);const settings=w.current.current.settings;for(const [k,v] of Object.entries((settings.theme==='dark'?settings.ui?.darkStyles:settings.ui?.styles)||{}))root.style.setProperty(k,v)},[])
  const saveAppearance=()=>{
    const vars=Object.fromEntries(Array.from(document.documentElement.style).filter(k=>k.startsWith("--")).map(k=>[k,document.documentElement.style.getPropertyValue(k)]))
    const preset=colorThemes.find(t=>t.value===selectedTheme)?.preset||tweakcnThemes.find(t=>t.value===selectedTweakcnTheme)?.preset
    const css=(v:Record<string,string>)=>Object.fromEntries(Object.entries(v).map(([k,v])=>["--"+k,v]))
    let light=didReset?{}:preset?css(preset.styles.light):importedTheme?css(importedTheme.light):w.current.current.settings.ui?.styles||{}
    let dark=didReset?{}:preset?css(preset.styles.dark):importedTheme?css(importedTheme.dark):w.current.current.settings.ui?.darkStyles||{}
    if(isDarkMode)dark=vars;else light=vars
    if(w.save({...w.current.current,settings:{...w.current.current.settings,ui:{...w.current.current.settings.ui,styles:light,darkStyles:dark,sidebar:sidebarConfig}}},"保存外观"))onOpenChange(false)
  }
  const {
    applyImportedTheme,
    isDarkMode,
    resetTheme,
    applyRadius,
    setBrandColorsValues,
    applyTheme,
    applyTweakcnTheme,
  } = useThemeManager()
  const { config: sidebarConfig, updateConfig: updateSidebarConfig } =
    useSidebarConfig()

  const [didReset,setDidReset]=React.useState(false)
  const [activeTab, setActiveTab] = React.useState("theme")
  const [selectedTheme, setSelectedTheme] = React.useState("")
  const [selectedTweakcnTheme, setSelectedTweakcnTheme] = React.useState("")
  const [selectedRadius, setSelectedRadius] = React.useState("0.5rem")
  const [importModalOpen, setImportModalOpen] = React.useState(false)
  const [importedTheme, setImportedTheme] =
    React.useState<ImportedTheme | null>(null)

  const handleReset = () => {
    setDidReset(true)
    // Complete reset to application defaults

    // 1. Reset all state variables to initial values
    setSelectedTheme("") // Clear theme selection after reset
    setSelectedTweakcnTheme("")
    setSelectedRadius("0.5rem")
    setImportedTheme(null) // Clear imported theme
    setBrandColorsValues({}) // Clear brand colors state

    // 2. Completely remove all custom CSS variables
    resetTheme()

    // 3. Reset the radius to default
    applyRadius("0.5rem")

    // 4. Reset sidebar to defaults
    updateSidebarConfig({
      variant: "inset",
      collapsible: "offcanvas",
      side: "left",
    })
  }

  const handleImport = (themeData: ImportedTheme) => {
    setDidReset(false)
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
          side={sidebarConfig.side === "left" ? "right" : "left"}
          className="w-full sm:w-[400px] p-0 gap-0 pointer-events-auto overflow-hidden flex flex-col bg-background"
        >
          <SheetHeader className="gap-0 p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="size-4" />
              </div>
              <SheetTitle className="text-lg font-semibold">
                外观定制
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
            <SheetDescription className="text-sm text-muted-foreground sr-only">
              Customize the them and layout of your dashboard.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <div className="py-2">
                <TabsList className="w-full rounded-none group-data-horizontal/tabs:h-10">
                  <TabsTrigger value="theme" className="cursor-pointer">
                    <Palette /> 主题配色
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="cursor-pointer">
                    <Layout /> 页面布局
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="theme" className="flex-1 mt-0">
                <ThemeTab
                  selectedTheme={selectedTheme}
                  setSelectedTheme={v=>{setDidReset(false);setSelectedTheme(v)}}
                  selectedTweakcnTheme={selectedTweakcnTheme}
                  setSelectedTweakcnTheme={v=>{setDidReset(false);setSelectedTweakcnTheme(v)}}
                  selectedRadius={selectedRadius}
                  setSelectedRadius={setSelectedRadius}
                  setImportedTheme={setImportedTheme}
                  onImportClick={handleImportClick}
                />
              </TabsContent>

              <TabsContent value="layout" className="flex-1 mt-0">
                <LayoutTab />
              </TabsContent>
            </Tabs>
          </div>
          <div className="p-4 border-t bg-background space-y-2"><p className="text-xs text-muted-foreground">预览配色后保存，刷新页面仍然生效。布局选项即时保存。</p><Button className="w-full" onClick={saveAppearance}>保存外观</Button></div>
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

// Floating trigger button - positioned dynamically based on sidebar side
export function ThemeCustomizerTrigger({ onClick }: { onClick: () => void }) {
  const { config: sidebarConfig } = useSidebarConfig()

  return (
    <Button
      onClick={onClick}
      aria-label="打开外观定制"
      size="icon"
      className={cn(
        "fixed top-1/2 -mt-6 size-12 rounded-full shadow-lg z-50 active:not-aria-[haspopup]:translate-y-0 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer",
        sidebarConfig.side === "left" ? "right-4" : "left-4"
      )}
    >
      <Settings className="size-5" />
    </Button>
  )
}
