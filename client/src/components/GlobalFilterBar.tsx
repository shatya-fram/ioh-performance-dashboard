import { useFilter, BrandFilter } from "@/contexts/FilterContext";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Filter } from "lucide-react";
import { useMemo } from "react";

const BRAND_OPTIONS: { value: BrandFilter; label: string }[] = [
  { value: "Combined", label: "IOH (Combined)" },
  { value: "IM3", label: "IM3" },
  { value: "3ID", label: "3ID" },
];

// Prefix used to distinguish branch vs kabkot values in the unified selector
const BRANCH_PREFIX = "branch::";
const KABKOT_PREFIX = "kabkot::";

export function GlobalFilterBar() {
  const { filter, setBrand, setArea, setBranch, setKabkot, resetFilters } = useFilter();
  const { data: geoData } = trpc.geo.hierarchy.useQuery();

  const areas = useMemo(() => geoData?.areas ?? [], [geoData]);

  const branches = useMemo(() => {
    if (!geoData?.hierarchy) return [];
    const all = geoData.hierarchy
      .filter((r) => !filter.area || r.area === filter.area)
      .map((r) => r.salesArea)
      .filter(Boolean) as string[];
    return Array.from(new Set(all)).sort();
  }, [geoData, filter.area]);

  const kabkots = useMemo(() => {
    if (!geoData?.hierarchy) return [];
    const all = geoData.hierarchy
      .filter((r) => {
        if (filter.area && r.area !== filter.area) return false;
        return true;
      })
      .map((r) => r.kabkotNm)
      .filter(Boolean) as string[];
    return Array.from(new Set(all)).sort();
  }, [geoData, filter.area]);

  // Unified location value: "branch::X" | "kabkot::Y" | "all"
  const locationValue = useMemo(() => {
    if (filter.branch) return `${BRANCH_PREFIX}${filter.branch}`;
    if (filter.kabkot) return `${KABKOT_PREFIX}${filter.kabkot}`;
    return "all";
  }, [filter.branch, filter.kabkot]);

  const locationLabel = useMemo(() => {
    if (filter.branch) return filter.branch;
    if (filter.kabkot) return filter.kabkot;
    return null;
  }, [filter.branch, filter.kabkot]);

  function handleLocationChange(val: string) {
    if (val === "all") {
      setBranch("");
      setKabkot("");
    } else if (val.startsWith(BRANCH_PREFIX)) {
      setBranch(val.slice(BRANCH_PREFIX.length));
    } else if (val.startsWith(KABKOT_PREFIX)) {
      // setKabkot clears branch via FilterContext
      setBranch("");
      setKabkot(val.slice(KABKOT_PREFIX.length));
    }
  }

  const hasActiveFilters = filter.area || filter.branch || filter.kabkot || filter.brand !== "Combined";

  return (
    <div className="filter-bar">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter size={14} />
        <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
      </div>

      {/* Brand */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Brand</span>
        <div className="flex gap-1">
          {BRAND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBrand(opt.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                filter.brand === opt.value
                  ? opt.value === "IM3"
                    ? "badge-im3"
                    : opt.value === "3ID"
                    ? "badge-3id"
                    : "badge-combined"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Area */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Area</span>
        <Select value={filter.area || "all"} onValueChange={(v) => setArea(v === "all" ? "" : v)}>
          <SelectTrigger className="h-7 w-44 text-xs bg-secondary border-border">
            <SelectValue placeholder="All Areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a!}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Unified Location (Branch OR Kabupaten) */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Location</span>
        <Select value={locationValue} onValueChange={handleLocationChange}>
          <SelectTrigger className="h-7 w-52 text-xs bg-secondary border-border">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>

            {branches.length > 0 && (
              <>
                {/* Group label — not selectable */}
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  Branch (Sales Area)
                </div>
                {branches.map((b) => (
                  <SelectItem key={`branch-${b}`} value={`${BRANCH_PREFIX}${b}`}>
                    {b}
                  </SelectItem>
                ))}
              </>
            )}

            {kabkots.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground select-none mt-1">
                  Kabupaten / Kota
                </div>
                {kabkots.map((k) => (
                  <SelectItem key={`kabkot-${k}`} value={`${KABKOT_PREFIX}${k}`}>
                    {k}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Active filter badges */}
      <div className="flex flex-wrap gap-1 ml-auto">
        {filter.area && (
          <Badge variant="secondary" className="text-xs py-0.5 px-2 cursor-pointer" onClick={() => setArea("")}>
            {filter.area} ×
          </Badge>
        )}
        {locationLabel && (
          <Badge
            variant="secondary"
            className="text-xs py-0.5 px-2 cursor-pointer"
            onClick={() => { setBranch(""); setKabkot(""); }}
          >
            {locationLabel} ×
          </Badge>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={resetFilters}
          >
            <RotateCcw size={10} className="mr-1" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
