"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import {
  ThemeCustomizer,
} from "@/components/theme-customizer"
import { WorkspaceStatus } from "@/hub/status"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

interface BaseLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  customizerOpen?: boolean
  onCustomizerOpenChange?: (v:boolean)=>void
}

export function BaseLayout({ children, title, description,customizerOpen,onCustomizerOpenChange }: BaseLayoutProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const themeCustomizerOpen=customizerOpen??internalOpen,setThemeCustomizerOpen=onCustomizerOpenChange??setInternalOpen
  const { config } = useSidebarConfig()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "var(--hub-sidebar-width,16rem)",
          "--sidebar-width-icon": "3rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
      className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
    >
      {config.side === "left" ? (
        <>
          <AppSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
          <SidebarInset>
            <SiteHeader onCustomize={()=>setThemeCustomizerOpen(true)} /><WorkspaceStatus />
            <div className="flex flex-1 flex-col">
              <div className="@container/main hub-content-shell flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  {title && (
                    <div className="px-4 lg:px-6">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">
                          {title}
                        </h1>
                        {description && (
                          <p className="text-muted-foreground">{description}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </div>
            <SiteFooter />
          </SidebarInset>
        </>
      ) : (
        <>
          <SidebarInset>
            <SiteHeader onCustomize={()=>setThemeCustomizerOpen(true)} /><WorkspaceStatus />
            <div className="flex flex-1 flex-col">
              <div className="@container/main hub-content-shell flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  {title && (
                    <div className="px-4 lg:px-6">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">
                          {title}
                        </h1>
                        {description && (
                          <p className="text-muted-foreground">{description}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </div>
            <SiteFooter />
          </SidebarInset>
          <AppSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
        </>
      )}

      {/* Theme Customizer */}

      {themeCustomizerOpen && <ThemeCustomizer
        open={themeCustomizerOpen}
        onOpenChange={setThemeCustomizerOpen}
      />}

    </SidebarProvider>
  )
}
