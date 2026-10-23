"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CardDecorator } from "@/components/ui/card-decorator"
import { Code, Palette, Layout, Crown } from "lucide-react"
import { Github } from "@/components/icons/brand-icons"

const values = [
  {
    icon: Code,
    title: "Developer First",
    description:
      "Every component is built with the developer experience in mind, ensuring clean code and easy integration.",
  },
  {
    icon: Palette,
    title: "Design Excellence",
    description:
      "We maintain the highest design standards, following shadcn/ui principles and modern UI patterns.",
  },
  {
    icon: Layout,
    title: "Production Ready",
    description:
      "Battle-tested components used in real applications with proven performance and reliability across different environments.",
  },
  {
    icon: Crown,
    title: "Premium Quality",
    description:
      "Hand-crafted with attention to detail and performance optimization, ensuring exceptional user experience and accessibility.",
  },
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            About ShadcnStore
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            Built for developers, by developers
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            We're passionate about creating the best marketplace for shadcn/ui
            components and templates. Our mission is to accelerate development
            and help developers build beautiful admin interfaces faster.
          </p>
        </div>

        {/* Modern Values Grid with Enhanced Design */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4 mb-12">
          {values.map((value, index) => (
            <Card key={index} className="group shadow-xs py-2">
              <CardHeader className="items-center p-8 text-center">
                <CardDecorator>
                  <value.icon className="size-6" aria-hidden />
                </CardDecorator>
                <CardTitle className="mt-6 text-balance">
                  {value.title}
                </CardTitle>
                <CardDescription className="mt-3">
                  {value.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-muted-foreground">
              ❤️ Made with love for the developer community
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="cursor-pointer"
              nativeButton={false}
              render={
                <a
                  href="https://github.com/shadcnstore/shadcn-dashboard-landing-template"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Github data-icon="inline-start" />
              Star on GitHub
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="cursor-pointer"
              nativeButton={false}
              render={
                <a
                  href="https://discord.com/invite/XEQhPc9a6p"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Join Discord Community
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
