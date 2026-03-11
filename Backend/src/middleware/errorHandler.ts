import { Request, Response, NextFunction } from "express";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if (res.headersSent) return;

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({ message });
}

