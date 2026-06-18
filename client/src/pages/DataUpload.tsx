import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const REQUIRED_SHEETS = [
  { key: "fm", label: "FM Inner RAW", description: "Full month KPI performance data" },
  { key: "mtd", label: "MTD Inner RAW", description: "Month-to-date KPI performance data" },
  { key: "voucher", label: "Voucher Game RAW", description: "Voucher/game revenue effects" },
  { key: "vlr", label: "VLR Tenure RAW", description: "VLR by tenure group per kecamatan" },
  { key: "segments", label: "Rev Segments RAW", description: "Subscriber value segments" },
];

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function DataUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: uploads, refetch: refetchUploads } = trpc.upload.list.useQuery();
  const utils = trpc.useUtils();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    setStatus("uploading");
    setProgress(0);
    setErrorMsg("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 85));
      }, 300);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await response.json();
      setResult(data);
      setStatus("success");
      toast.success("Data uploaded successfully!");

      // Invalidate all queries to refresh data
      await utils.fm.trend.invalidate();
      await utils.mtd.trend.invalidate();
      await utils.vlr.trend.invalidate();
      await utils.segments.trend.invalidate();
      await utils.voucherGame.data.invalidate();
      await utils.geo.hierarchy.invalidate();
      await utils.upload.list.invalidate();
      await utils.upload.latest.invalidate();
      refetchUploads();
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Unknown error occurred");
      toast.error(`Upload failed: ${err?.message ?? "Unknown error"}`);
    }
  }, [utils, refetchUploads]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="p-6 space-y-6 fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="section-header mb-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Data Upload</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Import your Excel performance data file to populate the dashboard
          </p>
        </div>
      </div>

      {/* Required sheets info */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-primary" />
          <p className="text-xs font-semibold text-foreground">Required Excel Sheets</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {REQUIRED_SHEETS.map((sheet) => (
            <div key={sheet.key} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50">
              <FileSpreadsheet size={14} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">{sheet.label}</p>
                <p className="text-xs text-muted-foreground">{sheet.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5"
            : status === "success"
            ? "border-green-500/40 bg-green-500/5"
            : status === "error"
            ? "border-destructive/40 bg-destructive/5"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => status !== "uploading" && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          {status === "idle" && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">
                Drop your Excel file here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse — .xlsx / .xls supported
              </p>
              <Button variant="outline" size="sm" className="border-border">
                Choose File
              </Button>
            </>
          )}

          {status === "uploading" && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <p className="text-base font-semibold text-foreground mb-2">Processing file...</p>
              <p className="text-sm text-muted-foreground mb-4">
                Parsing Excel sheets and loading data into database
              </p>
              <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">Upload Successful!</p>
              <p className="text-sm text-muted-foreground mb-4">
                All data sheets have been loaded into the dashboard
              </p>
              {result && (
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm text-left">
                  {result.rowCounts && Object.entries(result.rowCounts).map(([sheet, count]) => (
                    <div key={sheet} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                      <span className="text-xs text-muted-foreground capitalize">{sheet}</span>
                      <span className="text-xs font-semibold text-foreground">{String(count)} rows</span>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-border"
                onClick={(e) => { e.stopPropagation(); setStatus("idle"); setResult(null); }}
              >
                Upload Another File
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">Upload Failed</p>
              <p className="text-sm text-destructive mb-4">{errorMsg}</p>
              <Button
                variant="outline"
                size="sm"
                className="border-border"
                onClick={(e) => { e.stopPropagation(); setStatus("idle"); setErrorMsg(""); }}
              >
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Upload history */}
      {uploads && uploads.length > 0 && (
        <div className="chart-container">
          <div className="section-header mb-4">
            <h3 className="text-sm font-semibold text-foreground">Upload History</h3>
          </div>
          <div className="space-y-2">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{upload.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(upload.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {upload.status === "done" ? (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle2 size={12} />
                      Done
                    </span>
                  ) : upload.status === "error" ? (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle size={12} />
                      Error
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      Processing
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template download hint */}
      <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Note:</strong> The Excel file must contain sheets named exactly:
          <span className="font-mono text-primary mx-1">FM Inner RAW</span>,
          <span className="font-mono text-primary mx-1">MTD 15 Inner RAW</span>,
          <span className="font-mono text-primary mx-1">Voucher Game RAW</span>,
          <span className="font-mono text-primary mx-1">VLR Tenure RAW</span>, and
          <span className="font-mono text-primary mx-1">Rev Segments RAW</span>.
          Column headers must match the expected format from the IOH reporting template.
        </p>
      </div>
    </div>
  );
}
