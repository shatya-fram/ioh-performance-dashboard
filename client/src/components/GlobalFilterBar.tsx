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
        if (filter.branch && r.salesArea !== filter.branch) return false;
        return true;
      })
      .map((r) => r.kabkotNm)
      .filter(Boolean) as string[];
    return Array.from(new Set(all)).sort();
  }, [geoData, filter.area, filter.branch]);

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

      {/* Branch */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Branch</span>
        <Select value={filter.branch || "all"} onValueChange={(v) => setBranch(v === "all" ? "" : v)}>
          <SelectTrigger className="h-7 w-40 text-xs bg-secondary border-border">
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kabupaten */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Kabupaten</span>
        <Select value={filter.kabkot || "all"} onValueChange={(v) => setKabkot(v === "all" ? "" : v)}>
          <SelectTrigger className="h-7 w-44 text-xs bg-secondary border-border">
            <SelectValue placeholder="All Kabupaten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Kabupaten</SelectItem>
            {kabkots.map((k) => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
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
        {filter.branch && (
          <Badge variant="secondary" className="text-xs py-0.5 px-2 cursor-pointer" onClick={() => setBranch("")}>
            {filter.branch} ×
          </Badge>
        )}
        {filter.kabkot && (
          <Badge variant="secondary" className="text-xs py-0.5 px-2 cursor-pointer" onClick={() => setKabkot("")}>
            {filter.kabkot} ×
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
