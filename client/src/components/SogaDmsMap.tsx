import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface SogaDmsKecData {
  kecamatan: string;
  value: number | null;       // latest week value (%)
  weekValues: Record<string, number>; // yearWeek -> value
  weeks: string[];            // sorted list of yearWeeks
  trend: number;              // pp change first→last week
}

interface SogaDmsMapProps {
  data: SogaDmsKecData[];
  metric: "SOGA" | "DMS";
  selectedWeek: string;       // which week to color the map by
  title?: string;
  className?: string;
}

const GEOJSON_URL = "/manus-storage/jakarta_kecamatan_5daff639.geojson";

// Color scale: 0% = deep red, 40% = amber, 60% = green, 100% = deep green
function getSogaColor(value: number | null): string {
  if (value === null || value === undefined) return "#1e293b";
  if (value >= 80) return "#166534";
  if (value >= 70) return "#15803d";
  if (value >= 60) return "#16a34a";
  if (value >= 50) return "#4ade80";
  if (value >= 40) return "#fbbf24";
  if (value >= 30) return "#f97316";
  if (value >= 20) return "#ef4444";
  return "#7f1d1d";
}

function weekLabel(w: string) {
  return `W${w.slice(4)}`;
}

export default function SogaDmsMap({ data, metric, selectedWeek, title, className }: SogaDmsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const [hoveredKec, setHoveredKec] = useState<SogaDmsKecData | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Build lookup map
  const dataMapRef = useRef<Map<string, SogaDmsKecData>>(new Map());
  useEffect(() => {
    const m = new Map<string, SogaDmsKecData>();
    data.forEach(d => {
      m.set(d.kecamatan.toUpperCase(), d);
      m.set(d.kecamatan.toUpperCase().replace(/\s+/g, ""), d);
    });
    dataMapRef.current = m;
  }, [data]);

  // Load GeoJSON once
  useEffect(() => {
    setLoading(true);
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(gj => { setGeojson(gj); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    import("leaflet").then(L => {
      const map = L.map(mapRef.current!, {
        center: [-6.2, 106.85],
        zoom: 10,
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
      }).addTo(map);
      leafletMapRef.current = map;
    });
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Rebuild GeoJSON layer when data or selectedWeek changes
  useEffect(() => {
    if (!leafletMapRef.current || !geojson) return;
    import("leaflet").then(L => {
      if (geoLayerRef.current) {
        geoLayerRef.current.remove();
        geoLayerRef.current = null;
      }
      const lookup = dataMapRef.current;

      const getColor = (kecName: string) => {
        const d = lookup.get(kecName.toUpperCase()) || lookup.get(kecName.toUpperCase().replace(/\s+/g, ""));
        if (!d) return "#1e293b";
        const val = d.weekValues[selectedWeek] ?? d.value;
        return getSogaColor(val);
      };

      const layer = L.geoJSON(geojson, {
        style: (feature: any) => ({
          fillColor: getColor(feature?.properties?.kecamatan || ""),
          fillOpacity: 0.82,
          color: "#0f172a",
          weight: 0.7,
          opacity: 1,
        }),
        onEachFeature: (feature: any, lyr: any) => {
          const kec: string = feature?.properties?.kecamatan || "";
          const kab: string = feature?.properties?.kabupaten || "";
          const d = lookup.get(kec.toUpperCase()) || lookup.get(kec.toUpperCase().replace(/\s+/g, ""));
          const val = d ? (d.weekValues[selectedWeek] ?? d.value) : null;
          const trend = d?.trend ?? 0;

          // Build mini trend bar for tooltip
          const trendBars = d
            ? d.weeks.map(w => {
                const v = d.weekValues[w] ?? 0;
                const c = v >= 60 ? "#4ade80" : v >= 40 ? "#fbbf24" : "#ef4444";
                return `<span style="display:inline-block;width:20px;height:${Math.max(4, Math.round(v / 5))}px;background:${c};border-radius:2px;vertical-align:bottom;margin-right:2px" title="${weekLabel(w)}: ${v.toFixed(1)}%"></span>`;
              }).join("")
            : "";

          lyr.bindTooltip(
            `<div style="background:#0f172a;color:#f1f5f9;padding:8px 12px;border-radius:8px;border:1px solid #334155;font-size:12px;line-height:1.6;min-width:180px;pointer-events:none">
              <div style="color:#f59e0b;font-weight:700;font-size:13px;margin-bottom:2px">${kec}</div>
              <div style="color:#64748b;font-size:11px;margin-bottom:6px">${kab}</div>
              <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
                <span style="color:#94a3b8">${metric} (${weekLabel(selectedWeek)})</span>
                <span style="font-weight:600;color:${val !== null && val >= 60 ? "#4ade80" : val !== null && val >= 40 ? "#fbbf24" : "#ef4444"}">${val !== null ? val.toFixed(1) + "%" : "N/A"}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:6px">
                <span style="color:#94a3b8">5W Trend</span>
                <span style="font-weight:600;color:${trend >= 0 ? "#4ade80" : "#ef4444"}">${trend >= 0 ? "↗ +" : "↘ "}${Math.abs(trend).toFixed(1)}pp</span>
              </div>
              <div style="display:flex;align-items:flex-end;gap:2px;height:24px">${trendBars}</div>
            </div>`,
            { sticky: true, opacity: 1, className: "ioh-tooltip" }
          );
          lyr.on({
            mouseover: (e: any) => {
              e.target.setStyle({ weight: 2.5, color: "#f59e0b", fillOpacity: 0.95 });
              e.target.bringToFront();
              setHoveredKec(d ? { ...d, kecamatan: kec } : null);
            },
            mouseout: (e: any) => {
              layer.resetStyle(e.target);
              setHoveredKec(null);
            },
            click: (e: any) => {
              leafletMapRef.current?.fitBounds(e.target.getBounds(), { padding: [30, 30] });
            },
          });
        },
      });
      layer.addTo(leafletMapRef.current);
      geoLayerRef.current = layer;
      try {
        const bounds = layer.getBounds();
        if (bounds.isValid()) leafletMapRef.current.fitBounds(bounds, { padding: [10, 10] });
      } catch (_) {}
    });
  }, [geojson, data, selectedWeek, metric]);

  const legendItems = [
    { color: "#166534", label: "≥ 80%" },
    { color: "#15803d", label: "70–80%" },
    { color: "#16a34a", label: "60–70%" },
    { color: "#4ade80", label: "50–60%" },
    { color: "#fbbf24", label: "40–50%" },
    { color: "#f97316", label: "30–40%" },
    { color: "#ef4444", label: "20–30%" },
    { color: "#7f1d1d", label: "< 20%" },
  ];

  return (
    <div className={`relative flex flex-col ${className || ""}`} style={{ minHeight: 500 }}>
      <style>{`
        .ioh-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .ioh-tooltip::before { display: none !important; }
      `}</style>
      <div
        ref={mapRef}
        className="flex-1 rounded-xl overflow-hidden"
        style={{ minHeight: 480, background: "#0f172a" }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl z-[2000]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Loading map boundaries…</span>
          </div>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl z-[2000]">
          <span className="text-red-400 text-sm">Failed to load map data</span>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700/60 rounded-lg p-3 z-[1000] backdrop-blur-sm">
        <div className="text-slate-400 font-semibold mb-2 uppercase tracking-widest" style={{ fontSize: 9 }}>
          {metric} Share % — {weekLabel(selectedWeek)}
        </div>
        <div className="flex flex-col gap-1">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.color }} />
              <span className="text-slate-300" style={{ fontSize: 10 }}>{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#1e293b" }} />
            <span className="text-slate-300" style={{ fontSize: 10 }}>No data</span>
          </div>
        </div>
      </div>
      {/* Hover info top-right */}
      {hoveredKec && (
        <div className="absolute top-4 right-4 bg-slate-900/90 border border-slate-700/60 rounded-lg p-3 z-[1000] backdrop-blur-sm min-w-[180px]">
          <div className="text-amber-400 font-bold text-sm mb-1">{hoveredKec.kecamatan}</div>
          <div className="text-slate-400 text-xs mb-2">{metric} — {weekLabel(selectedWeek)}</div>
          <div className="text-white font-bold text-lg">
            {hoveredKec.weekValues[selectedWeek] != null
              ? `${(hoveredKec.weekValues[selectedWeek]).toFixed(1)}%`
              : "N/A"}
          </div>
          <div className={`text-xs mt-1 font-medium ${hoveredKec.trend >= 0 ? "text-green-400" : "text-red-400"}`}>
            {hoveredKec.trend >= 0 ? "↗ +" : "↘ "}{Math.abs(hoveredKec.trend).toFixed(1)}pp (5W trend)
          </div>
        </div>
      )}
    </div>
  );
}
