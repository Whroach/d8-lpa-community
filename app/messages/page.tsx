"use client"

import React from "react"

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Send, Loader2, MoreVertical, MessageCircle, Smile, Flag, ShieldAlert, Trash2, AlertTriangle, Pencil, Undo2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
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
    profile_picture_url?: string | null
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
  match_id?: string
  sender_id: string
  content: string
  created_at: string
  read?: boolean
  /** Set once the sender has edited this message; drives the "Edited" marker. */
  edited_at?: string | null
  /** Unsent messages stay in the thread as a tombstone for both participants. */
  is_unsent?: boolean
  unsent_at?: string | null
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
  const [sendError, setSendError] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [blockOnly, setBlockOnly] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUnmatchDialog, setShowUnmatchDialog] = useState(false)
  const [isUnmatching, setIsUnmatching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [skipNextLoad, setSkipNextLoad] = useState(false)
  // Inline edit / unsend state for the user's own messages.
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [unsendTarget, setUnsendTarget] = useState<Message | null>(null)
  const [isUnsending, setIsUnsending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldScrollRef = useRef(true)
  // Mirrors selectedConversation so the socket handler always reads the
  // currently open thread without re-subscribing on every selection change.
  const selectedConversationRef = useRef<Conversation | null>(null)

  useEffect(() => {
    selectedConversationRef.current = selectedConversation
  }, [selectedConversation])

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

      // Only append to the open thread when the message actually belongs to it.
      // Without this check, a message arriving from any other conversation was
      // rendered inside whichever chat happened to be on screen.
      const openMatchId = selectedConversationRef.current?.match_id
      const isForOpenThread = !message.match_id || message.match_id === openMatchId

      if (isForOpenThread && openMatchId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id || m._id === message._id)) {
            return prev
          }
          return [...prev, message]
        })
      }

      // Update only the conversation the message belongs to, and bump its
      // unread badge if the user is not currently looking at it. Previously
      // every conversation in the list had its preview overwritten.
      setConversations((prev) =>
        prev.map((c) => {
          const belongsHere = message.match_id
            ? c.match_id === message.match_id
            : c.match_id === openMatchId
          if (!belongsHere) return c
          return {
            ...c,
            last_message: message.content,
            last_message_at: message.created_at,
            unread_count:
              c.match_id === openMatchId ? 0 : (c.unread_count || 0) + 1,
          }
        })
      )
    }

    // An edit or unsend by the other participant replaces the message in place
    // rather than appending anything, so the thread doesn't jump.
    const handleMessageUpdated = (updated: Message) => {
      const updatedId = updated.id || updated._id
      if (!updatedId) return

      setMessages((prev) =>
        prev.map((m) =>
          (m.id || m._id) === updatedId ? { ...m, ...updated } : m
        )
      )

      // Keep the conversation-list preview honest when the last message in a
      // thread is the one that changed.
      setConversations((prev) =>
        prev.map((c) => {
          if (updated.match_id && c.match_id !== updated.match_id) return c
          return {
            ...c,
            last_message: updated.is_unsent ? "Message unsent" : updated.content,
          }
        })
      )
    }

    socket.on('new-message', handleNewMessage)
    socket.on('message-updated', handleMessageUpdated)

    // Cleanup on unmount
    return () => {
      socket.off('new-message', handleNewMessage)
      socket.off('message-updated', handleMessageUpdated)
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
      // Fetching a thread marks it read server-side, so tell the nav badges to
      // re-read the true unread count instead of holding a stale number.
      window.dispatchEvent(new Event("messagesViewed"))
    }
    setIsLoadingMessages(false)
  }

  const handleStartEdit = (message: Message) => {
    const id = message.id || message._id
    if (!id) return
    setEditingMessageId(id)
    setEditDraft(message.content)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditDraft("")
  }

  const handleSaveEdit = async (message: Message) => {
    const id = message.id || message._id
    if (!id || !selectedConversation) return

    const trimmed = editDraft.trim()
    if (!trimmed) return
    if (trimmed === message.content) {
      handleCancelEdit()
      return
    }

    setIsSavingEdit(true)
    const result = await api.messages.edit(
      selectedConversation.match_id,
      id,
      trimmed
    )
    setIsSavingEdit(false)

    if (result.error) {
      setSendError(result.error)
      return
    }

    setMessages((prev) =>
      prev.map((m) => ((m.id || m._id) === id ? { ...m, ...result.data } : m))
    )
    setConversations((prev) =>
      prev.map((c) =>
        c.match_id === selectedConversation.match_id
          ? { ...c, last_message: trimmed }
          : c
      )
    )
    handleCancelEdit()
  }

  const handleUnsend = async () => {
    const message = unsendTarget
    const id = message?.id || message?._id
    if (!message || !id || !selectedConversation) return

    setIsUnsending(true)
    const result = await api.messages.unsend(selectedConversation.match_id, id)
    setIsUnsending(false)

    if (result.error) {
      setSendError(result.error)
      setUnsendTarget(null)
      return
    }

    setMessages((prev) =>
      prev.map((m) => ((m.id || m._id) === id ? { ...m, ...result.data } : m))
    )
    setConversations((prev) =>
      prev.map((c) =>
        c.match_id === selectedConversation.match_id
          ? { ...c, last_message: "Message unsent" }
          : c
      )
    )
    setUnsendTarget(null)
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "instant" })
    }
  }

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    // replace, not push — otherwise every conversation the user clicks adds a
    // history entry and Back walks them through all of them.
    router.replace(`/messages?match=${conv.match_id}`, { scroll: false })
    // Mark as read (optimistic)
    setConversations(prev => 
      prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
    )
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending || !selectedConversation) return

    const sentContent = newMessage
    setSendError(null)

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
    } else {
      // Roll the optimistic bubble back and restore the text so the user does
      // not think a failed message was delivered.
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id))
      setNewMessage(sentContent)
      setSendError(result.error || "Your message could not be sent. Please try again.")
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
    
    // Call API to soft delete conversation
    const result = await api.messages.deleteConversation(selectedConversation.id)
    
    if (result.error) {
      console.error('Delete failed:', result.error)
      setIsDeleting(false)
      return
    }
    
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
    
    setShowDeleteDialog(false)
    setIsDeleting(false)
  }

  const handleViewProfile = () => {
    if (selectedConversation) {
      router.push(`/profile/${selectedConversation.user.id}`)
    }
  }

  const handleUnmatch = async () => {
    if (!selectedConversation) return

    setIsUnmatching(true)
    {
      const result = await api.matches.unmatch(selectedConversation.match_id)
      if (result.data) {
        // Mark conversation as inactive instead of deleting
        setConversations(prev => 
          prev.map(c => c.id === selectedConversation.id 
            ? { ...c, is_active: false } 
            : c
          )
        )
        setFilteredConversations(prev => 
          prev.map(c => c.id === selectedConversation.id 
            ? { ...c, is_active: false } 
            : c
          )
        )
        
        // Update selected conversation
        if (selectedConversation) {
          setSelectedConversation({ ...selectedConversation, is_active: false })
        }
      }
    }
    setIsUnmatching(false)
    setShowUnmatchDialog(false)
  }

  const handleReportAndBlock = async () => {
    if (!selectedConversation) return
    
    // Honour the "just block" checkbox — it previously had no effect and a
    // report was filed anyway whenever a reason had been typed.
    if (!blockOnly && reportReason.trim()) {
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
    setBlockOnly(false)
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
                    {selectedConversation?.is_active !== false && (
                      <DropdownMenuItem onClick={() => setShowUnmatchDialog(true)}>
                        Unmatch
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Conversation
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
                {messages.length === 0 && !isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
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
                        {group.messages.map((message, index) => {
                          const isOwn = message.sender_id === user?.id || message.sender_id === user?._id
                          const messageId = message.id || message._id
                          const messageKey = messageId || `${message.sender_id}-${message.created_at}`
                          const nextMessage = group.messages[index + 1]
                          // Only the last bubble in a run from the other person
                          // carries their picture, so a burst of messages does
                          // not repeat the same face on every line.
                          const showAvatar =
                            !isOwn &&
                            (!nextMessage || nextMessage.sender_id !== message.sender_id)
                          const isEditing = !!messageId && editingMessageId === messageId
                          const canModify =
                            isOwn &&
                            !message.is_unsent &&
                            !!messageId &&
                            !messageId.startsWith("temp-") &&
                            selectedConversation?.is_active !== false

                          return (
                            <div
                              key={messageKey}
                              className={cn(
                                "flex items-end gap-2 group",
                                isOwn ? "justify-end" : "justify-start"
                              )}
                            >
                              {!isOwn && (
                                showAvatar ? (
                                  <Avatar className="h-8 w-8 shrink-0 mb-0.5">
                                    <AvatarImage
                                      src={
                                        selectedConversation?.user.profile_picture_url ||
                                        selectedConversation?.user.photos?.[0] ||
                                        undefined
                                      }
                                      alt={selectedConversation?.user.first_name}
                                    />
                                    <AvatarFallback className="text-xs">
                                      {selectedConversation?.user.first_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  // Keeps stacked bubbles aligned with the one
                                  // that does show a picture.
                                  <div className="h-8 w-8 shrink-0" aria-hidden="true" />
                                )
                              )}

                              {canModify && !isEditing && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0 opacity-60 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                      <span className="sr-only">Message options</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setUnsendTarget(message)}
                                    >
                                      <Undo2 className="h-4 w-4 mr-2" />
                                      Unsend
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}

                              {isEditing ? (
                                <div className="max-w-[75%] w-full sm:w-96 rounded-2xl border border-primary/40 bg-card p-3 space-y-2">
                                  <Textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSaveEdit(message)
                                      }
                                      if (e.key === "Escape") handleCancelEdit()
                                    }}
                                    rows={2}
                                    maxLength={2000}
                                    autoFocus
                                    className="resize-none text-base"
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleCancelEdit}
                                      disabled={isSavingEdit}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleSaveEdit(message)}
                                      disabled={isSavingEdit || !editDraft.trim()}
                                    >
                                      {isSavingEdit ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        "Save"
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "max-w-[75%] px-4 py-2.5 rounded-2xl",
                                    message.is_unsent
                                      ? "bg-muted/60 border border-dashed border-border text-muted-foreground"
                                      : isOwn
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : "bg-muted text-foreground rounded-bl-md"
                                  )}
                                >
                                  {message.is_unsent ? (
                                    <p className="text-base italic leading-relaxed">
                                      {isOwn
                                        ? "You unsent a message"
                                        : `${selectedConversation?.user.first_name} unsent a message`}
                                    </p>
                                  ) : (
                                    <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
                                      {message.content}
                                    </p>
                                  )}
                                  <p
                                    className={cn(
                                      "text-[11px] mt-1 flex items-center gap-1.5",
                                      message.is_unsent
                                        ? "text-muted-foreground"
                                        : isOwn
                                          ? "text-primary-foreground/70"
                                          : "text-muted-foreground"
                                    )}
                                  >
                                    {formatMessageTime(message.created_at)}
                                    {message.edited_at && !message.is_unsent && (
                                      <span className="italic">Edited</span>
                                    )}
                                  </p>
                                </div>
                              )}
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
                  {sendError && (
                    <div className="mb-2 flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {sendError}
                    </div>
                  )}
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

        {/* Unmatch Dialog */}
        <Dialog open={showUnmatchDialog} onOpenChange={setShowUnmatchDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Unmatch with {selectedConversation?.user.first_name}?
              </DialogTitle>
              <DialogDescription>
                You will still be able to read your past messages, but neither of
                you will be able to send new ones.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setShowUnmatchDialog(false)}
                disabled={isUnmatching}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnmatch}
                disabled={isUnmatching}
              >
                {isUnmatching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Unmatching...
                  </>
                ) : (
                  "Unmatch"
                )}
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

        {/* Unsend Message Confirmation */}
        <Dialog
          open={!!unsendTarget}
          onOpenChange={(open) => !open && setUnsendTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-amber-500" />
                Unsend Message
              </DialogTitle>
              <DialogDescription>
                This removes the message text for both of you.{" "}
                {selectedConversation?.user.first_name} will still see that you
                unsent something.
              </DialogDescription>
            </DialogHeader>
            {unsendTarget && (
              <div className="py-2">
                <div className="rounded-lg border border-border bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap break-words">
                    {unsendTarget.content}
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setUnsendTarget(null)}
                disabled={isUnsending}
                className="bg-transparent"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnsend}
                disabled={isUnsending}
              >
                {isUnsending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Unsending...
                  </>
                ) : (
                  <>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Unsend
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
    </AppLayout>
  )
}
