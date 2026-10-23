"use client"

import { ArrowRight, TrendingUp, Package } from "lucide-react"
import { Github } from "@/components/icons/brand-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export function CTASection() {
  return (
    <section className="py-16 lg:py-24 bg-muted/80">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <div className="flex flex-col gap-8">
              {/* Badge and Stats */}
              <div className="flex flex-col items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-2">
                  <TrendingUp />
                  Productivity Suite
                </Badge>

                <div className="text-muted-foreground flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <div className="size-2 rounded-full bg-success" />
                    150+ Blocks
                  </span>
                  <Separator orientation="vertical" className="h-4! data-vertical:self-center" />
                  <span>25K+ Downloads</span>
                  <Separator orientation="vertical" className="h-4! data-vertical:self-center" />
                  <span>4.9★ Rating</span>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex flex-col gap-6">
                <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  Supercharge your team's
                  <span className="flex sm:inline-flex justify-center">
                    <span className="relative mx-2">
                      <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        performance
                      </span>
                      <div className="absolute start-0 -bottom-2 h-1 w-full bg-gradient-to-r from-primary/30 to-secondary/30" />
                    </span>
                    today
                  </span>
                </h1>

                <p className="text-muted-foreground mx-auto max-w-2xl text-balance lg:text-xl">
                  Stop building from scratch. Get production-ready components,
                  templates and dashboards that integrate seamlessly with your
                  shadcn/ui projects.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col justify-center gap-4 sm:flex-row sm:gap-6">
                <Button
                  size="lg"
                  className="cursor-pointer px-8 py-6 text-lg font-medium"
                  nativeButton={false}
                  render={
                    <a
                      href="https://shadcnstore.com/blocks"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <Package className="size-5" data-icon="inline-start" />
                  Browse Components
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="cursor-pointer px-8 py-6 text-lg font-medium group"
                  nativeButton={false}
                  render={
                    <a
                      href="https://github.com/shadcnstore/shadcn-dashboard-landing-template"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <Github className="size-5" data-icon="inline-start" />
                  View on GitHub
                  <ArrowRight
                    className="transition-transform group-hover:translate-x-1"
                    data-icon="inline-end"
                  />
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-success me-1" />

                  <span>Free components available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-info me-1" />

                  <span>Commercial license included</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-warning me-1" />

                  <span>Regular updates & support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
