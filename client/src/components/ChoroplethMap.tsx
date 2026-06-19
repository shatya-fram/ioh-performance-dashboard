import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface KecamatanData {
  kecamatan: string;
  kabupaten: string;
  value: number | null;
  valueMtd?: number | null;
  valueLmtd?: number | null;
  growth?: number | null;
}

interface ChoroplethMapProps {
  data: KecamatanData[];
  metric: "vlr" | "growth" | "gap";
  title?: string;
  className?: string;
}

const GEOJSON_URL = "/manus-storage/jakarta_kecamatan_5daff639.geojson";

// Color scales — green = good performance, red = poor
function getVlrColor(value: number | null): string {
  if (value === null || value === undefined) return "#1e293b";
  if (value >= 105) return "#166534";
  if (value >= 102) return "#15803d";
  if (value >= 100) return "#16a34a";
  if (value >= 98) return "#4ade80";
  if (value >= 95) return "#fbbf24";
  if (value >= 90) return "#f97316";
  if (value >= 85) return "#ef4444";
  return "#7f1d1d";
}

function getGrowthColor(value: number | null): string {
  if (value === null || value === undefined) return "#1e293b";
  if (value >= 10) return "#166534";
  if (value >= 5) return "#15803d";
  if (value >= 2) return "#16a34a";
  if (value >= 0) return "#4ade80";
  if (value >= -2) return "#fbbf24";
  if (value >= -5) return "#f97316";
  if (value >= -10) return "#ef4444";
  return "#7f1d1d";
}

function getGapColor(value: number | null): string {
  if (value === null || value === undefined) return "#1e293b";
  if (value >= 1000) return "#166534";
  if (value >= 500) return "#15803d";
  if (value >= 100) return "#16a34a";
  if (value >= 0) return "#4ade80";
  if (value >= -100) return "#fbbf24";
  if (value >= -500) return "#f97316";
  if (value >= -1000) return "#ef4444";
  return "#7f1d1d";
}

function formatValue(value: number | null, metric: string): string {
  if (value === null || value === undefined) return "N/A";
  if (metric === "vlr") return `${value.toFixed(1)}%`;
  if (metric === "growth") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  if (metric === "gap") return value >= 0 ? `+${Math.round(value).toLocaleString()}` : Math.round(value).toLocaleString();
  return value.toFixed(1);
}

