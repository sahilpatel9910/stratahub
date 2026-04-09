"use client";

import { useEffect } from "react";
import { Building2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBuildingContext } from "@/hooks/use-building-context";

interface Building {
  id: string;
  name: string;
  suburb: string;
}

interface BuildingSwitcherProps {
  buildings: Building[];
}

export function BuildingSwitcher({ buildings }: BuildingSwitcherProps) {
  const { selectedBuildingId, selectedBuildingName, setSelectedBuilding } =
    useBuildingContext();

  // Auto-select when there is exactly one building and none is selected yet
  useEffect(() => {
    if (buildings.length === 1 && !selectedBuildingId) {
      setSelectedBuilding(buildings[0].id, buildings[0].name);
    }
  }, [buildings, selectedBuildingId, setSelectedBuilding]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedBuildingName ?? "Select building"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" align="start">
        {buildings.map((building) => (
          <DropdownMenuItem
            key={building.id}
            onClick={() => setSelectedBuilding(building.id, building.name)}
          >
            <div className="flex w-full items-center justify-between">
              <div>
                <div className="font-medium">{building.name}</div>
                <div className="text-xs text-muted-foreground">
                  {building.suburb}
                </div>
              </div>
              {selectedBuildingId === building.id && (
                <Check className="h-4 w-4 text-blue-600" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {buildings.length === 0 && (
          <DropdownMenuItem disabled>No buildings available</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
