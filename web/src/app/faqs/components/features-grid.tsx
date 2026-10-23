import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { Feature } from "../data/features"

interface FeaturesGridProps {
  features: Feature[]
}

export function FeaturesGrid({ features }: FeaturesGridProps) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
      {features.map(({ id, title, description, icon: Icon }) => (
        <article key={id} className="group">
          <Card className="relative h-full overflow-hidden transition-all hover:shadow-md">
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button
                variant="link"
                size="sm"
                className="h-auto cursor-pointer p-0! text-sm text-muted-foreground hover:text-foreground"
              >
                Learn more
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        </article>
      ))}
    </div>
  )
}
