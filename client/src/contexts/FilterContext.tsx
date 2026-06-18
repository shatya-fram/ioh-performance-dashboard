import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type BrandFilter = "IM3" | "3ID" | "Combined";

export interface GlobalFilter {
  brand: BrandFilter;
  region: string;
  area: string;
  branch: string;   // sales_area
  kabkot: string;
  kecamatan: string;
  selectedKpis: string[];
  normalizeVoucher: boolean;
}

interface FilterContextValue {
  filter: GlobalFilter;
  setBrand: (brand: BrandFilter) => void;
  setRegion: (region: string) => void;
  setArea: (area: string) => void;
  setBranch: (branch: string) => void;
  setKabkot: (kabkot: string) => void;
  setKecamatan: (kecamatan: string) => void;
  setSelectedKpis: (kpis: string[]) => void;
  setNormalizeVoucher: (v: boolean) => void;
  resetFilters: () => void;
  // Derived helpers
  brandsArray: string[];
  areasArray: string[];
  salesAreasArray: string[];
  kabkotsArray: string[];
}

const defaultFilter: GlobalFilter = {
  brand: "Combined",
  region: "",
  area: "",
  branch: "",
  kabkot: "",
  kecamatan: "",
  selectedKpis: ["Rev_Prepaid", "Subs_RGU90D", "Subs_GrossAdd", "Subs_Avg_VLR_Daily", "Pack_Purchase_MTD"],
  normalizeVoucher: false,
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<GlobalFilter>(defaultFilter);

  const setBrand = useCallback((brand: BrandFilter) => setFilter((f) => ({ ...f, brand })), []);
  const setRegion = useCallback((region: string) => setFilter((f) => ({ ...f, region })), []);
  const setArea = useCallback((area: string) => setFilter((f) => ({ ...f, area, branch: "", kabkot: "", kecamatan: "" })), []);
  const setBranch = useCallback((branch: string) => setFilter((f) => ({ ...f, branch, kabkot: "", kecamatan: "" })), []);
  const setKabkot = useCallback((kabkot: string) => setFilter((f) => ({ ...f, kabkot, kecamatan: "" })), []);
  const setKecamatan = useCallback((kecamatan: string) => setFilter((f) => ({ ...f, kecamatan })), []);
  const setSelectedKpis = useCallback((selectedKpis: string[]) => setFilter((f) => ({ ...f, selectedKpis })), []);
  const setNormalizeVoucher = useCallback((normalizeVoucher: boolean) => setFilter((f) => ({ ...f, normalizeVoucher })), []);
  const resetFilters = useCallback(() => setFilter(defaultFilter), []);

  const brandsArray = useMemo(() => {
    if (filter.brand === "Combined") return ["IM3", "3ID"];
    return [filter.brand];
  }, [filter.brand]);

  const areasArray = useMemo(() => (filter.area ? [filter.area] : []), [filter.area]);
  const salesAreasArray = useMemo(() => (filter.branch ? [filter.branch] : []), [filter.branch]);
  const kabkotsArray = useMemo(() => (filter.kabkot ? [filter.kabkot] : []), [filter.kabkot]);

  const value: FilterContextValue = {
    filter,
    setBrand,
    setRegion,
    setArea,
    setBranch,
    setKabkot,
    setKecamatan,
    setSelectedKpis,
    setNormalizeVoucher,
    resetFilters,
    brandsArray,
    areasArray,
    salesAreasArray,
    kabkotsArray,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
