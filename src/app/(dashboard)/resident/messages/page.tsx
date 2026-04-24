"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { toast } from "sonner";

function formatTime(d: Date | string) {
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default function ResidentMessagesPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [formRecipientId, setFormRecipientId] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formContent, setFormContent] = useState("");

  const utils = trpc.useUtils();
  const { data: me } = trpc.users.getMe.useQuery();
  useRealtimeMessages(me?.id);

  // Get resident's building to scope the staff recipient list
  const buildingQuery = trpc.resident.getMyBuilding.useQuery();
  const buildingId = buildingQuery.data?.id;

  const threadsQuery = trpc.messaging.listThreads.useQuery();
  const threadQuery = trpc.messaging.getThread.useQuery(
    selectedThreadId ? { threadId: selectedThreadId } : { threadId: "" },
    { enabled: !!selectedThreadId }
  );

  // Fetch building staff (managers + reception) as recipients
  const staffQuery = trpc.residents.listByBuilding.useQuery(
    buildingId ? { buildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );

  const sendMutation = trpc.messaging.send.useMutation({
    onSuccess: () => {
      utils.messaging.listThreads.invalidate();
      if (selectedThreadId) {
        utils.messaging.getThread.invalidate({ threadId: selectedThreadId });
      }
      setReplyContent("");
      toast.success("Message sent");
    },
    onError: (err) => toast.error(err.message ?? "Failed to send message"),
  });

  const markReadMutation = trpc.messaging.markRead.useMutation({
    onSuccess: () => {
      utils.messaging.listThreads.invalidate();
      utils.messaging.unreadCount.invalidate();
    },
  });

  function handleSelectThread(threadId: string) {
    setSelectedThreadId(threadId);
    markReadMutation.mutate({ threadId });
  }

  function handleReply() {
    if (!selectedThreadId || !replyContent.trim() || !me) return;
    const thread = threadsQuery.data?.find(
      (t: { threadId: string | null }) => t.threadId === selectedThreadId
    );
    if (!thread) return;

    sendMutation.mutate({
      recipientId: thread.sender.id === me.id ? thread.recipient.id : thread.sender.id,
      content: replyContent.trim(),
      threadId: selectedThreadId,
    });
  }

  function handleCompose() {
    if (!formRecipientId.trim() || !formContent.trim()) return;
    sendMutation.mutate({
      recipientId: formRecipientId.trim(),
      subject: formSubject.trim() || undefined,
      content: formContent.trim(),
    });
    setComposeOpen(false);
    setFormRecipientId("");
    setFormSubject("");
    setFormContent("");
  }

  const threads = threadsQuery.data ?? [];
  const messages = threadQuery.data ?? [];
  const selectedThread = threads.find((t) => t.threadId === selectedThreadId);

  // Only show building managers and reception as compose recipients
  const staffRecipients = (staffQuery.data ?? []).filter(
    (r) => r.buildingRole === "BUILDING_MANAGER" || r.buildingRole === "RECEPTION"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            Contact your building manager or reception
          </p>
        </div>
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger render={<Button />}>
            <Send className="mr-2 h-4 w-4" />
            New Message
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
              <DialogDescription>
                Send a message to your building manager or reception staff
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-5 px-7 py-6">
              <div className="flex flex-col gap-1.5">
                <Label>Recipient <span className="text-destructive">*</span></Label>
                <Select
                  value={formRecipientId}
                  onValueChange={(v) => v !== null && setFormRecipientId(v)}
                  itemToStringLabel={(v) => {
                    const staff = staffRecipients.find((s) => s.id === v);
                    if (!staff) return String(v);
                    const roleLabel =
                      staff.buildingRole === "BUILDING_MANAGER"
                        ? "Building Manager"
                        : "Reception";
                    return `${staff.firstName} ${staff.lastName} — ${roleLabel}`;
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        buildingQuery.isLoading
                          ? "Loading staff..."
                          : staffRecipients.length === 0
                          ? "No staff found"
                          : "Select recipient"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {staffRecipients.map((staff) => {
                      const roleLabel =
                        staff.buildingRole === "BUILDING_MANAGER"
                          ? "Building Manager"
                          : "Reception";
                      const label = `${staff.firstName} ${staff.lastName} — ${roleLabel}`;
                      return (
                        <SelectItem key={staff.id} value={staff.id} label={label}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject">Subject <span className="text-[11px] font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  id="subject"
                  placeholder="What is this about?"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="composeContent">Message <span className="text-destructive">*</span></Label>
                <Textarea
                  id="composeContent"
                  placeholder="Type your message..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setComposeOpen(false)}
                disabled={sendMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompose}
                disabled={
                  !formRecipientId.trim() ||
                  !formContent.trim() ||
                  sendMutation.isPending
                }
              >
                {sendMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 xl:h-[calc(100vh-220px)] xl:min-h-[34rem] xl:grid-cols-3">
        {/* Thread list */}
        <Card className="min-h-[18rem] overflow-hidden xl:col-span-1">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {threadsQuery.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <MessageSquare className="mx-auto h-8 w-8 mb-2 text-muted-foreground/40" />
                No conversations yet.
                <br />
                Send a message to get started.
              </div>
            ) : (
              threads.map((thread) => {
                const other =
                  thread.sender.id === me?.id ? thread.recipient : thread.sender;
                const isSelected = thread.threadId === selectedThreadId;

                return (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectThread(thread.threadId ?? thread.id)}
                    className={`w-full flex items-start gap-3 p-4 text-left hover:bg-muted/50 border-b transition-colors ${
                      isSelected ? "bg-muted" : ""
                    }`}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {initials(other.firstName, other.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {other.firstName} {other.lastName}
                      </p>
                      {thread.subject && (
                        <p className="text-xs text-muted-foreground truncate">
                          {thread.subject}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {thread.content}
                      </p>
                    </div>
                    {thread.hasUnread && (
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Message thread */}
        <Card className="min-h-[24rem] overflow-hidden xl:col-span-2">
          {!selectedThreadId ? (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground h-full">
              <div className="text-center">
                <MessageSquare className="mx-auto h-10 w-10 mb-3 text-muted-foreground/40" />
                <p>Select a conversation to view messages</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3 border-b">
                {selectedThread && (
                  <CardTitle className="text-sm font-medium">
                    {selectedThread.subject ?? "Conversation"}
                  </CardTitle>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {threadQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-16 w-64 rounded-lg" />
                      </div>
                    </div>
                  ))
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {initials(msg.sender.firstName, msg.sender.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {msg.sender.firstName} {msg.sender.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted px-3 py-2 text-sm max-w-md">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-end">
                <Textarea
                  placeholder="Type a reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={2}
                  className="min-h-20 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
                <Button
                  onClick={handleReply}
                  disabled={!replyContent.trim() || sendMutation.isPending}
                  className="sm:self-end"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendMutation.isPending ? "Sending..." : "Send reply"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
