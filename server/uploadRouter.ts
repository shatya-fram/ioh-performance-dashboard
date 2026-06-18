import { Router } from "express";
import multer from "multer";
import { parseAndStoreExcel } from "./excelParser";
import { createUpload, updateUpload } from "./db";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export const uploadRouter = Router();

uploadRouter.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  const uploadId = await createUpload(req.file.originalname);
  if (!uploadId) {
    res.status(500).json({ error: "Failed to create upload record" });
    return;
  }

  try {
    const result = await parseAndStoreExcel(req.file.buffer);
    await updateUpload(uploadId, {
      sheetsLoaded: JSON.stringify(result.sheetsLoaded),
      rowCounts: JSON.stringify(result.rowCounts),
      status: "done",
    });
    res.json({ success: true, ...result, uploadId });
  } catch (err: any) {
    await updateUpload(uploadId, {
      status: "error",
      errorMessage: err?.message ?? "Unknown error",
    });
    res.status(500).json({ error: err?.message ?? "Parse failed" });
  }
});
