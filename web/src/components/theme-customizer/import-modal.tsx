"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { ImportedTheme } from "@/types/theme-customizer"

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (theme: ImportedTheme) => void
}

export function ImportModal({
  open,
  onOpenChange,
  onImport,
}: ImportModalProps) {
  const [importText, setImportText] = React.useState("")
  const [error,setError]=React.useState("")

  const processImport = () => {
    try {
      if (!importText.trim()) {
        console.error("No CSS content provided")
        return
      }

      // Parse CSS content into light and dark theme variables
      const lightTheme: Record<string, string> = {}
      const darkTheme: Record<string, string> = {}

      // Split CSS into sections
      const cssText = importText.replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments

      // Extract :root section (light theme)
      const rootMatch = cssText.match(/:root\s*\{([^}]+)\}/)
      if (rootMatch) {
        const rootContent = rootMatch[1]
        const variableMatches = rootContent.matchAll(/--([^:]+):\s*([^;]+);/g)
        for (const match of variableMatches) {
          const [, variable, value] = match
          lightTheme[variable.trim()] = value.trim()
        }
      }

      // Extract .dark section (dark theme)
      const darkMatch = cssText.match(/\.dark\s*\{([^}]+)\}/)
      if (darkMatch) {
        const darkContent = darkMatch[1]
        const variableMatches = darkContent.matchAll(/--([^:]+):\s*([^;]+);/g)
        for (const match of variableMatches) {
          const [, variable, value] = match
          darkTheme[variable.trim()] = value.trim()
        }
      }

      if(!Object.keys(lightTheme).length||!Object.keys(darkTheme).length)throw Error('请提供 :root 和 .dark 两组 CSS 变量。')
      for(const vars of [lightTheme,darkTheme])for(const [k,v] of Object.entries(vars))if(!/^[a-z0-9-]+$/.test(k)||v.length>300||/[;{}<>]|url\s*\(/i.test(v))throw Error('主题包含不支持的 CSS 变量。')
      setError('')
      // Store the imported theme
      const importedThemeData = { light: lightTheme, dark: darkTheme }
      onImport(importedThemeData)

      onOpenChange(false)
      setImportText("")
    } catch (error) {
      setError((error as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="w-[90vw] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Custom CSS</DialogTitle>
          <DialogDescription>
            Paste your CSS theme below. Include both <code>:root</code> (light
            mode) and <code>.dark</code> (dark mode) sections with CSS variables
            like <code>--primary</code>, <code>--background</code>, etc. The
            theme will automatically switch between light and dark modes.
          </DialogDescription>
        </DialogHeader>
        {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Textarea
              id="theme-css"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm max-h-[400px] min-h-[300px] font-mono text-sm text-foreground overflow-y-auto resize-none"
              placeholder={`:root {
  --background: 0 0% 100%;
  --foreground: oklch(0.52 0.13 144.17);
  --primary: #3e2723;
  /* And more */
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: hsl(37.50 36.36% 95.69%);
  --primary: rgb(46, 125, 50);
  /* And more */
}`}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={processImport}
              disabled={!importText.trim()}
              className="cursor-pointer"
            >
              Import Theme
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
