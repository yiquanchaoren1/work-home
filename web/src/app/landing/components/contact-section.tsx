"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MessageCircle, BookOpen } from "lucide-react"
import { Github } from "@/components/icons/brand-icons"

const contactFormSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters.",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  subject: z.string().min(5, {
    message: "Subject must be at least 5 characters.",
  }),
  message: z.string().min(10, {
    message: "Message must be at least 10 characters.",
  }),
})

export function ContactSection() {
  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "",
      message: "",
    },
  })

  function onSubmit(values: z.infer<typeof contactFormSchema>) {
    // Here you would typically send the form data to your backend
    console.log(values)
    // You could also show a success message or redirect
    form.reset()
  }

  return (
    <section id="contact" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            Get In Touch
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Need help or have questions?
          </h2>
          <p className="text-lg text-muted-foreground">
            Our team is here to help you get the most out of ShadcnStore. Choose
            the best way to reach out to us.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Options */}
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="size-5 text-primary" />
                  Discord Community
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  Join our active community for quick help and discussions with
                  other developers.
                </p>
                <Button
                  variant="outline"
                  size="sm"
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
                  Join Discord
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github className="size-5 text-primary" />
                  GitHub Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  Report bugs, request features, or contribute to our open
                  source repository.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  nativeButton={false}
                  render={
                    <a
                      href="https://github.com/shadcnstore/shadcn-dashboard-landing-template/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  View on GitHub
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  Browse our comprehensive guides, tutorials, and component
                  documentation.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  nativeButton={false}
                  render={<a href="#" />}
                >
                  View Docs
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-5" />
                  Send us a message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col gap-6"
                >
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="firstName"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="contact-section-first-name">
                            First name
                          </FieldLabel>

                          <Input
                            id="contact-section-first-name"
                            aria-invalid={fieldState.invalid}
                            placeholder="John"
                            {...field}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="lastName"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="contact-section-last-name">
                            Last name
                          </FieldLabel>

                          <Input
                            id="contact-section-last-name"
                            aria-invalid={fieldState.invalid}
                            placeholder="Doe"
                            {...field}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <Controller
                      control={form.control}
                      name="email"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="contact-section-email">
                            Email
                          </FieldLabel>

                          <Input
                            id="contact-section-email"
                            aria-invalid={fieldState.invalid}
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="subject"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="contact-section-subject">
                            Subject
                          </FieldLabel>

                          <Input
                            id="contact-section-subject"
                            aria-invalid={fieldState.invalid}
                            placeholder="Component request, bug report, general inquiry..."
                            {...field}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="message"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="contact-section-message">
                            Message
                          </FieldLabel>

                          <Textarea
                            id="contact-section-message"
                            aria-invalid={fieldState.invalid}
                            placeholder="Tell us how we can help you with ShadcnStore components..."
                            rows={10}
                            className="min-h-50"
                            {...field}
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                  </FieldGroup>
                  <Button type="submit" className="w-full cursor-pointer">
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
