"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Search,
  Send,
  Loader2,
  MessageCircle,
  Smile,
  Flag,
  Ban,
  Trash2,
  AlertTriangle,
  Pencil,
  Undo2,
  ChevronLeft,
  ChevronDown,
  UserRound,
  HeartOff,
  ShieldAlert,
  RotateCcw,
  Lightbulb,
} from "lucide-react"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadError } from "@/components/load-error"
import { BlockDialog, ReportDialog } from "@/components/safety/safety-dialogs"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAuthStore } from "@/lib/store/auth-store"
import { getSocket } from "@/lib/socket"
import { safetyNoteFor } from "@/lib/safety"
import { conversationStarters } from "@/lib/icebreakers"

interface Conversation {
  id: string
  match_id: string
  user: {
    id: string
    first_name: string
    last_name?: string
    photos?: string[]
    profile_picture_url?: string | null
    interests?: string[]
    is_online?: boolean
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
  /** Only on this device: a message still on its way, or one that did not go. */
  localStatus?: "sending" | "failed"
  localError?: string
}

const MAX_LENGTH = 2000
const draftKey = (matchId: string) => `d8lpa-draft-${matchId}`

const readDraft = (matchId: string) => {
  try {
    return localStorage.getItem(draftKey(matchId)) || ""
  } catch {
    return ""
  }
}
const writeDraft = (matchId: string, text: string) => {
  try {
    if (text) localStorage.setItem(draftKey(matchId), text)
    else localStorage.removeItem(draftKey(matchId))
  } catch {
    /* private browsing */
  }
}

const EMOJI = [
  { name: "Smiles", emojis: ["😀", "😄", "😁", "😂", "😊", "🙂", "😉", "😍", "🥰", "😘", "😋", "🤗", "🤔", "😅", "😢", "😴"] },
  { name: "Hands and hearts", emojis: ["👍", "👋", "👏", "🙌", "🙏", "🤝", "💪", "❤️", "🧡", "💛", "💚", "💙", "💜", "💕", "💐", "🌹"] },
  { name: "Fun", emojis: ["🎉", "🎂", "🎁", "☕", "🍕", "🍰", "🌞", "🌈", "⭐", "🎵", "🐶", "🐱", "🌻", "🚗", "📷", "🎣"] },
]

const avatarFor = (user: Conversation["user"]) => user.profile_picture_url || user.photos?.[0] || undefined

function formatListTime(timestamp: string | null) {
  if (!timestamp) return ""
  const date = new Date(timestamp)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

const formatMessageTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

function formatDateDivider(timestamp: string) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
}

function MessagesScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const myProfile = useAuthStore((state) => state.profile)
  const myId = user?.id || user?._id || ""

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadError, setLoadError] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesError, setMessagesError] = useState("")
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [newMessage, setNewMessage] = useState("")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [otherIsTyping, setOtherIsTyping] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUnmatchDialog, setShowUnmatchDialog] = useState(false)
  const [busyAction, setBusyAction] = useState(false)

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [unsendTarget, setUnsendTarget] = useState<Message | null>(null)
  const [isUnsending, setIsUnsending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const selectedIdRef = useRef<string | null>(null)
  const initialSelectionDone = useRef(false)
  const typingSentAt = useRef(0)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.match_id === selectedId) || null,
    [conversations, selectedId]
  )
  const other = selectedConversation?.user

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  // ---- loading -------------------------------------------------------------
  const loadMessages = useCallback(async (matchId: string, { quiet = false } = {}) => {
    if (!quiet) setIsLoadingMessages(true)
    setMessagesError("")
    const result = await api.messages.getMessages(matchId)
    if (selectedIdRef.current !== matchId) return
    if (result.data) {
      // Keep anything still sending or failed on this device.
      setMessages((prev) => [...result.data!, ...prev.filter((m) => m.localStatus && m.match_id === matchId)])
      // Fetching a thread marks it read server-side, so tell the nav badges to
      // re-read the true unread count instead of holding a stale number.
      window.dispatchEvent(new Event("messagesViewed"))
    } else if (!quiet) {
      setMessagesError(result.error || "")
    }
    setIsLoadingMessages(false)
  }, [])

  const selectConversation = useCallback(
    (matchId: string | null, { updateUrl = true } = {}) => {
      setSelectedId(matchId)
      selectedIdRef.current = matchId
      setOtherIsTyping(false)
      setEditingMessageId(null)
      setMessages([])
      if (matchId) {
        setNewMessage(readDraft(matchId))
        setConversations((prev) => prev.map((c) => (c.match_id === matchId ? { ...c, unread_count: 0 } : c)))
        void loadMessages(matchId)
        // replace, not push — otherwise every conversation the user opens adds
        // a history entry and Back walks them through all of them.
        if (updateUrl) router.replace(`/messages?match=${matchId}`, { scroll: false })
      } else {
        setNewMessage("")
        if (updateUrl) router.replace("/messages", { scroll: false })
      }
    },
    [loadMessages, router]
  )

  const loadConversations = useCallback(async () => {
    setLoadError("")
    const result = await api.messages.getConversations()
    if (result.error || !result.data) {
      setLoadError(result.error || "Please try again.")
      setIsLoadingConversations(false)
      return
    }
    setConversations(result.data)
    setIsLoadingConversations(false)

    // Choose what to open, once. (This used to run every time the list
    // changed, which re-opened a chat the member had just left.)
    if (!initialSelectionDone.current) {
      initialSelectionDone.current = true
      const wanted = searchParams.get("match")
      const fromUrl = wanted && result.data.find((c: Conversation) => c.match_id === wanted)
      const isWide = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
      if (fromUrl) selectConversation(fromUrl.match_id, { updateUrl: false })
      else if (isWide && result.data.length > 0) selectConversation(result.data[0].match_id, { updateUrl: false })
    }
  }, [searchParams, selectConversation])

  useEffect(() => {
    void loadConversations()
    // Once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- realtime ------------------------------------------------------------
  useEffect(() => {
    if (!myId) return
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const handleNewMessage = (message: Message) => {
      // Our own messages are already on screen.
      if (message.sender_id === myId) return
      const openMatchId = selectedIdRef.current
      const isForOpenThread = !!openMatchId && message.match_id === openMatchId

      if (isForOpenThread) {
        setOtherIsTyping(false)
        setMessages((prev) =>
          prev.some((m) => (m.id || m._id) === (message.id || message._id)) ? prev : [...prev, message]
        )
        setAnnouncement(`New message: ${message.content}`)
        // We are looking at it, so it is read: let the server (and the
        // sender) know, and keep the badge honest.
        void api.messages.getMessages(openMatchId).then(() => window.dispatchEvent(new Event("messagesViewed")))
      }

      setConversations((prev) => {
        if (!prev.some((c) => c.match_id === message.match_id)) {
          // A brand-new match wrote to us: fetch the list again.
          void loadConversations()
          return prev
        }
        return prev.map((c) =>
          c.match_id === message.match_id
            ? {
                ...c,
                last_message: message.content,
                last_message_at: message.created_at,
                has_messages: true,
                unread_count: isForOpenThread ? 0 : (c.unread_count || 0) + 1,
              }
            : c
        )
      })
    }

    // An edit or unsend by the other participant replaces the message in place.
    const handleMessageUpdated = (updated: Message) => {
      const updatedId = updated.id || updated._id
      if (!updatedId) return
      setMessages((prev) => prev.map((m) => ((m.id || m._id) === updatedId ? { ...m, ...updated, read: m.read } : m)))
      setConversations((prev) =>
        prev.map((c) => {
          if (c.match_id !== updated.match_id) return c
          const isLatest = !c.last_message_at || new Date(updated.created_at) >= new Date(c.last_message_at)
          return isLatest ? { ...c, last_message: updated.is_unsent ? "Message unsent" : updated.content } : c
        })
      )
    }

    const handleTyping = (payload: { match_id: string; user_id: string; typing?: boolean }) => {
      if (payload.match_id !== selectedIdRef.current || payload.user_id === myId) return
      setOtherIsTyping(payload.typing !== false)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setOtherIsTyping(false), 4000)
    }

    const handleRead = (payload: { match_id: string }) => {
      if (payload.match_id !== selectedIdRef.current) return
      setMessages((prev) => prev.map((m) => (m.sender_id === myId ? { ...m, read: true } : m)))
    }

    const handleClosed = (payload: { match_id: string }) => {
      setConversations((prev) => prev.filter((c) => c.match_id !== payload.match_id))
      if (selectedIdRef.current === payload.match_id) {
        setSelectedId(null)
        selectedIdRef.current = null
        setMessages([])
        toast.info("This conversation is no longer available.")
      }
    }

    // After a dropped connection: rejoin the open chat and fetch what we missed.
    const handleConnect = () => {
      const openMatchId = selectedIdRef.current
      if (openMatchId) {
        socket.emit("join-conversation", openMatchId)
        void loadMessages(openMatchId, { quiet: true })
      }
    }

    socket.on("new-message", handleNewMessage)
    socket.on("message-updated", handleMessageUpdated)
    socket.on("typing", handleTyping)
    socket.on("messages-read", handleRead)
    socket.on("conversation-closed", handleClosed)
    socket.on("connect", handleConnect)

    return () => {
      socket.off("new-message", handleNewMessage)
      socket.off("message-updated", handleMessageUpdated)
      socket.off("typing", handleTyping)
      socket.off("messages-read", handleRead)
      socket.off("conversation-closed", handleClosed)
      socket.off("connect", handleConnect)
    }
  }, [myId, loadConversations, loadMessages])

  // Join/leave the conversation room when the open chat changes
  useEffect(() => {
    if (!selectedId) return
    const socket = getSocket()
    socket.emit("join-conversation", selectedId)
    return () => {
      socket.emit("leave-conversation", selectedId)
    }
  }, [selectedId])

  // Keep the newest message in view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "end" })
  }, [messages, otherIsTyping])

  // ---- composing -----------------------------------------------------------
  const handleDraftChange = (text: string) => {
    const next = text.slice(0, MAX_LENGTH)
    setNewMessage(next)
    if (!selectedId) return
    writeDraft(selectedId, next)
    // Tell the other person we are typing, at most every two seconds.
    const now = Date.now()
    if (next && now - typingSentAt.current > 2000) {
      typingSentAt.current = now
      getSocket().emit("typing", { match_id: selectedId })
    }
  }

  const deliver = async (matchId: string, tempId: string, content: string) => {
    const result = await api.messages.send(matchId, content)
    if (result.data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? result.data : m)))
      setConversations((prev) =>
        prev.map((c) =>
          c.match_id === matchId
            ? { ...c, last_message: content, last_message_at: new Date().toISOString(), has_messages: true }
            : c
        )
      )
    } else {
      // Keep the message in the thread, clearly marked, with a way to try
      // again - rather than silently putting the text back in the box.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, localStatus: "failed", localError: result.error || "Your message could not be sent." }
            : m
        )
      )
      setAnnouncement("Your message was not sent.")
    }
  }

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    const content = newMessage.trim()
    if (!content || !selectedConversation || selectedConversation.is_active === false) return

    const matchId = selectedConversation.match_id
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setMessages((prev) => [
      ...prev,
      { id: tempId, match_id: matchId, sender_id: myId, content, created_at: new Date().toISOString(), localStatus: "sending" },
    ])
    setNewMessage("")
    writeDraft(matchId, "")
    inputRef.current?.focus()
    void deliver(matchId, tempId, content)
  }

  const retrySend = (message: Message) => {
    if (!message.id || !message.match_id) return
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, localStatus: "sending", localError: undefined } : m)))
    void deliver(message.match_id, message.id, message.content)
  }

  const discardFailed = (message: Message) => {
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
  }

  // ---- edit / unsend -------------------------------------------------------
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
    const result = await api.messages.edit(selectedConversation.match_id, id, trimmed)
    setIsSavingEdit(false)
    if (result.error) {
      toast.error(`Your change was not saved. ${result.error}`)
      return
    }
    setMessages((prev) => prev.map((m) => ((m.id || m._id) === id ? { ...m, ...result.data, read: m.read } : m)))
    setConversations((prev) =>
      prev.map((c) => (c.match_id === selectedConversation.match_id && c.last_message === message.content ? { ...c, last_message: trimmed } : c))
    )
    handleCancelEdit()
    toast.success("Message changed")
  }

  const handleUnsend = async () => {
    const message = unsendTarget
    const id = message?.id || message?._id
    if (!message || !id || !selectedConversation) return
    setIsUnsending(true)
    const result = await api.messages.unsend(selectedConversation.match_id, id)
    setIsUnsending(false)
    setUnsendTarget(null)
    if (result.error) {
      toast.error(`That message could not be unsent. ${result.error}`)
      return
    }
    setMessages((prev) => prev.map((m) => ((m.id || m._id) === id ? { ...m, ...result.data } : m)))
    setConversations((prev) =>
      prev.map((c) => (c.match_id === selectedConversation.match_id && c.last_message === message.content ? { ...c, last_message: "Message unsent" } : c))
    )
    toast.success("Message unsent")
  }

  // ---- conversation actions ------------------------------------------------
  const removeConversationLocally = (matchId: string) => {
    setConversations((prev) => prev.filter((c) => c.match_id !== matchId))
    if (selectedIdRef.current === matchId) selectConversation(null)
  }

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return
    setBusyAction(true)
    const result = await api.messages.deleteConversation(selectedConversation.match_id)
    setBusyAction(false)
    if (result.error) {
      toast.error(`We could not clear this conversation. ${result.error}`)
      return
    }
    setShowDeleteDialog(false)
    setMessages([])
    setConversations((prev) =>
      prev.map((c) => (c.match_id === selectedConversation.match_id ? { ...c, last_message: null, has_messages: false } : c))
    )
    toast.success("Conversation cleared on your side")
  }

  const handleUnmatch = async () => {
    if (!selectedConversation) return
    setBusyAction(true)
    const result = await api.matches.unmatch(selectedConversation.match_id)
    setBusyAction(false)
    if (result.error) {
      toast.error(`We could not unmatch. ${result.error}`)
      return
    }
    setShowUnmatchDialog(false)
    setConversations((prev) => prev.map((c) => (c.match_id === selectedConversation.match_id ? { ...c, is_active: false } : c)))
    toast.success(`You are no longer matched with ${selectedConversation.user.first_name}`, {
      description: "You can still read your earlier messages.",
    })
  }

  // ---- derived -------------------------------------------------------------
  const filteredConversations = useMemo(
    () => conversations.filter((conv) => conv.user.first_name.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    [conversations, searchQuery]
  )

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = []
    for (const msg of messages) {
      const dateStr = new Date(msg.created_at).toDateString()
      const last = groups[groups.length - 1]
      if (last && last.date === dateStr) last.messages.push(msg)
      else groups.push({ date: dateStr, messages: [msg] })
    }
    return groups
  }, [messages])

  // "Seen" / "Sent" goes under my most recent delivered message only.
  const lastOwnDeliveredId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]
      if (m.sender_id === myId && !m.localStatus && !m.is_unsent) return m.id || m._id
    }
    return null
  }, [messages, myId])

  const starters = useMemo(
    () => (other ? conversationStarters(myProfile?.interests, other.interests, other.first_name) : []),
    [myProfile?.interests, other]
  )

  const isActive = selectedConversation?.is_active !== false
  const remaining = MAX_LENGTH - newMessage.length

  return (
    <AppLayout>
      <h1 className="sr-only">Messages</h1>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="flex h-[calc(100dvh-5.5rem)] md:h-screen">
        {/* Conversation list */}
        <section
          aria-label="Your conversations"
          className={cn(
            "w-full flex-col border-r border-border bg-card md:w-80 lg:w-96",
            selectedConversation ? "hidden md:flex" : "flex"
          )}
        >
          <div className="border-b border-border p-4">
            <h2 className="mb-3 text-2xl font-bold text-foreground">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Label htmlFor="conversation-search" className="sr-only">
                Find a conversation by name
              </Label>
              <Input
                id="conversation-search"
                placeholder="Find by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="space-y-4 p-4" role="status" aria-label="Loading your conversations">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="mb-2 h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="p-4">
                <LoadError
                  what="your messages"
                  detail={loadError}
                  onRetry={() => {
                    setIsLoadingConversations(true)
                    void loadConversations()
                  }}
                />
              </div>
            ) : filteredConversations.length > 0 ? (
              <ul className="divide-y divide-border">
                {filteredConversations.map((conv) => {
                  const isSelected = selectedId === conv.match_id
                  return (
                    <li key={conv.match_id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(conv.match_id)}
                        aria-current={isSelected ? "true" : undefined}
                        data-testid="conversation-item"
                        className={cn(
                          "flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted",
                          isSelected && "bg-muted",
                          conv.unread_count > 0 && !isSelected && "bg-primary/5"
                        )}
                      >
                        <span className="relative shrink-0">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={avatarFor(conv.user)} alt="" />
                            <AvatarFallback className="bg-primary/10 text-lg text-primary">
                              {conv.user.first_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          {conv.user.is_online && (
                            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-success">
                              <span className="sr-only">Online now</span>
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn("truncate text-lg text-foreground", conv.unread_count > 0 ? "font-bold" : "font-medium")}>
                              {conv.user.first_name}
                            </span>
                            <span className="shrink-0 text-sm text-muted-foreground">{formatListTime(conv.last_message_at)}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "flex-1 truncate text-base",
                                conv.unread_count > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {conv.is_active === false
                                ? "No longer matched"
                                : conv.last_message || "Say hello"}
                            </span>
                            {conv.unread_count > 0 && (
                              <span
                                data-testid="unread-badge"
                                className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-sm font-bold text-primary-foreground"
                              >
                                <span aria-hidden="true">{conv.unread_count}</span>
                                <span className="sr-only">{conv.unread_count} unread</span>
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : searchQuery ? (
              <div className="px-4 py-12 text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="text-lg text-muted-foreground">Nobody called &quot;{searchQuery}&quot; in your conversations.</p>
                <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>
                  Show everyone
                </Button>
              </div>
            ) : (
              <div className="space-y-3 px-4 py-12 text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="text-xl font-semibold">No conversations yet</p>
                <p className="text-lg text-muted-foreground">
                  When you and another member like each other, you can write to them here.
                </p>
                <Button asChild size="lg">
                  <Link href="/browse">Browse members</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Open conversation */}
        <section
          aria-label={other ? `Conversation with ${other.first_name}` : "Conversation"}
          className={cn("min-w-0 flex-1 flex-col bg-background", !selectedConversation ? "hidden md:flex" : "flex")}
        >
          {selectedConversation && other ? (
            <>
              <header className="flex items-center gap-2 border-b border-border bg-card p-3 md:gap-3 md:p-4">
                <Button variant="ghost" onClick={() => selectConversation(null)} className="px-2 md:hidden">
                  <ChevronLeft aria-hidden="true" />
                  Back
                </Button>

                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={avatarFor(other)} alt="" />
                  <AvatarFallback className="bg-primary/10 text-primary">{other.first_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-semibold text-foreground">{other.first_name}</h2>
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {otherIsTyping ? (
                      <span data-testid="typing-indicator" className="font-medium text-primary">
                        typing…
                      </span>
                    ) : other.is_online ? (
                      "Online now"
                    ) : (
                      " "
                    )}
                  </p>
                </div>

                <Button asChild variant="outline" className="hidden sm:inline-flex">
                  <Link href={`/profile/${other.id}`}>
                    <UserRound aria-hidden="true" />
                    View profile
                  </Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" data-testid="chat-options">
                      Options
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem asChild className="min-h-11 text-base sm:hidden">
                      <Link href={`/profile/${other.id}`}>
                        <UserRound className="mr-2 h-5 w-5" aria-hidden="true" />
                        View profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11 text-base" onClick={() => setShowReportDialog(true)}>
                      <Flag className="mr-2 h-5 w-5" aria-hidden="true" />
                      Report {other.first_name}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="min-h-11 text-base" onClick={() => setShowBlockDialog(true)}>
                      <Ban className="mr-2 h-5 w-5" aria-hidden="true" />
                      Block {other.first_name}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isActive && (
                      <DropdownMenuItem className="min-h-11 text-base" onClick={() => setShowUnmatchDialog(true)}>
                        <HeartOff className="mr-2 h-5 w-5" aria-hidden="true" />
                        Unmatch
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="min-h-11 text-base" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="mr-2 h-5 w-5" aria-hidden="true" />
                      Clear conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </header>

              {/* overflow-x-hidden: a long unbroken word must not widen the thread. */}
              <div
                className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-4"
                role="log"
                aria-label={`Messages with ${other.first_name}`}
                data-testid="message-thread"
              >
                {messagesError ? (
                  <LoadError what="this conversation" detail={messagesError} onRetry={() => loadMessages(selectedConversation.match_id)} />
                ) : isLoadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-12" role="status">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                    <span className="sr-only">Loading messages</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mx-auto max-w-md space-y-4 py-8 text-center">
                    <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
                    <p className="text-xl font-semibold">Say hello to {other.first_name}</p>
                    {isActive && starters.length > 0 && (
                      <div className="space-y-2 text-left" data-testid="conversation-starters">
                        <p className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                          <Lightbulb className="h-5 w-5" aria-hidden="true" />
                          Not sure what to write? Choose one to start with - you can change it before sending.
                        </p>
                        {starters.map((starter) => (
                          <Button
                            key={starter}
                            type="button"
                            variant="outline"
                            className="h-auto w-full justify-start whitespace-normal py-3 text-left text-base font-normal"
                            onClick={() => {
                              handleDraftChange(starter)
                              inputRef.current?.focus()
                            }}
                          >
                            {starter}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      <div className="mb-4 flex justify-center">
                        <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                          {formatDateDivider(group.messages[0].created_at)}
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {group.messages.map((message, index) => {
                          const isOwn = message.sender_id === myId
                          const messageId = message.id || message._id
                          const messageKey = messageId || `${message.sender_id}-${message.created_at}`
                          const nextMessage = group.messages[index + 1]
                          // Only the last bubble in a run from the other person
                          // carries their picture.
                          const showAvatar = !isOwn && (!nextMessage || nextMessage.sender_id !== message.sender_id)
                          const isEditing = !!messageId && editingMessageId === messageId
                          const canModify = isOwn && !message.is_unsent && !!messageId && !message.localStatus && isActive
                          const safety = !isOwn && !message.is_unsent ? safetyNoteFor(message.content) : null

                          return (
                            <li
                              key={messageKey}
                              data-testid={isOwn ? "message-own" : "message-other"}
                              className={cn("flex items-end gap-2", isOwn ? "justify-end" : "justify-start")}
                            >
                              {!isOwn &&
                                (showAvatar ? (
                                  <Avatar className="mb-0.5 h-9 w-9 shrink-0">
                                    <AvatarImage src={avatarFor(other)} alt="" />
                                    <AvatarFallback className="text-sm">{other.first_name?.[0]}</AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="h-9 w-9 shrink-0" aria-hidden="true" />
                                ))}

                              <div className={cn("flex min-w-0 max-w-[calc(100%-3rem)] flex-col sm:max-w-[75%]", isOwn ? "items-end" : "items-start")}>
                                {isEditing ? (
                                  <div className="w-full space-y-2 rounded-2xl border-2 border-primary bg-card p-3">
                                    <Label htmlFor={`edit-${messageId}`} className="text-base">
                                      Change your message
                                    </Label>
                                    <Textarea
                                      id={`edit-${messageId}`}
                                      value={editDraft}
                                      onChange={(e) => setEditDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault()
                                          void handleSaveEdit(message)
                                        }
                                        if (e.key === "Escape") handleCancelEdit()
                                      }}
                                      rows={2}
                                      maxLength={MAX_LENGTH}
                                      autoFocus
                                      className="resize-none text-base"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSavingEdit}>
                                        Cancel
                                      </Button>
                                      <Button type="button" onClick={() => handleSaveEdit(message)} disabled={isSavingEdit || !editDraft.trim()}>
                                        {isSavingEdit && <Loader2 className="animate-spin" aria-hidden="true" />}
                                        Save changes
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      "rounded-2xl px-4 py-2.5",
                                      message.is_unsent
                                        ? "border border-dashed border-input bg-muted/60 text-muted-foreground"
                                        : message.localStatus === "failed"
                                          ? "border-2 border-destructive bg-card text-foreground"
                                          : isOwn
                                            ? "rounded-br-md bg-primary text-primary-foreground"
                                            : "rounded-bl-md bg-muted text-foreground"
                                    )}
                                  >
                                    <span className="sr-only">{isOwn ? "You said: " : `${other.first_name} said: `}</span>
                                    {message.is_unsent ? (
                                      <p className="text-lg italic leading-relaxed">
                                        {isOwn ? "You unsent a message" : `${other.first_name} unsent a message`}
                                      </p>
                                    ) : (
                                      <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{message.content}</p>
                                    )}
                                    <p
                                      className={cn(
                                        "mt-1 flex items-center gap-1.5 text-sm",
                                        message.is_unsent || message.localStatus === "failed"
                                          ? "text-muted-foreground"
                                          : isOwn
                                            ? "text-primary-foreground/90"
                                            : "text-muted-foreground"
                                      )}
                                    >
                                      {formatMessageTime(message.created_at)}
                                      {message.edited_at && !message.is_unsent && <span className="italic">· Edited</span>}
                                    </p>
                                  </div>
                                )}

                                {message.localStatus === "sending" && (
                                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    Sending…
                                  </p>
                                )}

                                {message.localStatus === "failed" && (
                                  <div role="alert" className="mt-1 space-y-1 text-right" data-testid="message-failed">
                                    <p className="flex items-center justify-end gap-1 text-base font-medium text-destructive">
                                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                      Not sent. {message.localError}
                                    </p>
                                    <div className="flex justify-end gap-2">
                                      <Button type="button" size="sm" onClick={() => retrySend(message)}>
                                        <RotateCcw aria-hidden="true" />
                                        Try again
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" onClick={() => discardFailed(message)}>
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {isOwn && messageId === lastOwnDeliveredId && !isEditing && (
                                  <p className="mt-1 text-sm text-muted-foreground" data-testid="message-status">
                                    {message.read ? "Seen" : "Sent"}
                                  </p>
                                )}

                                {/* Always on screen and spelled out — these must
                                    not depend on hovering to be discovered. */}
                                {canModify && !isEditing && (
                                  <div className="mt-1 flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleStartEdit(message)}>
                                      <Pencil aria-hidden="true" />
                                      Edit
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setUnsendTarget(message)}>
                                      <Undo2 aria-hidden="true" />
                                      Unsend
                                    </Button>
                                  </div>
                                )}

                                {safety && (
                                  <div
                                    role="note"
                                    data-testid="safety-note"
                                    className="mt-2 max-w-md space-y-2 rounded-xl border border-warning-foreground/30 bg-warning-surface p-3 text-warning-foreground"
                                  >
                                    <p className="flex items-start gap-2 text-base font-medium">
                                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                                      <span>
                                        <span className="font-bold">A gentle reminder, only you can see this. </span>
                                        {safety.note}
                                      </span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button asChild size="sm" variant="outline">
                                        <Link href="/safety">Safety advice</Link>
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" onClick={() => setShowReportDialog(true)}>
                                        Report {other.first_name}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {!isActive ? (
                <div className="border-t border-border bg-muted p-4">
                  <p className="flex items-center justify-center gap-2 text-center text-base text-foreground">
                    <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                    You are no longer matched. You can read your earlier messages but cannot send new ones.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSend} className="border-t border-border bg-card p-3 md:p-4">
                  <div className="flex items-end gap-2">
                    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-12 shrink-0 px-3">
                          <Smile aria-hidden="true" />
                          <span className="hidden sm:inline">Emoji</span>
                          <span className="sr-only sm:hidden">Add an emoji</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="start" className="w-80 p-3">
                        <div className="max-h-72 space-y-3 overflow-y-auto">
                          {EMOJI.map((category) => (
                            <div key={category.name}>
                              <p className="mb-1 text-sm font-medium text-muted-foreground">{category.name}</p>
                              <div className="grid grid-cols-6 gap-1">
                                {category.emojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    aria-label={`Add ${emoji}`}
                                    onClick={() => {
                                      handleDraftChange(newMessage + emoji)
                                      setShowEmojiPicker(false)
                                      inputRef.current?.focus()
                                    }}
                                    className="flex h-11 w-11 items-center justify-center rounded text-2xl transition-colors hover:bg-muted"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="min-w-0 flex-1">
                      <Label htmlFor="message-box" className="sr-only">
                        Write a message to {other.first_name}
                      </Label>
                      <Textarea
                        id="message-box"
                        ref={inputRef}
                        placeholder={`Write to ${other.first_name}`}
                        value={newMessage}
                        onChange={(e) => handleDraftChange(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter sends; Shift+Enter starts a new line.
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            handleSend()
                          }
                        }}
                        rows={newMessage.length > 80 || newMessage.includes("\n") ? 3 : 1}
                        className="max-h-40 min-h-12 resize-none border-2 border-input text-lg"
                      />
                    </div>

                    <Button type="submit" className="h-12 shrink-0 px-4" disabled={!newMessage.trim()}>
                      <Send aria-hidden="true" />
                      Send
                    </Button>
                  </div>
                  {remaining <= 200 && (
                    <p className={cn("mt-1 text-right text-sm", remaining <= 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {remaining} characters left
                    </p>
                  )}
                </form>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" aria-hidden="true" />
                <p className="mb-2 text-xl font-semibold text-foreground">Choose a conversation</p>
                <p className="text-lg text-muted-foreground">Pick a name on the left to read and write messages.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {other && selectedConversation && (
        <>
          <ReportDialog
            userId={other.id}
            firstName={other.first_name}
            open={showReportDialog}
            onOpenChange={setShowReportDialog}
            source="chat"
            matchId={selectedConversation.match_id}
            onAlsoBlock={() => setShowBlockDialog(true)}
          />
          <BlockDialog
            userId={other.id}
            firstName={other.first_name}
            open={showBlockDialog}
            onOpenChange={setShowBlockDialog}
            onBlocked={() => removeConversationLocally(selectedConversation.match_id)}
          />
        </>
      )}

      {/* Unmatch */}
      <Dialog open={showUnmatchDialog} onOpenChange={setShowUnmatchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unmatch with {other?.first_name}?</DialogTitle>
            <DialogDescription className="text-base">
              You will still be able to read your past messages, but neither of you will be able to send new ones. If
              you both like each other again later, you will match again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUnmatchDialog(false)} disabled={busyAction}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnmatch} disabled={busyAction}>
              {busyAction && <Loader2 className="animate-spin" aria-hidden="true" />}
              Unmatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear conversation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear this conversation?</DialogTitle>
            <DialogDescription className="text-base">
              This removes the messages from your screen only. {other?.first_name} can still see them. You stay
              matched and can keep writing to each other. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={busyAction}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConversation} disabled={busyAction}>
              {busyAction && <Loader2 className="animate-spin" aria-hidden="true" />}
              Clear conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsend */}
      <Dialog open={!!unsendTarget} onOpenChange={(open) => !open && setUnsendTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsend this message?</DialogTitle>
            <DialogDescription className="text-base">
              This removes the message text for both of you. {other?.first_name} will still see that you unsent
              something, and may already have read it.
            </DialogDescription>
          </DialogHeader>
          {unsendTarget && (
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-base">{unsendTarget.content}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUnsendTarget(null)} disabled={isUnsending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnsend} disabled={isUnsending}>
              {isUnsending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
              Unsend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default function MessagesPage() {
  // useSearchParams needs a Suspense boundary to be prerendered.
  return (
    <Suspense fallback={null}>
      <MessagesScreen />
    </Suspense>
  )
}
