"use client"

import { ArrowRight } from "lucide-react"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const blogs = [
  {
    id: 1,
    image: "https://ui.shadcn.com/placeholder.svg",
    category: "Technology",
    title: "AI Development Catalysts",
    description:
      "Exploring how AI-driven tools are transforming software development workflows and accelerating innovation.",
  },
  {
    id: 2,
    image: "https://ui.shadcn.com/placeholder.svg",
    category: "Lifestyle",
    title: "Minimalist Living Guide",
    description:
      "Minimalist living approaches that can help reduce stress and create more meaningful daily experiences.",
  },
  {
    id: 3,
    image: "https://ui.shadcn.com/placeholder.svg",
    category: "Design",
    title: "Accessible UI Trends",
    description:
      "How modern UI trends are embracing accessibility while maintaining sleek, intuitive user experiences.",
  },
]

export function BlogSection() {
  return (
    <section id="blog" className="py-24 sm:py-32 bg-muted/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            Latest Insights
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            From our blog
          </h2>
          <p className="text-lg text-muted-foreground">
            Stay updated with the latest trends, best practices, and insights
            from our team of experts.
          </p>
        </div>

        {/* Blog Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {blogs.map((blog) => (
            <Card key={blog.id} className="overflow-hidden py-0">
              <div className="aspect-video">
                <img
                  src={blog.image}
                  alt={blog.title}
                  className="size-full object-cover dark:invert dark:brightness-[0.95]"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <CardHeader className="gap-3 px-6 pt-6">
                <p className="text-xs tracking-widest text-muted-foreground uppercase">
                  {blog.category}
                </p>
                <CardTitle className="text-xl font-bold">
                  {blog.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {blog.description}
                </CardDescription>
              </CardHeader>
              <CardFooter className="px-6 pb-6">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-2 text-primary hover:underline cursor-pointer"
                >
                  Learn More
                  <ArrowRight className="size-4" />
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
