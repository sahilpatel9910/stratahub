"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Inbox, MessageSquare, Send, ShieldCheck } from "lucide-react";
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
import { useBuildingContext } from "@/hooks/use-building-context";
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

export default function MessagesPage() {
  const { selectedBuildingId } = useBuildingContext();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [formRecipientId, setFormRecipientId] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formContent, setFormContent] = useState("");

  const utils = trpc.useUtils();
  const { data: me } = trpc.users.getMe.useQuery();

  const threadsQuery = trpc.messaging.listThreads.useQuery();
  const threadQuery = trpc.messaging.getThread.useQuery(
    selectedThreadId ? { threadId: selectedThreadId } : { threadId: "" },
    { enabled: !!selectedThreadId }
  );
  const residentsQuery = trpc.residents.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
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
    const thread = threadsQuery.data?.find((t: { threadId: string | null }) => t.threadId === selectedThreadId);
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
  const unreadCount = threads.filter((thread) => thread.hasUnread).length;
  const residents = residentsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Staff and resident messaging
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Keep communication centralised, respond to resident questions quickly, and maintain a readable conversation history for the team.
            </p>
          </div>
          <div className="app-grid-panel bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(233,243,247,0.9))] p-5">
            <p className="panel-kicker">Mailbox status</p>
            <div className="mt-4 space-y-3">
              <MessageSignal icon={Inbox} label="Conversations" value={`${threads.length}`} tone="text-slate-600" />
              <MessageSignal icon={MessageSquare} label="Unread threads" value={`${unreadCount}`} tone="text-blue-600" />
              <MessageSignal icon={Send} label="Open thread" value={selectedThreadId ? "Active" : "None"} tone="text-emerald-600" />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Message inbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct messages between staff and residents
          </p>
        </div>
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger render={<Button className="h-11 rounded-xl px-5" />}>
            <Send className="mr-2 h-4 w-4" />
            New Message
          </DialogTrigger>
          <DialogContent className="max-w-4xl p-0">
            <DialogHeader>
              <DialogTitle className="px-0 pt-0">New Message</DialogTitle>
              <DialogDescription className="px-0">Send a direct message to a user</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.9fr)]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Recipient *</Label>
                    <Select
                      value={formRecipientId}
                      onValueChange={(value) => value !== null && setFormRecipientId(value)}
                      itemToStringLabel={(value) => {
                        const resident = residents.find((item) => item.id === value);
                        if (!resident) return String(value);
                        return `${resident.firstName} ${resident.lastName}`;
                      }}
                    >
                      <SelectTrigger className="h-12 w-full rounded-xl">
                        <SelectValue
                          placeholder={
                            selectedBuildingId
                              ? residentsQuery.isLoading
                                ? "Loading residents..."
                                : "Select a resident"
                              : "Select a building first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {residents.map((resident) => {
                          const unitNumber =
                            resident.buildingRole === "OWNER"
                              ? resident.ownerships[0]?.unit.unitNumber
                              : resident.tenancies[0]?.unit.unitNumber;
                          const label = `${resident.firstName} ${resident.lastName}${unitNumber ? ` — Unit ${unitNumber}` : ""}`;
                          return (
                            <SelectItem key={resident.id} value={resident.id} label={label}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose a resident from the currently selected building.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject (optional)</Label>
                    <Input
                      id="subject"
                      className="h-12 rounded-xl"
                      placeholder="Message subject"
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="composeContent">Message *</Label>
                    <Textarea
                      id="composeContent"
                      className="min-h-40 rounded-xl"
                      placeholder="Type your message..."
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 xl:sticky xl:top-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Delivery note
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Messages still go through the existing server-side permission checks. This panel only improves the compose experience.
                  </p>
                  <div className="mt-4 rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Team tip
                    </div>
                    <p className="mt-2 leading-6">
                      Use a clear subject and keep one topic per thread so later follow-up stays easy to audit.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setComposeOpen(false)}
                disabled={sendMutation.isPending}
                className="h-11 rounded-xl px-5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCompose}
                disabled={
                  !selectedBuildingId ||
                  !formRecipientId.trim() ||
                  !formContent.trim() ||
                  sendMutation.isPending
                }
                className="h-11 rounded-xl px-5"
              >
                {sendMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 xl:h-[calc(100vh-260px)] xl:min-h-[34rem] xl:grid-cols-3">
        {/* Thread list */}
        <Card className="min-h-[18rem] overflow-hidden xl:col-span-1">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {threadsQuery.isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
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
                No conversations yet
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
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
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
                  className="min-h-24 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
                <Button
                  onClick={handleReply}
                  aria-label="Send reply"
                  disabled={!replyContent.trim() || sendMutation.isPending}
                  className="h-11 rounded-xl px-5 sm:self-end"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send reply
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function MessageSignal({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
