"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useBuildingContext } from "@/hooks/use-building-context";

interface Building {
  id: string;
  name: string;
  suburb: string;
  organisationName: string;
}

interface BuildingSwitcherProps {
  buildings: Building[];
}

export function BuildingSwitcher({ buildings }: BuildingSwitcherProps) {
  const { selectedBuildingId, setSelectedBuilding, clearSelectedBuilding } =
    useBuildingContext();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedBuildingId && !buildings.some((b) => b.id === selectedBuildingId)) {
      clearSelectedBuilding();
    }
  }, [buildings, clearSelectedBuilding, selectedBuildingId]);

  useEffect(() => {
    if (buildings.length === 1) {
      const b = buildings[0];
      if (selectedBuildingId !== b.id) setSelectedBuilding(b.id, b.name);
    }
  }, [buildings, selectedBuildingId, setSelectedBuilding]);

  useEffect(() => {
    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelStyle({ top: rect.bottom + 8, left: rect.left });
    }

    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  if (buildings.length === 0) return null;

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const orgNames = Array.from(new Set(buildings.map((b) => b.organisationName)));
  const showOrgs = orgNames.length > 1;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-white/75 bg-white/85 px-3 py-2 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-colors hover:bg-white"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="max-w-[180px] truncate">
          {selectedBuilding?.name ?? "Select building"}
        </span>
        {selectedBuilding && (
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            · {selectedBuilding.organisationName}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[70] w-72 overflow-hidden rounded-[1rem] border border-border/80 bg-popover shadow-[0_24px_48px_rgba(15,23,42,0.18)] ring-1 ring-white/60"
              style={{ top: panelStyle?.top ?? 80, left: panelStyle?.left ?? 0 }}
            >
              {showOrgs
                ? orgNames.map((org) => (
                    <div key={org}>
                      <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {org}
                      </div>
                      {buildings
                        .filter((b) => b.organisationName === org)
                        .map((b) => (
                          <BuildingOption
                            key={b.id}
                            building={b}
                            selected={b.id === selectedBuildingId}
                            onSelect={() => {
                              setSelectedBuilding(b.id, b.name);
                              setOpen(false);
                            }}
                          />
                        ))}
                    </div>
                  ))
                : buildings.map((b) => (
                    <BuildingOption
                      key={b.id}
                      building={b}
                      selected={b.id === selectedBuildingId}
                      onSelect={() => {
                        setSelectedBuilding(b.id, b.name);
                        setOpen(false);
                      }}
                    />
                  ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

function BuildingOption({
  building,
  selected,
  onSelect,
}: {
  building: Building;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${selected ? "bg-muted/50" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${selected ? "text-foreground" : "text-foreground/80"}`}>
          {building.name}
        </p>
        <p className="text-xs text-muted-foreground">{building.suburb}</p>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}
