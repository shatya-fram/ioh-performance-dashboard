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

// Color scales
function getVlrColor(value: number | null): string {
  if (value === null || value === undefined) return "#1e293b";
  if (value >= 90) return "#166534"; // deep green
  if (value >= 80) return "#15803d"; // green
  if (value >= 70) return "#16a34a"; // medium green
  if (value >= 60) return "#4ade80"; // light green
  if (value >= 50) return "#fbbf24"; // amber
  if (value >= 40) return "#f97316"; // orange
  if (value >= 30) return "#ef4444"; // red
  return "#7f1d1d"; // deep red
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
  // Gap: positive = more VLR than LMTD (good), negative = less (bad)
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
  if (metric === "gap") return value >= 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
  return value.toFixed(1);
}

export default function ChoroplethMap({ data, metric, title, className }: ChoroplethMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const [hoveredKec, setHoveredKec] = useState<KecamatanData | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Build lookup map from kecamatan name to data
  const dataMap = new Map<string, KecamatanData>();
  data.forEach(d => {
    dataMap.set(d.kecamatan.toUpperCase(), d);
    // Also try without spaces
    dataMap.set(d.kecamatan.toUpperCase().replace(/\s+/g, ''), d);
  });

  // Load GeoJSON once
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(gj => {
        setGeojson(gj);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load GeoJSON:", err);
        setLoading(false);
      });
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    import("leaflet").then(L => {
      const map = L.map(mapRef.current!, {
        center: [-6.2, 106.85],
        zoom: 10,
        zoomControl: true,
        attributionControl: false,
      });

      // Dark tile layer
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 18 }
      ).addTo(map);

      leafletMapRef.current = map;
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [mapRef.current]);

  // Update GeoJSON layer when data or geojson changes
  useEffect(() => {
    if (!leafletMapRef.current || !geojson) return;

    import("leaflet").then(L => {
      // Remove old layer
      if (geoLayerRef.current) {
        geoLayerRef.current.remove();
        geoLayerRef.current = null;
      }

      const getColor = (kecName: string) => {
        const d = dataMap.get(kecName.toUpperCase()) || dataMap.get(kecName.toUpperCase().replace(/\s+/g, ''));
        if (!d) return "#1e293b";
        if (metric === "vlr") return getVlrColor(d.value);
        if (metric === "growth") return getGrowthColor(d.growth ?? null);
        return getGapColor(d.value);
      };

      const layer = L.geoJSON(geojson, {
        style: (feature: any) => {
          const kec = feature?.properties?.kecamatan || "";
          return {
            fillColor: getColor(kec),
            fillOpacity: 0.8,
            color: "#0f172a",
            weight: 0.8,
            opacity: 1,
          };
        },
        onEachFeature: (feature: any, layer: any) => {
          const kec = feature?.properties?.kecamatan || "";
          const kab = feature?.properties?.kabupaten || "";
          const d = dataMap.get(kec.toUpperCase()) || dataMap.get(kec.toUpperCase().replace(/\s+/g, ''));

          layer.on({
            mouseover: (e: any) => {
              const l = e.target;
              l.setStyle({ weight: 2, color: "#f59e0b", fillOpacity: 0.9 });
              l.bringToFront();
              setHoveredKec(d ? { ...d, kecamatan: kec, kabupaten: kab } : { kecamatan: kec, kabupaten: kab, value: null });
            },
            mouseout: (e: any) => {
              layer.resetStyle(e.target);
              setHoveredKec(null);
            },
            click: (e: any) => {
              leafletMapRef.current?.fitBounds(e.target.getBounds(), { padding: [20, 20] });
            },
          });

          // Tooltip
          const valueStr = d ? formatValue(
            metric === "growth" ? (d.growth ?? null) : d.value,
            metric
          ) : "No data";
          layer.bindTooltip(
            `<div style="background:#1e293b;color:#f1f5f9;padding:6px 10px;border-radius:6px;border:1px solid #334155;font-size:12px;line-height:1.5">
              <strong style="color:#f59e0b">${kec}</strong><br/>
              <span style="color:#94a3b8">${kab}</span><br/>
              <span>${valueStr}</span>
            </div>`,
            { sticky: true, className: "leaflet-tooltip-dark", opacity: 1 }
          );
        },
      });

      layer.addTo(leafletMapRef.current);
      geoLayerRef.current = layer;

      // Fit bounds to the layer
      try {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          leafletMapRef.current.fitBounds(bounds, { padding: [10, 10] });
        }
      } catch (e) {}
    });
  }, [geojson, data, metric]);

  // Legend items
  const legendItems =
    metric === "vlr"
      ? [
          { color: "#166534", label: "≥ 90%" },
          { color: "#15803d", label: "80–90%" },
          { color: "#16a34a", label: "70–80%" },
          { color: "#4ade80", label: "60–70%" },
          { color: "#fbbf24", label: "50–60%" },
          { color: "#f97316", label: "40–50%" },
          { color: "#ef4444", label: "30–40%" },
          { color: "#7f1d1d", label: "< 30%" },
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
    <div className={`relative flex flex-col ${className || ""}`} style={{ minHeight: 480 }}>
      {/* Map container */}
      <div
        ref={mapRef}
        className="flex-1 rounded-xl overflow-hidden"
        style={{ minHeight: 440, background: "#0f172a" }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-xl">
          <div className="text-slate-400 text-sm">Loading map data...</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700 rounded-lg p-3 text-xs z-[1000]">
        <div className="text-slate-400 font-semibold mb-2 uppercase tracking-wide" style={{ fontSize: 10 }}>
          {metric === "vlr" ? "VLR Rate" : metric === "growth" ? "MoM Growth" : "MTD vs LMTD Gap"}
        </div>
        <div className="flex flex-col gap-1">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.color }} />
              <span className="text-slate-300">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: "#1e293b", border: "1px solid #334155" }} />
            <span className="text-slate-500">No data</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip (supplemental info panel) */}
      {hoveredKec && (
        <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700 rounded-lg p-3 text-xs z-[1000] min-w-[180px]">
          <div className="text-amber-400 font-bold text-sm mb-1">{hoveredKec.kecamatan}</div>
          <div className="text-slate-400 mb-2">{hoveredKec.kabupaten}</div>
          {hoveredKec.value !== null && hoveredKec.value !== undefined ? (
            <div className="space-y-1">
              {metric === "vlr" && (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">VLR MTD</span>
                    <span className="text-white font-semibold">{hoveredKec.valueMtd?.toFixed(1) ?? hoveredKec.value?.toFixed(1)}%</span>
                  </div>
                  {hoveredKec.valueLmtd !== null && hoveredKec.valueLmtd !== undefined && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400">VLR LMTD</span>
                      <span className="text-slate-300">{hoveredKec.valueLmtd?.toFixed(1)}%</span>
                    </div>
                  )}
                  {hoveredKec.growth !== null && hoveredKec.growth !== undefined && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400">MoM Growth</span>
                      <span className={hoveredKec.growth >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {hoveredKec.growth >= 0 ? "+" : ""}{hoveredKec.growth?.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </>
              )}
              {metric === "growth" && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Growth</span>
                  <span className={(hoveredKec.growth ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {(hoveredKec.growth ?? 0) >= 0 ? "+" : ""}{hoveredKec.growth?.toFixed(1)}%
                  </span>
                </div>
              )}
              {metric === "gap" && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Gap</span>
                  <span className={(hoveredKec.value ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatValue(hoveredKec.value, "gap")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500">No data available</div>
          )}
        </div>
      )}
    </div>
  );
}
