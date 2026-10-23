"use client"

import { useState,useEffect } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  MoreHorizontal,
  Search,
  Grid3X3,
  List,
  ChevronDown,
  Menu,
} from "lucide-react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { type CalendarEvent } from "../types"

// Import data
import eventsData from "../data/events.json"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

interface CalendarMainProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  onMenuClick?: () => void
  events?: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
}

export function CalendarMain({
  selectedDate,
  onDateSelect,
  onMenuClick,
  events,
  onEventClick,
}: CalendarMainProps) {
  // Convert JSON events to CalendarEvent objects with proper Date objects, fallback to imported data
  const allEvents: CalendarEvent[] =
    events ||
    eventsData.map((event) => ({
      ...event,
      date: new Date(event.date),
      type: event.type as
        "meeting" | "event" | "personal" | "task" | "reminder",
    }))

  const [searchQuery,setSearchQuery]=useState('')
  const sampleEvents=allEvents.filter(e=>e.title.toLowerCase().includes(searchQuery.toLowerCase()))
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date())
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">(
    "month"
  )
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  useEffect(()=>{if(selectedDate)setCurrentDate(selectedDate)},[selectedDate])
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  // Extend to show full weeks (including previous/next month days)
  const calendarStart = new Date(monthStart)
  calendarStart.setDate(calendarStart.getDate() - monthStart.getDay())

  const calendarEnd = new Date(monthEnd)
  calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()))

  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  })

  const getEventsForDay = (date: Date) => {
    return sampleEvents.filter((event) => isSameDay(event.date, date))
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(
      direction === "prev"
        ? subMonths(currentDate, 1)
        : addMonths(currentDate, 1)
    )
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleEventClick = (event: CalendarEvent) => {
    if (onEventClick) {
      onEventClick(event)
    } else {
      setSelectedEvent(event)
      setShowEventDialog(true)
    }
  }

  const renderCalendarGrid = () => {
    const weekDays = ["周日","周一","周二","周三","周四","周五","周六"]

    return (
      <div className="flex-1 bg-background min-w-[680px]">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-4 text-center font-medium text-sm text-muted-foreground border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7 flex-1">
          {calendarDays.map((day) => {
            const dayEvents = getEventsForDay(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isDayToday = isToday(day)
            const isSelected = selectedDate && isSameDay(day, selectedDate)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] border-r border-b last:border-r-0 p-2 cursor-pointer transition-colors",
                  isCurrentMonth
                    ? "bg-background hover:bg-accent/50"
                    : "bg-muted/30 text-muted-foreground",
                  isSelected && "ring-2 ring-primary ring-inset",
                  isDayToday && "bg-accent/20"
                )}
                onClick={() => onDateSelect?.(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDayToday &&
                        "bg-primary text-primary-foreground rounded-md size-6 flex items-center justify-center text-xs"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 2 && (
                    <span className="text-xs text-muted-foreground">
                      +{dayEvents.length - 2}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs p-1 rounded-sm text-white cursor-pointer truncate",
                        event.color
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEventClick(event)
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span className="truncate">{event.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderListView = () => {
    const upcomingEvents = sampleEvents
      .filter((event) => isSameMonth(event.date,currentDate))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return (
      <div className="flex-1 p-6">
        <div className="flex flex-col gap-4">
          {upcomingEvents.map((event) => (
            <Card
              key={event.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleEventClick(event)}
            >
              <CardContent className="px-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn("size-3 rounded-full mt-1.5", event.color)}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{event.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center flex-wrap gap-1">
                          <CalendarIcon className="size-4" />
                          {format(event.date, "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center flex-wrap gap-1">
                          <Clock className="size-4" />
                          {event.time}
                        </div>
                        <div className="flex items-center flex-wrap gap-1">
                          <MapPin className="size-4" />
                          {event.location}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AvatarGroup>
                      {event.attendees.slice(0, 3).map((attendee, index) => (
                        <Avatar key={index}>
                          <AvatarFallback className="text-xs">
                            {attendee}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer"
                    >
                      <MoreHorizontal />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col flex-wrap gap-4 p-6 border-b md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Mobile Menu Button */}
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden cursor-pointer"
            onClick={onMenuClick}
          >
            <Menu />
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
              className="cursor-pointer"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
              className="cursor-pointer"
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="cursor-pointer"
            >
              今天
            </Button>
          </div>

          <h1 className="text-2xl font-semibold">
            {format(currentDate, "yyyy年MM月")}
          </h1>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Search */}
          <InputGroup>
            <InputGroupInput placeholder="搜索日历事项…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full sm:w-48" />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>

          {/* View Mode Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" className="cursor-pointer" />}
            >
              {viewMode === "month" && <Grid3X3 />}
              {viewMode === "list" && <List />}
              {viewMode==='month'?'月视图':'列表'}
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setViewMode("month")}
                  className="cursor-pointer"
                >
                  <Grid3X3 />
                  月视图
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setViewMode("list")}
                  className="cursor-pointer"
                >
                  <List />
                  列表
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Calendar Content */}
      {viewMode === "month" ? <div className="min-w-0 overflow-x-auto">{renderCalendarGrid()}</div> : renderListView()}

      {/* Event Detail Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title || "Event Details"}</DialogTitle>
            <DialogDescription>
              View and manage this calendar event
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4 text-muted-foreground" />
                <span>{format(selectedEvent.date, "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span>
                  {selectedEvent.time} ({selectedEvent.duration})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <span>{selectedEvent.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span>Attendees:</span>
                  <AvatarGroup>
                    {selectedEvent.attendees.map(
                      (attendee: string, index: number) => (
                        <Avatar key={index} size="sm">
                          <AvatarFallback className="text-xs">
                            {attendee}
                          </AvatarFallback>
                        </Avatar>
                      )
                    )}
                  </AvatarGroup>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn("text-white", selectedEvent.color)}
                >
                  {selectedEvent.type}
                </Badge>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setShowEventDialog(false)
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setShowEventDialog(false)
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
