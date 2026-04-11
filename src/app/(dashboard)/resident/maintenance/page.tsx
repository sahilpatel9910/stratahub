"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  AWAITING_PARTS: "Awaiting Parts",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-gray-100 text-gray-800",
  ACKNOWLEDGED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  AWAITING_PARTS: "bg-orange-100 text-orange-800",
  SCHEDULED: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-800",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  HVAC: "HVAC",
  STRUCTURAL: "Structural",
  APPLIANCE: "Appliance",
  PEST_CONTROL: "Pest Control",
  CLEANING: "Cleaning",
  SECURITY: "Security",
  LIFT: "Lift",
  COMMON_AREA: "Common Area",
  OTHER: "Other",
};

export default function ResidentMaintenancePage() {
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [priority, setPriority] = useState("MEDIUM");

  const { data: requests = [], isLoading, refetch } = trpc.resident.getMyMaintenanceRequests.useQuery({});
  const { data: profile } = trpc.resident.getMyProfile.useQuery();

  const allUnits = [
    ...(profile?.ownerships ?? []).map((o) => o.unit),
    ...(profile?.tenancies ?? []).map((t) => t.unit),
  ];

  const createRequest = trpc.resident.createMaintenanceRequest.useMutation({
    onSuccess: () => {
      toast.success("Maintenance request submitted");
      setOpen(false);
      setTitle(""); setDescription(""); setCategory("OTHER"); setPriority("MEDIUM"); setUnitId("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit() {
    if (!unitId) return toast.error("Please select a unit");
    if (!title.trim()) return toast.error("Title is required");
    if (!description.trim()) return toast.error("Description is required");
    createRequest.mutate({ unitId, title, description, category: category as "OTHER", priority: priority as "MEDIUM" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and submit maintenance requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogTitle>New Maintenance Request</DialogTitle>
            <div className="space-y-4 mt-4">
              {allUnits.length > 1 && (
                <div className="space-y-1">
                  <Label>Unit</Label>
                  <Select value={unitId} onValueChange={(v) => v !== null && setUnitId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {allUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id} label={`Unit ${u.unitNumber}`}>Unit {u.unitNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leaking tap in bathroom" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => v !== null && setCategory(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => v !== null && setPriority(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v} label={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={createRequest.isPending}
              >
                {createRequest.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No maintenance requests yet. Submit one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium max-w-xs truncate">{req.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{req.unit.unitNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {CATEGORY_LABELS[req.category] ?? req.category}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {PRIORITY_LABELS[req.priority] ?? req.priority}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[req.status] ?? ""}>
                      {STATUS_LABELS[req.status] ?? req.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
