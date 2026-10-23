"use client"

import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns"
import { Search, Pin, VolumeX, MoreHorizontal, Users, Hash } from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useChat, type Conversation } from "@/app/chat/use-chat"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

interface ConversationListProps {
  conversations: Conversation[]
  selectedConversation: string | null
  onSelectConversation: (conversationId: string) => void
}

// Enhanced time formatting function
function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp)

  if (isToday(date)) {
    return format(date, "h:mm a") // 3:30 PM
  } else if (isYesterday(date)) {
    return "Yesterday"
  } else if (isThisWeek(date)) {
    return format(date, "EEEE") // Day name
  } else if (isThisYear(date)) {
    return format(date, "MMM d") // Jan 15
  } else {
    return format(date, "dd/MM/yy") // 15/01/24
  }
}

export function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
}: ConversationListProps) {
  const { searchQuery, setSearchQuery, togglePin, toggleMute } = useChat()

  const filteredConversations = conversations.filter((conversation) =>
    conversation.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sortedConversations = filteredConversations.sort((a, b) => {
    // Pinned conversations first
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1

    // Then by last message timestamp
    return (
      new Date(b.lastMessage.timestamp).getTime() -
      new Date(a.lastMessage.timestamp).getTime()
    )
  })

  const getOnlineStatus = (conversation: Conversation) => {
    if (
      conversation.type === "direct" &&
      conversation.participants.length === 1
    ) {
      // In a real app, you'd check user online status
      // Mock online status, stable per conversation across renders
      return conversation.id.charCodeAt(conversation.id.length - 1) % 2 === 0
    }
    return false
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>

      {/* Search */}
      <div className="p-4 border-b flex-shrink-0">
        <InputGroup>
          <InputGroupInput
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cursor-text"
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {sortedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer relative group overflow-hidden hover:bg-accent/50 transition-colors",
                selectedConversation === conversation.id
                  ? "bg-accent text-accent-foreground"
                  : ""
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              {/* Avatar with online indicator */}
              <div className="relative flex-shrink-0">
                <Avatar
                  className={cn(
                    "size-12",
                    selectedConversation === conversation.id &&
                      "ring-2 ring-background"
                  )}
                >
                  <AvatarImage
                    src={conversation.avatar}
                    alt={conversation.name}
                  />
                  <AvatarFallback className="text-sm">
                    {conversation.type === "group" ? (
                      <Users className="size-5" />
                    ) : (
                      conversation.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Online indicator for direct messages */}
                {conversation.type === "direct" &&
                  getOnlineStatus(conversation) && (
                    <div className="absolute -bottom-1 -right-1 size-4 bg-success border-2 border-background rounded-full" />
                  )}

                {/* Group indicator */}
                {conversation.type === "group" && (
                  <div className="absolute -bottom-1 -right-1 size-4 bg-info border-2 border-background rounded-full flex items-center justify-center">
                    <Hash className="size-2 text-info-foreground" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between mb-1 min-w-0">
                  <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                    <h3 className="font-medium truncate min-w-0 max-w-[180px]">
                      {conversation.name}
                    </h3>
                    {conversation.isPinned && (
                      <Pin className="size-3 text-muted-foreground flex-shrink-0" />
                    )}
                    {conversation.isMuted && (
                      <VolumeX className="size-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2 whitespace-nowrap">
                    {formatMessageTime(conversation.lastMessage.timestamp)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 min-w-0">
                  <p className="text-sm text-muted-foreground truncate flex-1 min-w-0 max-w-[200px]">
                    {conversation.lastMessage.content}
                  </p>

                  {/* Unread count */}
                  {conversation.unreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="ml-2 min-w-[20px] h-5 text-xs cursor-pointer flex-shrink-0"
                    >
                      {conversation.unreadCount > 99
                        ? "99+"
                        : conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions menu */}
              <div className="opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePin(conversation.id)
                        }}
                        className="cursor-pointer"
                      >
                        <Pin />
                        {conversation.isPinned ? "Unpin" : "Pin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleMute(conversation.id)
                        }}
                        className="cursor-pointer"
                      >
                        <VolumeX />
                        {conversation.isMuted ? "Unmute" : "Mute"}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem className="cursor-pointer text-destructive">
                        Delete conversation
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
