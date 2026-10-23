import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  CreditCard,
  UserCheck,
  Clock5,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const performanceMetrics = [
  {
    title: "Total Users",
    current: "$2.4M",
    previous: "$1.8M",
    growth: 33.3,
    icon: Users,
  },
  {
    title: "Paid Users",
    current: "12.5K",
    previous: "9.2K",
    growth: 35.9,
    icon: CreditCard,
  },
  {
    title: "Active Users",
    current: "8.9k",
    previous: "6.7k",
    growth: 32.8,
    icon: UserCheck,
  },
  {
    title: "Pending Users",
    current: "17%",
    previous: "24%",
    growth: -8.0,
    icon: Clock5,
  },
]

export function StatCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {performanceMetrics.map((metric, index) => (
        <Card key={index} className="border">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <metric.icon className="text-muted-foreground size-6" />
              <Badge
                variant="outline"
                className={cn(
                  metric.growth >= 0
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                {metric.growth >= 0 ? (
                  <>
                    <TrendingUp />
                    {metric.growth >= 0 ? "+" : ""}
                    {metric.growth}%
                  </>
                ) : (
                  <>
                    <TrendingDown />
                    {metric.growth}%
                  </>
                )}
              </Badge>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-sm font-medium">
                {metric.title}
              </p>
              <div className="text-2xl font-bold">{metric.current}</div>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <span>from {metric.previous}</span>
                <ArrowUpRight className="size-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
