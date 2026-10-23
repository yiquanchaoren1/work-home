"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "./logo"

export function SidebarNotification() {
  const [isVisible, setIsVisible] = React.useState(true)

  if (!isVisible) return null

  return (
    <Card className="mb-3 py-0 bg-muted/50 shadow-sm">
      <CardContent className="p-4 relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 size-6 p-0"
          onClick={() => setIsVisible(false)}
        >
          <X />
          <span className="sr-only">Close notification</span>
        </Button>

        <div className="pr-6">
          <h3 className="flex items-center gap-3 font-semibold mb-2 mt-1">
            <Logo size={42} className="-mt-1" />
            <div>
              Welcome to{" "}
              <a
                href="https://shadcnstore.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                ShadcnStore
              </a>
            </div>
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Explore our premium Shadcn UI{" "}
            <a
              href="https://shadcnstore.com/blocks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              blocks
            </a>{" "}
            to build your next project faster.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
