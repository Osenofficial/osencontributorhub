"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, _req, res, _next) {
    console.error(err);
    if (res.headersSent)
        return;
    const status = err.status || 500;
    const message = err.message || "Internal server error";
    res.status(status).json({ message });
}
