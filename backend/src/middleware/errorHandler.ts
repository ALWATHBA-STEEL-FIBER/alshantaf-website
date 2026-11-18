import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", details: err.flatten() });
    return;
  }
  if (err instanceof multer.MulterError || (err instanceof Error && err.message.startsWith("Unsupported file type"))) {
    const tooLarge = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
    console.warn("[upload] rejected", {
      code: err instanceof multer.MulterError ? err.code : "mime",
      message: err.message,
    });
    res.status(400).json({
      error: tooLarge ? "File exceeds the 110MB video limit" : err.message,
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
