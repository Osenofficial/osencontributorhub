"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_dns_1 = __importDefault(require("node:dns"));
// Gmail and others expose IPv6 (AAAA). Many hosts (e.g. Render) have no IPv6 egress → ENETUNREACH on :587.
if (typeof node_dns_1.default.setDefaultResultOrder === "function") {
    node_dns_1.default.setDefaultResultOrder("ipv4first");
}
const db_1 = require("./lib/db");
const mail_1 = require("./lib/mail");
const app_1 = require("./app");
const PORT = process.env.PORT || 5000;
async function start() {
    try {
        await (0, db_1.connectDB)();
        (0, mail_1.logMailStartupStatus)();
        app_1.app.listen(PORT, () => {
            console.log(`Server listening on http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}
void start();
