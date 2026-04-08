"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureActiveContributorPeriod = ensureActiveContributorPeriod;
exports.startNextContributorPeriod = startNextContributorPeriod;
const ContributorPeriod_1 = require("../models/ContributorPeriod");
const Task_1 = require("../models/Task");
/**
 * Ensures there is exactly one open cycle (endedAt: null). Creates Cycle 1 and backfills legacy tasks if DB is empty.
 */
async function ensureActiveContributorPeriod(startedBy) {
    let active = await ContributorPeriod_1.ContributorPeriod.findOne({ endedAt: null }).sort({ sequence: -1 });
    if (active)
        return active;
    const lastClosed = await ContributorPeriod_1.ContributorPeriod.findOne({ endedAt: { $ne: null } }).sort({ sequence: -1 });
    const sequence = lastClosed ? lastClosed.sequence + 1 : 1;
    const label = `Cycle ${sequence}`;
    active = await ContributorPeriod_1.ContributorPeriod.create({
        sequence,
        label,
        startedAt: new Date(),
        endedAt: null,
        startedBy: startedBy ?? undefined,
    });
    if (sequence === 1) {
        await Task_1.Task.updateMany({ $or: [{ contributorPeriod: { $exists: false } }, { contributorPeriod: null }] }, { $set: { contributorPeriod: active._id } });
    }
    return active;
}
/** Closes the current open cycle and opens the next. Admin-only at route layer. */
async function startNextContributorPeriod(startedBy) {
    let active = await ContributorPeriod_1.ContributorPeriod.findOne({ endedAt: null }).sort({ sequence: -1 });
    if (!active) {
        active = await ensureActiveContributorPeriod(startedBy);
    }
    active.endedAt = new Date();
    await active.save();
    const next = await ContributorPeriod_1.ContributorPeriod.create({
        sequence: active.sequence + 1,
        label: `Cycle ${active.sequence + 1}`,
        startedAt: new Date(),
        endedAt: null,
        startedBy,
    });
    return { previous: active, active: next };
}
