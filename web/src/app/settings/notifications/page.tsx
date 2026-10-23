"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { BaseLayout } from "@/components/layouts/base-layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Bell, Mail, MessageSquare } from "lucide-react"

const notificationsFormSchema = z.object({
  emailSecurity: z.boolean(),
  emailUpdates: z.boolean(),
  emailMarketing: z.boolean(),
  pushMessages: z.boolean(),
  pushMentions: z.boolean(),
  pushTasks: z.boolean(),
  emailFrequency: z.string(),
  quietHoursStart: z.string(),
  quietHoursEnd: z.string(),
  channelEmail: z.boolean(),
  channelPush: z.boolean(),
  channelSms: z.boolean(),
  // New notification table fields
  orderUpdatesEmail: z.boolean(),
  orderUpdatesBrowser: z.boolean(),
  orderUpdatesApp: z.boolean(),
  invoiceRemindersEmail: z.boolean(),
  invoiceRemindersBrowser: z.boolean(),
  invoiceRemindersApp: z.boolean(),
  promotionalOffersEmail: z.boolean(),
  promotionalOffersBrowser: z.boolean(),
  promotionalOffersApp: z.boolean(),
  systemMaintenanceEmail: z.boolean(),
  systemMaintenanceBrowser: z.boolean(),
  systemMaintenanceApp: z.boolean(),
  notificationTiming: z.string(),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

export default function NotificationSettings() {
  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      emailSecurity: false,
      emailUpdates: true,
      emailMarketing: false,
      pushMessages: true,
      pushMentions: true,
      pushTasks: false,
      emailFrequency: "instant",
      quietHoursStart: "22:00",
      quietHoursEnd: "06:00",
      channelEmail: true,
      channelPush: true,
      channelSms: false,
      // New notification table defaults
      orderUpdatesEmail: true,
      orderUpdatesBrowser: true,
      orderUpdatesApp: true,
      invoiceRemindersEmail: true,
      invoiceRemindersBrowser: false,
      invoiceRemindersApp: true,
      promotionalOffersEmail: false,
      promotionalOffersBrowser: true,
      promotionalOffersApp: false,
      systemMaintenanceEmail: true,
      systemMaintenanceBrowser: true,
      systemMaintenanceApp: false,
      notificationTiming: "online",
    },
  })

  function onSubmit(data: NotificationsFormValues) {
    console.log("Notifications settings submitted:", data)
    // Here you would typically save the settings
  }

  return (
    <BaseLayout>
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            Configure how you receive notifications.
          </p>
        </div>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>
                  Choose what email notifications you want to receive.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <FieldGroup className="flex flex-col gap-4">
                  <Controller
                    control={form.control}
                    name="emailSecurity"
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        orientation="horizontal"
                      >
                        <Checkbox
                          id="notifications-email-security"
                          aria-invalid={fieldState.invalid}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="notifications-email-security">
                            Security alerts
                          </FieldLabel>
                          <FieldDescription>
                            Get notified when there are security events on your
                            account.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="emailUpdates"
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        orientation="horizontal"
                      >
                        <Checkbox
                          id="notifications-email-updates"
                          aria-invalid={fieldState.invalid}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="notifications-email-updates">
                            Product updates
                          </FieldLabel>
                          <FieldDescription>
                            Receive updates about new features and improvements.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="emailMarketing"
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        orientation="horizontal"
                      >
                        <Checkbox
                          id="notifications-email-marketing"
                          aria-invalid={fieldState.invalid}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="notifications-email-marketing">
                            Marketing emails
                          </FieldLabel>
                          <FieldDescription>
                            Receive emails about our latest offers and
                            promotions.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )}
                  />
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Push Notifications</CardTitle>
                <CardDescription>
                  Configure browser and mobile push notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <FieldGroup className="flex flex-col gap-4">
                  <Controller
                    control={form.control}
                    name="pushMessages"
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        orientation="horizontal"
                      >
                        <Checkbox
                          id="notifications-push-messages"
                          aria-invalid={fieldState.invalid}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="notifications-push-messages">
                            New messages
                          </FieldLabel>
                          <FieldDescription>
                            Get notified when you receive new messages.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="pushMentions"
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        orientation="horizontal"
                      >
                        <Checkbox
                          id="notifications-push-mentions"
                          aria-invalid={fieldState.invalid}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="notifications-push-mentions">
                            Mentions
                          </FieldLabel>
                          <FieldDescription>
                            Get notified when someone mentions you.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="pushTasks"
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        orientation="horizontal"
                      >
                        <Checkbox
                          id="notifications-push-tasks"
                          aria-invalid={fieldState.invalid}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="notifications-push-tasks">
                            Task updates
                          </FieldLabel>
                          <FieldDescription>
                            Get notified about task assignments and updates.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )}
                  />
                </FieldGroup>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Notification Frequency</CardTitle>
              <CardDescription>
                Control how often you receive notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Controller
                control={form.control}
                name="emailFrequency"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="notifications-email-frequency">
                      Email Frequency
                    </FieldLabel>
                    <Select
                      items={{
                        instant: "Instant",
                        hourly: "Hourly digest",
                        daily: "Daily digest",
                        weekly: "Weekly digest",
                        never: "Never",
                      }}
                      name={field.name}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <SelectTrigger
                        id="notifications-email-frequency"
                        aria-invalid={fieldState.invalid}
                        className="w-full"
                      >
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="instant">Instant</SelectItem>
                          <SelectItem value="hourly">Hourly digest</SelectItem>
                          <SelectItem value="daily">Daily digest</SelectItem>
                          <SelectItem value="weekly">Weekly digest</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Field>
                <FieldLabel htmlFor="notifications-quiet-hours-start">
                  Quiet Hours
                </FieldLabel>
                <div className="flex gap-2">
                  <Controller
                    control={form.control}
                    name="quietHoursStart"
                    render={({ field, fieldState }) => (
                      <Select
                        items={{
                          "22:00": "10:00 PM",
                          "23:00": "11:00 PM",
                          "00:00": "12:00 AM",
                        }}
                        name={field.name}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger
                          id="notifications-quiet-hours-start"
                          aria-invalid={fieldState.invalid}
                          className="w-50"
                        >
                          <SelectValue placeholder="Start" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="22:00">10:00 PM</SelectItem>
                            <SelectItem value="23:00">11:00 PM</SelectItem>
                            <SelectItem value="00:00">12:00 AM</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <span className="self-center">to</span>
                  <Controller
                    control={form.control}
                    name="quietHoursEnd"
                    render={({ field, fieldState }) => (
                      <Select
                        items={{
                          "06:00": "6:00 AM",
                          "07:00": "7:00 AM",
                          "08:00": "8:00 AM",
                        }}
                        name={field.name}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <SelectTrigger
                          id="notifications-quiet-hours-end"
                          aria-invalid={fieldState.invalid}
                          className="w-50"
                        >
                          <SelectValue placeholder="End" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="06:00">6:00 AM</SelectItem>
                            <SelectItem value="07:00">7:00 AM</SelectItem>
                            <SelectItem value="08:00">8:00 AM</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                We need permission from your browser to show notifications.{" "}
                <Button variant="link" className="p-0 h-auto text-primary">
                  Request Permission
                </Button>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">TYPE</TableHead>
                      <TableHead className="text-center">EMAIL</TableHead>
                      <TableHead className="text-center">BROWSER</TableHead>
                      <TableHead className="text-center">APP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        Order updates
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="orderUpdatesEmail"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-order-updates-email"
                                aria-label="Order updates: email"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="orderUpdatesBrowser"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-order-updates-browser"
                                aria-label="Order updates: browser"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="orderUpdatesApp"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-order-updates-app"
                                aria-label="Order updates: app"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        Invoice reminders
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="invoiceRemindersEmail"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-invoice-reminders-email"
                                aria-label="Invoice reminders: email"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="invoiceRemindersBrowser"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-invoice-reminders-browser"
                                aria-label="Invoice reminders: browser"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="invoiceRemindersApp"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-invoice-reminders-app"
                                aria-label="Invoice reminders: app"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        Promotional offers
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="promotionalOffersEmail"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-promotional-offers-email"
                                aria-label="Promotional offers: email"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="promotionalOffersBrowser"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-promotional-offers-browser"
                                aria-label="Promotional offers: browser"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="promotionalOffersApp"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-promotional-offers-app"
                                aria-label="Promotional offers: app"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        System maintenance
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="systemMaintenanceEmail"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-system-maintenance-email"
                                aria-label="System maintenance: email"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="systemMaintenanceBrowser"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-system-maintenance-browser"
                                aria-label="System maintenance: browser"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Controller
                          control={form.control}
                          name="systemMaintenanceApp"
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="justify-center">
                              <Checkbox
                                id="notifications-system-maintenance-app"
                                aria-label="System maintenance: app"
                                aria-invalid={fieldState.invalid}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </Field>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="flex flex-col gap-4">
                  <Controller
                    control={form.control}
                    name="notificationTiming"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="notifications-notification-timing">
                          When should we send you notifications?
                        </FieldLabel>
                        <Select
                          items={{
                            online: "Only When I'm online",
                            always: "Always",
                            never: "Never",
                          }}
                          name={field.name}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger
                            id="notifications-notification-timing"
                            aria-invalid={fieldState.invalid}
                            className="w-full max-w-sm"
                          >
                            <SelectValue placeholder="Select timing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="online">
                                Only When I'm online
                              </SelectItem>
                              <SelectItem value="always">Always</SelectItem>
                              <SelectItem value="never">Never</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Choose your preferred notification channels for different types
                of alerts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="flex flex-col gap-4">
                <Controller
                  control={form.control}
                  name="channelEmail"
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      orientation="horizontal"
                      className="justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="size-5 text-muted-foreground" />
                        <div>
                          <FieldLabel
                            htmlFor="notifications-channel-email"
                            className="font-medium mb-1"
                          >
                            Email
                          </FieldLabel>
                          <div className="text-sm text-muted-foreground">
                            Receive notifications via email
                          </div>
                        </div>
                      </div>

                      <Checkbox
                        id="notifications-channel-email"
                        aria-invalid={fieldState.invalid}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <Separator />
                <Controller
                  control={form.control}
                  name="channelPush"
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      orientation="horizontal"
                      className="justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="size-5 text-muted-foreground" />
                        <div>
                          <FieldLabel
                            htmlFor="notifications-channel-push"
                            className="font-medium mb-1"
                          >
                            Push Notifications
                          </FieldLabel>
                          <div className="text-sm text-muted-foreground">
                            Receive browser push notifications
                          </div>
                        </div>
                      </div>

                      <Checkbox
                        id="notifications-channel-push"
                        aria-invalid={fieldState.invalid}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <Separator />
                <Controller
                  control={form.control}
                  name="channelSms"
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      orientation="horizontal"
                      className="justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="size-5 text-muted-foreground" />
                        <div>
                          <FieldLabel
                            htmlFor="notifications-channel-sms"
                            className="font-medium mb-1"
                          >
                            SMS
                          </FieldLabel>
                          <div className="text-sm text-muted-foreground">
                            Receive notifications via SMS
                          </div>
                        </div>
                      </div>

                      <Checkbox
                        id="notifications-channel-sms"
                        aria-invalid={fieldState.invalid}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" className="cursor-pointer">
              Save Preferences
            </Button>
            <Button variant="outline" type="reset" className="cursor-pointer">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </BaseLayout>
  )
}
