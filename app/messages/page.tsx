"use client"

import React from "react"
import Phone from "lucide-react/Phone"
import Video from "lucide-react/Video"

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Send, Loader2, MoreVertical, MessageCircle, Smile, Flag, ShieldAlert, Trash2, AlertTriangle } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAuthStore } from "@/lib/store/auth-store"
import { Skeleton } from "@/components/ui/skeleton"
import { getSocket } from "@/lib/socket"

interface Conversation {
  id: string
  match_id: string
  user: {
    id: string
    first_name: string
    last_name?: string
    photos?: string[]
  }
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  recent_messages?: Message[]
  has_messages?: boolean
  is_active?: boolean
}

interface Message {
  id?: string
  _id?: string
  sender_id: string
  content: string
  created_at: string
  read?: boolean
}

export default function MessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [blockOnly, setBlockOnly] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [skipNextLoad, setSkipNextLoad] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldScrollRef = useRef(true)

  const emojiCategories = [
    {
      name: "Smileys",
      emojis: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥"]
    },
    {
      name: "Gestures",
      emojis: ["👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👋", "🖐️", "✋", "🖖", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔"]
    },
    {
      name: "Fun",
      emojis: ["🎉", "🎊", "🎈", "🎁", "🎀", "🎄", "🎃", "🔥", "⭐", "🌟", "✨", "💫", "🌈", "☀️", "🌙", "💯", "💢", "💥", "💦", "💨", "🎵", "🎶", "💋", "💌", "💍", "💎", "🍕", "🍔", "🍟", "🌮", "🍿", "☕"]
    }
  ]

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Socket.io setup
  useEffect(() => {
    const socket = getSocket()
    
    // Connect socket
    if (!socket.connected) {
      socket.connect()
    }

    // Join user's personal room for notifications
    if (user?.id || user?._id) {
      const userId = user.id || user._id
      socket.emit('join', userId)
    }

    // Listen for new messages - keep this listener active always
    const handleNewMessage = (message: Message) => {
      // Don't add our own sent messages (they're already added optimistically)
      const currentUserId = user?.id || user?._id
      if (message.sender_id === currentUserId) {
        return
      }
      
      setMessages((prev) => {
        // Check if message already exists (avoid duplicates)
        if (prev.some(m => m.id === message.id || m._id === message._id)) {
          return prev
        }
        return [...prev, message]
      })

      // Update conversation list with new last message
      setConversations(prev =>
        prev.map(c => {
          // Check if this message belongs to this conversation
          // We need to check if the message is from the selected conversation or update the list
          return {
            ...c,
            last_message: message.content,
            last_message_at: message.created_at
          }
        })
      )
    }

    socket.on('new-message', handleNewMessage)

    // Cleanup on unmount
    return () => {
      socket.off('new-message', handleNewMessage)
    }
  }, [user])

  // Join/leave conversation rooms when selection changes
  useEffect(() => {
    const socket = getSocket()
    
    if (selectedConversation) {
      socket.emit('join-conversation', selectedConversation.match_id)
      
      return () => {
        socket.emit('leave-conversation', selectedConversation.match_id)
      }
    }
  }, [selectedConversation])

  // Handle URL param for pre-selecting a conversation
  useEffect(() => {
    const matchId = searchParams.get("match")
    if (matchId && conversations.length > 0) {
      const conv = conversations.find(c => c.match_id === matchId)
      if (conv) {
        setSelectedConversation(conv)
      }
    }
  }, [searchParams, conversations])

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      if (skipNextLoad) {
        setSkipNextLoad(false)
        return
      }
      loadMessages(selectedConversation.match_id)
    }
  }, [selectedConversation])

  // Scroll to bottom when messages change
  useEffect(() => {
    // Only scroll if we should (not jumping around)
    if (shouldScrollRef.current) {
      // Use requestAnimationFrame for smoother scrolling without the "jump" effect
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }, [messages])

  // Filter conversations based on search
  useEffect(() => {
    const filtered = conversations.filter((conv) =>
      conv.user.first_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setFilteredConversations(filtered)
  }, [conversations, searchQuery])

  const loadConversations = async () => {
    setIsLoadingConversations(true)
    const result = await api.messages.getConversations()
    if (result.data) {
      setConversations(result.data)
      // Auto-select first conversation with messages, or first conversation if none selected
      if (result.data.length > 0 && !selectedConversation) {
        const matchId = searchParams.get("match")
        let conv: Conversation;
        
        if (matchId) {
          // Use URL param if provided
          conv = result.data.find((c: Conversation) => c.match_id === matchId) || result.data[0]
        } else {
          // Auto-select the most recent conversation with messages (sorted by backend)
          conv = result.data[0]
        }
        
        setSelectedConversation(conv)
        
        // If conversation has recent messages, use them to avoid extra API call
        if (conv.recent_messages && conv.recent_messages.length > 0) {
          setMessages(conv.recent_messages)
          // Still load all messages in the background
          loadMessages(conv.match_id)
        }
      }
    }
    setIsLoadingConversations(false)
  }

  const loadMessages = async (matchId: string) => {
    setIsLoadingMessages(true)
    const result = await api.messages.getMessages(matchId)
    if (result.data) {
      setMessages(result.data)
    }
    setIsLoadingMessages(false)
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "instant" })
    }
  }

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    // Update URL without navigation
    router.push(`/messages?match=${conv.match_id}`, { scroll: false })
    // Mark as read (optimistic)
    setConversations(prev => 
      prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
    )
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending || !selectedConversation) return

    const sentContent = newMessage
    
    // Optimistic update - clear input and add message immediately
    const currentUserId = user?.id || user?._id || "user-1"
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: sentContent,
      created_at: new Date().toISOString(),
    }
    
    // Clear input FIRST before any other state changes
    setNewMessage("")
    setMessages((prev) => [...prev, tempMessage])
    
    // Focus input immediately and keep focus
    inputRef.current?.focus()
    
    // Set sending state
    setIsSending(true)

    // Send message in background without blocking focus
    const result = await api.messages.send(selectedConversation.match_id, sentContent)
    
    if (result.data) {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempMessage.id ? result.data : msg))
      )
      // Update last message in conversation list
      setConversations(prev =>
        prev.map(c => c.id === selectedConversation.id 
          ? { ...c, last_message: sentContent, last_message_at: new Date().toISOString() }
          : c
        )
      )
    }
    
    setIsSending(false)
    
    // Re-focus after sending completes (in case it was lost)
    inputRef.current?.focus()
  }

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDateDivider = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
  }

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return
    
    setIsDeleting(true)
    // Simulate API call to delete conversation
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Clear messages and remove from conversations list
    setMessages([])
    setConversations(prev => prev.filter(c => c.id !== selectedConversation.id))
    setFilteredConversations(prev => prev.filter(c => c.id !== selectedConversation.id))
    
    // Select next conversation if available
    const remainingConversations = conversations.filter(c => c.id !== selectedConversation.id)
    if (remainingConversations.length > 0) {
      setSelectedConversation(remainingConversations[0])
    } else {
      setSelectedConversation(null)
    }
    
    setIsDeleting(false)
    setShowDeleteDialog(false)
  }

  const handleViewProfile = () => {
    if (selectedConversation) {
      router.push(`/profile/${selectedConversation.user.id}`)
    }
  }

  const handleUnmatch = async () => {
    if (!selectedConversation) return
    
    if (confirm(`Are you sure you want to unmatch with ${selectedConversation.user.first_name}? This will delete your conversation.`)) {
      const result = await api.matches.unmatch(selectedConversation.match_id)
      if (result.data) {
        // Remove from conversations
        setConversations(prev => prev.filter(c => c.id !== selectedConversation.id))
        setFilteredConversations(prev => prev.filter(c => c.id !== selectedConversation.id))
        
        // Select next conversation
        const remainingConversations = conversations.filter(c => c.id !== selectedConversation.id)
        if (remainingConversations.length > 0) {
          setSelectedConversation(remainingConversations[0])
        } else {
          setSelectedConversation(null)
        }
      }
    }
  }

  const handleReportAndBlock = async () => {
    if (!selectedConversation) return
    
    // Report if reason provided
    if (reportReason.trim()) {
      await api.browse.report(selectedConversation.user.id, reportReason)
    }
    
    // Block user
    await api.browse.block(selectedConversation.user.id)
    
    // Remove conversation
    setConversations(prev => prev.filter(c => c.id !== selectedConversation.id))
    setFilteredConversations(prev => prev.filter(c => c.id !== selectedConversation.id))
    
    // Select next conversation
    const remainingConversations = conversations.filter(c => c.id !== selectedConversation.id)
    if (remainingConversations.length > 0) {
      setSelectedConversation(remainingConversations[0])
    } else {
      setSelectedConversation(null)
    }
    
    setShowReportDialog(false)
    setReportReason("")
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  messages.forEach((msg) => {
    const dateStr = new Date(msg.created_at).toDateString()
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    if (lastGroup && new Date(lastGroup.messages[0].created_at).toDateString() === dateStr) {
      lastGroup.messages.push(msg)
    } else {
      groupedMessages.push({ date: dateStr, messages: [msg] })
    }
  })

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="flex h-[calc(100vh-80px)] md:h-screen">
        {/* Conversations Sidebar */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col",
          selectedConversation ? "hidden md:flex" : "flex"
        )}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-bold text-foreground mb-4">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors",
                      selectedConversation?.id === conv.id && "bg-muted",
                      conv.unread_count > 0 && "bg-primary/5"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage 
                          src={conv.user.photos?.[0] || "/placeholder.svg"} 
                          alt={conv.user.first_name} 
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {conv.user.first_name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={cn(
                          "font-medium text-foreground truncate",
                          conv.unread_count > 0 && "font-semibold"
                        )}>
                          {conv.user.first_name}
                        </h3>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTimestamp(conv.last_message_at)}
                        </span>
                      </div>
                      <p className={cn(
                        "text-sm truncate mt-0.5",
                        conv.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {conv.last_message || "Start a conversation"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-12 px-4">
                <Search className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  No results for &quot;{searchQuery}&quot;
                </p>
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <MessageCircle className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-2">No conversations yet</p>
                <p className="text-xs text-muted-foreground">
                  Match with someone to start chatting
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col bg-background",
          !selectedConversation ? "hidden md:flex" : "flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-4 p-4 border-b border-border bg-card">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </Button>
                
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={selectedConversation.user.photos?.[0] || "/placeholder.svg"} 
                    alt={selectedConversation.user.first_name} 
                  />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedConversation.user.first_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="font-semibold text-foreground">
                    {selectedConversation.user.first_name}
                  </h2>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleViewProfile}>
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Conversation
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleUnmatch}>
                      Unmatch
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setShowReportDialog(true)}
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report & Block
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : messages.length > 0 ? (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      <div className="flex justify-center mb-4">
                        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {formatDateDivider(group.messages[0].created_at)}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {group.messages.map((message) => {
                          const isOwn = message.sender_id === user?.id || message.sender_id === user?._id
                          const messageKey = message.id || message._id || `${message.sender_id}-${message.created_at}`
                          return (
                            <div
                              key={messageKey}
                              className={cn(
                                "flex",
                                isOwn ? "justify-end" : "justify-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[75%] px-4 py-2.5 rounded-2xl",
                                  isOwn
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-blue-500 text-white rounded-bl-md"
                                )}
                              >
                                <p className="text-sm leading-relaxed">{message.content}</p>
                                <p
                                  className={cn(
                                    "text-[10px] mt-1",
                                    isOwn ? "text-primary-foreground/70" : "text-white/70"
                                  )}
                                >
                                  {formatMessageTime(message.created_at)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No messages yet. Say hello!
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedConversation.is_active === false ? (
                <div className="p-4 border-t border-border bg-muted/50">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">No Longer Matched - You can view past messages but cannot send new ones</span>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSend}
                  className="p-4 border-t border-border bg-card"
                >
                  <div className="flex items-center gap-2">
                    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                        >
                          <Smile className="h-5 w-5 text-muted-foreground" />
                          <span className="sr-only">Add emoji</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        side="top" 
                        align="start" 
                        className="w-80 p-0"
                      >
                        <div className="p-3">
                          <p className="text-sm font-medium text-foreground mb-3">Emojis</p>
                          <div className="space-y-4 max-h-64 overflow-y-auto">
                            {emojiCategories.map((category) => (
                              <div key={category.name}>
                                <p className="text-xs text-muted-foreground mb-2">{category.name}</p>
                                <div className="grid grid-cols-8 gap-1">
                                  {category.emojis.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleEmojiSelect(emoji)}
                                      className="h-8 w-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Input
                      ref={inputRef}
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 h-12"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="h-12 w-12 rounded-full shrink-0"
                      disabled={!newMessage.trim() || isSending}
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                      <span className="sr-only">Send message</span>
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Select a conversation
                </h3>
                <p className="text-muted-foreground text-sm">
                  Choose a chat from the sidebar to start messaging
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Report & Block Dialog */}
        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Report & Block User
              </DialogTitle>
              <DialogDescription>
                {selectedConversation && `Report ${selectedConversation.user.first_name} for inappropriate behavior`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="report-reason">Reason for reporting (optional)</Label>
                <Textarea
                  id="report-reason"
                  placeholder="Please describe the issue..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="block-only"
                  checked={blockOnly}
                  onCheckedChange={(checked) => setBlockOnly(checked as boolean)}
                />
                <Label htmlFor="block-only" className="text-sm font-normal cursor-pointer">
                  Just block without reporting
                </Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReportDialog(false)
                  setReportReason("")
                  setBlockOnly(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReportAndBlock}
              >
                {blockOnly ? "Block User" : "Report & Block"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Conversation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Delete Conversation
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this conversation with {selectedConversation?.user.first_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> This will only delete the conversation on your end. 
                  {selectedConversation?.user.first_name} can still see the message history 
                  if they have not deleted it on their end.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="bg-transparent"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConversation}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Conversation
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  )
}
