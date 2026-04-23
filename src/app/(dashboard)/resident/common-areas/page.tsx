"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, DoorOpen, Users, XCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommonArea = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  bookingRequired: boolean;
  operatingHours: string | null;
  floor: number | null;
  isActive: boolean;
};

type Booking = {
  id: string;
  status: string;
  startTime: Date | string;
  endTime: Date | string;
  notes: string | null;
  commonArea: { name: string; floor: number | null };
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResidentCommonAreasPage() {
  const [bookingArea, setBookingArea] = useState<CommonArea | null>(null);

  const { data: areas = [], isLoading: areasLoading } =
    trpc.resident.getMyCommonAreas.useQuery();

  const { data: bookings = [], isLoading: bookingsLoading } =
    trpc.resident.getMyBookings.useQuery();

  const utils = trpc.useUtils();

  const cancelBooking = trpc.commonAreas.cancelBooking.useMutation({
    onSuccess: () => {
      toast.success("Booking cancelled");
      void utils.resident.getMyBookings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const now = new Date();

  const upcomingBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" && new Date(b.endTime) > now
  );
  const pastBookings = bookings.filter(
    (b) => b.status !== "CONFIRMED" || new Date(b.endTime) <= now
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div>
          <p className="eyebrow-label text-primary/80">Resident Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
            Common areas
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            Browse shared facilities in your building and make bookings where required.
          </p>
        </div>
      </section>

      {/* Section 1 — Available Facilities */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            Available facilities
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared spaces available to residents of your building
          </p>
        </div>

        {areasLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="mb-3 h-5 w-2/3 rounded-lg" />
                  <Skeleton className="mb-4 h-4 w-full rounded-lg" />
                  <Skeleton className="mb-2 h-4 w-1/2 rounded-lg" />
                  <Skeleton className="h-4 w-1/3 rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
            <DoorOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No facilities available</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Your building has no active common areas yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => (
              <CommonAreaCard
                key={area.id}
                area={area}
                onBook={() => setBookingArea(area)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 2 — My Bookings */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
            My bookings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your upcoming and past facility bookings
          </p>
        </div>

        {bookingsLoading ? (
          <Card>
            <CardContent className="space-y-3 px-6 py-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </CardContent>
          </Card>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            No bookings yet. Book a facility above.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingBookings.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Upcoming
                </p>
                {upcomingBookings.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onCancel={() => cancelBooking.mutate({ id: b.id })}
                    isCancelling={cancelBooking.isPending && cancelBooking.variables?.id === b.id}
                    isPast={false}
                  />
                ))}
              </div>
            )}
            {pastBookings.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Past &amp; Cancelled
                </p>
                {pastBookings.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    onCancel={() => {}}
                    isCancelling={false}
                    isPast={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      {bookingArea && (
        <BookingDialog
          area={bookingArea}
          open={!!bookingArea}
          onOpenChange={(open) => { if (!open) setBookingArea(null); }}
          onSuccess={() => {
            setBookingArea(null);
            void utils.resident.getMyBookings.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Common Area Card ─────────────────────────────────────────────────────────

function CommonAreaCard({
  area,
  onBook,
}: {
  area: CommonArea;
  onBook: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight tracking-[-0.02em] text-foreground">
              {area.name}
            </h3>
            {area.floor !== null && (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                Floor {area.floor}
              </span>
            )}
          </div>
          {area.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
              {area.description}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-1.5">
            {area.capacity !== null && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Capacity: {area.capacity}</span>
              </div>
            )}
            {area.operatingHours && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{area.operatingHours}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          {area.bookingRequired ? (
            <Button
              size="sm"
              className="w-full rounded-xl"
              onClick={onBook}
            >
              Book Now
            </Button>
          ) : (
            <Badge className="w-full justify-center rounded-xl bg-emerald-100 py-1.5 text-emerald-700 hover:bg-emerald-100">
              No booking required
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Booking Row ──────────────────────────────────────────────────────────────

function BookingRow({
  booking,
  onCancel,
  isCancelling,
  isPast,
}: {
  booking: Booking;
  onCancel: () => void;
  isCancelling: boolean;
  isPast: boolean;
}) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  const formatDT = (d: Date) =>
    d.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColors: Record<string, string> = {
    CONFIRMED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
    COMPLETED: "bg-gray-100 text-gray-600",
  };

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-4 ${isPast ? "opacity-60" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-foreground truncate">
            {booking.commonArea.name}
          </p>
          {booking.commonArea.floor !== null && (
            <span className="text-xs text-muted-foreground">· Floor {booking.commonArea.floor}</span>
          )}
          <Badge className={`text-[11px] ${statusColors[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
            {booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDT(start)} → {formatDT(end)}
        </p>
        {booking.notes && (
          <p className="mt-1 text-xs text-muted-foreground/80 truncate">{booking.notes}</p>
        )}
      </div>
      {!isPast && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 w-8 rounded-xl p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onCancel}
          disabled={isCancelling}
          aria-label="Cancel booking"
        >
          <XCircle className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ─── Booking Dialog ───────────────────────────────────────────────────────────

function BookingDialog({
  area,
  open,
  onOpenChange,
  onSuccess,
}: {
  area: CommonArea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const createBooking = trpc.commonAreas.createBooking.useMutation({
    onSuccess: () => {
      toast.success("Booking confirmed!");
      setStartTime("");
      setEndTime("");
      setNotes("");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!startTime) return toast.error("Start time is required");
    if (!endTime) return toast.error("End time is required");
    createBooking.mutate({
      commonAreaId: area.id,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader>
          <DialogTitle className="px-6 pt-6">Book {area.name}</DialogTitle>
          <DialogDescription className="px-6">
            Select your preferred time slot for this facility.
            {area.operatingHours && (
              <span className="block mt-1 text-xs">Operating hours: {area.operatingHours}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startTime">
              Start Time <span className="text-destructive">*</span>
            </Label>
            <input
              id="startTime"
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endTime">
              End Time <span className="text-destructive">*</span>
            </Label>
            <input
              id="endTime"
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bookingNotes">Notes (optional)</Label>
            <Textarea
              id="bookingNotes"
              className="min-h-20 rounded-xl bg-background"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requirements or notes..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBooking.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createBooking.isPending}>
            {createBooking.isPending ? "Booking..." : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
