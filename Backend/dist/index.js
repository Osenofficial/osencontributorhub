"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("./lib/db");
const app_1 = require("./app");
const PORT = process.env.PORT || 5000;
async function start() {
    try {
        await (0, db_1.connectDB)();
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