export default function ChoroplethMap({ data, metric, className }: ChoroplethMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const [hoveredKec, setHoveredKec] = useState<KecamatanData | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Build lookup map from kecamatan name → data
  const dataMapRef = useRef<Map<string, KecamatanData>>(new Map());
  useEffect(() => {
    const m = new Map<string, KecamatanData>();
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

  // Rebuild GeoJSON layer when data or metric changes
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
        if (metric === "vlr") return getVlrColor(d.value);
        if (metric === "growth") return getGrowthColor(d.growth ?? null);
        return getGapColor(d.value);
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

          // Hover-only tooltip — appears on mouseover, disappears on mouseout
          const metricLabel = metric === "vlr" ? "VLR Ratio" : metric === "growth" ? "MoM Growth" : "MTD vs LMTD Gap";
          const displayVal = d
            ? formatValue(metric === "growth" ? (d.growth ?? null) : d.value, metric)
            : "No data";
          const mtdVal = d?.valueMtd != null ? d.valueMtd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";
          const lmtdVal = d?.valueLmtd != null ? d.valueLmtd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";

          lyr.bindTooltip(
            `<div style="background:#0f172a;color:#f1f5f9;padding:8px 12px;border-radius:8px;border:1px solid #334155;font-size:12px;line-height:1.6;min-width:160px;pointer-events:none">
              <div style="color:#f59e0b;font-weight:700;font-size:13px;margin-bottom:2px">${kec}</div>
              <div style="color:#64748b;font-size:11px;margin-bottom:6px">${kab}</div>
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#94a3b8">${metricLabel}</span>
                <span style="font-weight:600;color:#f1f5f9">${displayVal}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#94a3b8">MTD</span>
                <span style="color:#cbd5e1">${mtdVal}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#94a3b8">LMTD</span>
                <span style="color:#cbd5e1">${lmtdVal}</span>
              </div>
            </div>`,
            { sticky: true, opacity: 1, className: "ioh-tooltip" }
          );

          lyr.on({
            mouseover: (e: any) => {
              e.target.setStyle({ weight: 2.5, color: "#f59e0b", fillOpacity: 0.95 });
              e.target.bringToFront();
              setHoveredKec(d ? { ...d, kecamatan: kec, kabupaten: kab } : { kecamatan: kec, kabupaten: kab, value: null });
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
  }, [geojson, data, metric]);

  // Legend config
  const legendItems =
    metric === "vlr"
      ? [
          { color: "#166534", label: "≥ 105%" },
          { color: "#15803d", label: "102–105%" },
          { color: "#16a34a", label: "100–102%" },
          { color: "#4ade80", label: "98–100%" },
          { color: "#fbbf24", label: "95–98%" },
          { color: "#f97316", label: "90–95%" },
          { color: "#ef4444", label: "85–90%" },
          { color: "#7f1d1d", label: "< 85%" },
        ]
      : metric === "growth"
      ? [
          { color: "#166534", label: "≥ +10%" },
          { color: "#15803d", label: "+5–10%" },
          { color: "#16a34a", label: "+2–5%" },
          { color: "#4ade80", label: "0–+2%" },
          { color: "#fbbf24", label: "-2–0%" },
          { color: "#f97316", label: "-5–-2%" },
          { color: "#ef4444", label: "-10–-5%" },
          { color: "#7f1d1d", label: "< -10%" },
        ]
      : [
          { color: "#166534", label: "≥ +1K" },
          { color: "#15803d", label: "+500–1K" },
          { color: "#16a34a", label: "+100–500" },
          { color: "#4ade80", label: "0–+100" },
          { color: "#fbbf24", label: "-100–0" },
          { color: "#f97316", label: "-500–-100" },
          { color: "#ef4444", label: "-1K–-500" },
          { color: "#7f1d1d", label: "< -1K" },
        ];

  return (
    <div className={`relative flex flex-col ${className || ""}`} style={{ minHeight: 500 }}>
      {/* Inject tooltip CSS once */}
      <style>{`
        .ioh-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .ioh-tooltip::before { display: none !important; }
      `}</style>

      {/* Map */}
      <div
        ref={mapRef}
        className="flex-1 rounded-xl overflow-hidden"
        style={{ minHeight: 480, background: "#0f172a" }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl z-[2000]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Loading map boundaries…</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl z-[2000]">
          <span className="text-red-400 text-sm">Failed to load map data</span>
        </div>
      )}

      {/* Legend — bottom left */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700/60 rounded-lg p-3 z-[1000] backdrop-blur-sm">
        <div className="text-slate-400 font-semibold mb-2 uppercase tracking-widest" style={{ fontSize: 9 }}>
          {metric === "vlr" ? "VLR Ratio (MTD/LMTD)" : metric === "growth" ? "MoM Growth" : "MTD vs LMTD Gap"}
        </div>
        <div className="flex flex-col gap-1">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.color }} />
              <span className="text-slate-300" style={{ fontSize: 11 }}>{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-700/50">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#1e293b", border: "1px solid #334155" }} />
            <span className="text-slate-500" style={{ fontSize: 11 }}>No data</span>
          </div>
        </div>
      </div>

      {/* Hover info panel — top right, only shows when hovering */}
      {hoveredKec && (
        <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700/60 rounded-xl p-4 z-[1000] min-w-[200px] backdrop-blur-sm shadow-xl">
          <div className="text-amber-400 font-bold text-sm mb-0.5">{hoveredKec.kecamatan}</div>
          <div className="text-slate-500 text-xs mb-3">{hoveredKec.kabupaten}</div>
          {hoveredKec.value !== null && hoveredKec.value !== undefined ? (
            <div className="space-y-1.5">
              <div className="flex justify-between gap-6">
                <span className="text-slate-400 text-xs">
                  {metric === "vlr" ? "VLR Ratio" : metric === "growth" ? "MoM Growth" : "Gap"}
                </span>
                <span className="text-white font-bold text-sm">
                  {formatValue(metric === "growth" ? (hoveredKec.growth ?? null) : hoveredKec.value, metric)}
                </span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-slate-400 text-xs">MTD</span>
                <span className="text-slate-200 text-xs font-medium">
                  {hoveredKec.valueMtd != null ? hoveredKec.valueMtd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-slate-400 text-xs">LMTD</span>
                <span className="text-slate-200 text-xs font-medium">
                  {hoveredKec.valueLmtd != null ? hoveredKec.valueLmtd.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                </span>
              </div>
              {hoveredKec.growth !== null && hoveredKec.growth !== undefined && metric !== "growth" && (
                <div className="flex justify-between gap-6 pt-1 border-t border-slate-700/50">
                  <span className="text-slate-400 text-xs">MoM Growth</span>
                  <span className={`text-xs font-semibold ${hoveredKec.growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {hoveredKec.growth >= 0 ? "+" : ""}{hoveredKec.growth.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-xs">No data for this kecamatan</div>
          )}
        </div>
      )}

      {/* Instruction hint */}
      {!hoveredKec && !loading && (
        <div className="absolute top-4 right-4 bg-slate-900/70 border border-slate-700/40 rounded-lg px-3 py-2 z-[1000] text-xs text-slate-500 pointer-events-none">
          Hover a kecamatan for details · Click to zoom
        </div>
      )}
    </div>
  );
}
