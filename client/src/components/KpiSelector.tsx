import { useFilter } from "@/contexts/FilterContext";
import { trpc } from "@/lib/trpc";
import { KPI_FIELDS } from "@/lib/kpiUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from "lucide-react";
import { useMemo } from "react";

export function KpiSelector() {
  const { filter, setSelectedKpis } = useFilter();
  const { data: configs } = trpc.kpi.configs.useQuery();

  const kpiOptions = useMemo(() => {
    if (configs && configs.length > 0) {
      return configs.map((c) => ({
        fieldName: c.fieldName,
        label: c.displayName,
        category: c.category ?? "other",
      }));
    }
    return Object.entries(KPI_FIELDS).map(([k, v]) => ({
      fieldName: k,
      label: v.label,
      category: v.category,
    }));
  }, [configs]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof kpiOptions> = {};
    for (const opt of kpiOptions) {
      const cat = opt.category ?? "other";
      if (!g[cat]) g[cat] = [];
      g[cat].push(opt);
    }
    return g;
  }, [kpiOptions]);

  const toggle = (fieldName: string) => {
    if (filter.selectedKpis.includes(fieldName)) {
      setSelectedKpis(filter.selectedKpis.filter((k) => k !== fieldName));
    } else {
      setSelectedKpis([...filter.selectedKpis, fieldName]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-2 text-xs border-border">
          <Settings2 size={12} />
          KPIs ({filter.selectedKpis.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 bg-popover border-border" align="end">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Select KPIs to Display
        </p>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-3">
            <p className="text-xs font-medium text-muted-foreground capitalize mb-2">{cat}</p>
            <div className="space-y-1.5">
              {items.map((item) => (
                <label
                  key={item.fieldName}
                  className="flex items-center gap-2 cursor-pointer hover:text-foreground text-sm text-foreground/80 transition-colors"
                >
                  <Checkbox
                    checked={filter.selectedKpis.includes(item.fieldName)}
                    onCheckedChange={() => toggle(item.fieldName)}
                    className="h-3.5 w-3.5"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setSelectedKpis(kpiOptions.map((k) => k.fieldName))}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setSelectedKpis([])}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
