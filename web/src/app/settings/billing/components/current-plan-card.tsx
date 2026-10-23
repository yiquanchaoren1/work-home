import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Crown, AlertTriangle } from "lucide-react"

interface CurrentPlan {
  planName: string
  price: string
  nextBilling: string
  status: string
  daysUsed: number
  totalDays: number
  progressPercentage: number
  remainingDays: number
  needsAttention: boolean
  attentionMessage: string
}

interface CurrentPlanCardProps {
  plan: CurrentPlan
}

export function CurrentPlanCard({ plan }: CurrentPlanCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Plan</CardTitle>
        <CardDescription>
          You are currently on the {plan.planName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="size-5 text-warning" />
            <span className="font-semibold">{plan.planName}</span>
            <Badge variant="secondary">{plan.status}</Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{plan.price}</div>
            <div className="text-sm text-muted-foreground">
              Next billing: {plan.nextBilling}
            </div>
          </div>
        </div>

        {plan.needsAttention && (
          <Alert>
            <AlertTriangle />
            <AlertTitle>We need your attention!</AlertTitle>
            <AlertDescription>
              <p>{plan.attentionMessage}</p>
              {/* Progress Section */}
              <div className="mt-3 flex w-full flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-medium">
                    Days
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">
                    {plan.daysUsed} of {plan.totalDays} Days
                  </span>
                </div>
                <Progress value={plan.progressPercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {plan.remainingDays} days remaining until your plan requires
                  update
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
