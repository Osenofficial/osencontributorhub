import { Router } from "express";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { Task } from "../models/Task";
import { Notification } from "../models/Notification";
import {
  LeadActionRequest,
  type LeadActionType,
} from "../models/LeadActionRequest";
import { ensureActiveContributorPeriod, startNextContributorPeriod } from "../lib/contributorPeriodService";
import { queueNotifyUserByEmail, queueNotifyUsersByRole } from "../lib/notifyEmail";

export const adminRouter = Router();

adminRouter.use(requireAuth);

// Stats - admins and leads
adminRouter.get("/stats", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const [totalUsers, totalTasks, completedTasks] = await Promise.all([
      User.countDocuments(),
      Task.countDocuments(),
      Task.countDocuments({ status: "completed" }),
    ]);

    res.json({
      totalUsers,
      totalTasks,
      completedTasks,
      completionRate: totalTasks ? completedTasks / totalTasks : 0,
    });
  } catch (err) {
    next(err);
  }
});

// User list — admins (full management) and leads (needed to assign members when creating tasks)
adminRouter.get("/users", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select("-passwordHash");
    res.json(users);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:id/role", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select(
      "-passwordHash"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// User approval / suspension - admins only
adminRouter.post("/users/:id/approve", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active", isActive: true },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:id/reject", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", isActive: false },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:id/suspend", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "suspended", isActive: false },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:id/activate", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active", isActive: true },
      { new: true }
    ).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Tasks - admins and leads can manage
adminRouter.post("/tasks", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const adminId = req.user!._id;
    const { title, description, points, assignedTo, deadline, category, contributionType, priority } = req.body;
    const assigneeId =
      assignedTo != null && String(assignedTo).trim() !== "" && assignedTo !== "__pool__"
        ? assignedTo
        : null;

    const assignErr = await assigneeValidationError(assigneeId);
    if (assignErr) {
      return res.status(400).json({ message: assignErr });
    }

    const period = await ensureActiveContributorPeriod(adminId);
    const task = await Task.create({
      title,
      description,
      points: points ?? 0,
      category,
      contributionType,
      priority,
      assignedTo: assigneeId,
      createdBy: adminId,
      contributorPeriod: period._id,
      deadline,
      history: [
        {
          actor: adminId,
          action: "created",
          fromStatus: "todo",
          toStatus: "todo",
          createdAt: new Date(),
          meta: { assignedTo: assigneeId },
        },
      ],
    });

    if (assigneeId) {
      await Notification.create({
        user: assigneeId,
        title: "New Task Assigned",
        message: title,
      });
      queueNotifyUserByEmail(
        assigneeId,
        "New task assigned",
        `You have been assigned a new task: "${String(title)}"`,
      );
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/contributor-periods/start", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const result = await startNextContributorPeriod(req.user!._id);
    res.status(201).json({
      previous: {
        id: result.previous._id,
        sequence: result.previous.sequence,
        label: result.previous.label,
        startedAt: result.previous.startedAt,
        endedAt: result.previous.endedAt,
      },
      active: {
        id: result.active._id,
        sequence: result.active.sequence,
        label: result.active.label,
        startedAt: result.active.startedAt,
        endedAt: result.active.endedAt,
        isActive: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/tasks", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const tasks = await Task.find()
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("contributorPeriod", "sequence label startedAt endedAt")
      .populate("pendingAssignmentRequests.user", "name email")
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

const CREATOR_EDIT_FIELDS = [
  "title",
  "description",
  "deadline",
  "category",
  "contributionType",
  "priority",
  "assignedTo",
  "points",
] as const;

function taskCreatedByUser(task: { createdBy: unknown }, userId: unknown) {
  return String(task.createdBy) === String(userId);
}

/** These roles cannot be picked as task assignees (UI + API). */
const ROLES_EXCLUDED_FROM_TASK_ASSIGNMENT = ["accounts", "evangelist"] as const;

function parseAssigneeIdFromBody(assignedTo: unknown): string | null {
  if (assignedTo == null || String(assignedTo).trim() === "" || assignedTo === "__pool__") return null;
  return String(assignedTo);
}

async function assigneeValidationError(assigneeId: string | null): Promise<string | null> {
  if (!assigneeId) return null;
  const u = await User.findById(assigneeId).select("role");
  if (!u) return "Assignee not found";
  if ((ROLES_EXCLUDED_FROM_TASK_ASSIGNMENT as readonly string[]).includes(String(u.role))) {
    return "Accounts and evangelist users cannot be assigned tasks";
  }
  return null;
}

/**
 * Lead may PATCH only `{ assignedTo: ownUserId }` to claim an open pool task (no other fields).
 * Reassigning from another user still requires an admin-approved edit request.
 */
function isLeadSelfAssignOnlyPatch(req: AuthRequest, body: Record<string, unknown>, task: any): boolean {
  if (req.user!.role !== "lead") return false;
  if (task.assignedTo != null) return false;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "assignedTo") return false;
  const next = parseAssigneeIdFromBody(body.assignedTo);
  return Boolean(next && String(next) === String(req.user!._id));
}

function applyCreatorPayloadToTask(task: any, body: Record<string, unknown>) {
  const { title, description, deadline, category, contributionType, priority, assignedTo, points } = body;
  if (title !== undefined) task.title = String(title).trim();
  if (description !== undefined) task.description = String(description ?? "");
  if (deadline !== undefined) {
    task.deadline = deadline ? new Date(String(deadline)) : undefined;
  }
  if (category !== undefined) task.category = category;
  if (contributionType !== undefined) task.contributionType = contributionType as string;
  if (priority !== undefined) task.priority = priority;
  if (assignedTo !== undefined) {
    const assigneeId =
      assignedTo != null &&
      String(assignedTo).trim() !== "" &&
      assignedTo !== "__pool__"
        ? assignedTo
        : null;
    task.assignedTo = assigneeId as any;
  }
  if (points !== undefined) {
    const p = Math.min(100, Math.max(1, parseInt(String(points), 10) || 10));
    task.points = p;
  }
}

async function notifyAdminsLeadActionLine(message: string) {
  const admins = await User.find({ role: "admin" }).select("_id");
  for (const a of admins) {
    await Notification.create({
      user: a._id,
      title: "Lead action needs approval",
      message,
    });
  }
  queueNotifyUsersByRole("admin", "Lead action needs approval", message);
}

adminRouter.patch("/tasks/:id", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isAdmin = req.user!.role === "admin";
    const isLead = req.user!.role === "lead";

    const hasCreatorUpdates = CREATOR_EDIT_FIELDS.some((k) => req.body[k] !== undefined);
    const leadSelfAssignOnly = isLeadSelfAssignOnlyPatch(req, req.body, task);

    if (hasCreatorUpdates) {
      if (isLead && !leadSelfAssignOnly) {
        return res.status(403).json({
          code: "LEAD_REQUIRES_APPROVAL",
          message:
            "Leads cannot edit tasks directly. Submit an edit request from the Tasks panel — an admin must approve before changes apply.",
        });
      }
      if (!isLead && !isAdmin && !taskCreatedByUser(task, req.user!._id)) {
        return res.status(403).json({ message: "Only the task creator or an admin can edit task details" });
      }
      const prevAssigneeId = task.assignedTo != null ? String(task.assignedTo) : null;
      if (req.body.assignedTo !== undefined) {
        const nextAssignee = parseAssigneeIdFromBody(req.body.assignedTo);
        const assignErr = await assigneeValidationError(nextAssignee);
        if (assignErr) {
          return res.status(400).json({ message: assignErr });
        }
      }
      applyCreatorPayloadToTask(task, req.body);
      task.history.push({
        actor: req.user!._id,
        action: "edited",
        fromStatus: task.status,
        toStatus: task.status,
        createdAt: new Date(),
        meta: { fields: CREATOR_EDIT_FIELDS.filter((k) => req.body[k] !== undefined) },
      });
      if (req.body.assignedTo !== undefined) {
        const nextAssigneeId = task.assignedTo != null ? String(task.assignedTo) : null;
        if (nextAssigneeId && nextAssigneeId !== prevAssigneeId) {
          await Notification.create({
            user: nextAssigneeId,
            title: "New Task Assigned",
            message: task.title,
          });
          queueNotifyUserByEmail(
            nextAssigneeId,
            "New task assigned",
            `You have been assigned a new task: "${String(task.title)}"`,
          );
        }
      }
    }

    const fromStatus = task.status;
    if (req.body.status !== undefined) {
      if (isLead) {
        return res.status(403).json({
          code: "LEAD_REQUIRES_APPROVAL",
          message:
            "Leads cannot approve or reject submissions directly. Submit a request from the Tasks panel — an admin must approve.",
        });
      }
      const nextStatus = req.body.status as (typeof task)["status"];
      if (fromStatus === "completed") {
        if (nextStatus === "rejected") {
          if (!isAdmin) {
            return res.status(403).json({
              message: "Only an admin can undo a mistaken approval by marking the task as rejected.",
            });
          }
        } else if (nextStatus !== fromStatus) {
          return res.status(400).json({
            message:
              "Completed tasks cannot change status except an admin may reject to undo a mistaken approval.",
          });
        }
      }
      task.status = nextStatus;
    }
    const rejectComment =
      typeof req.body.rejectComment === "string" ? req.body.rejectComment.trim().slice(0, 500) : "";

    const statusChanged = fromStatus !== task.status;

    if (statusChanged) {
      task.history.push({
        actor: req.user!._id,
        action: "admin_update",
        fromStatus,
        toStatus: task.status,
        createdAt: new Date(),
        meta:
          task.status === "rejected" && rejectComment
            ? { rejectComment }
            : req.body.points !== undefined && typeof req.body.points === "number"
              ? { points: req.body.points }
              : undefined,
      });
    }

    await task.save();

    if (fromStatus === "submitted" && task.status === "completed" && task.assignedTo) {
      const msg = `Your submission for "${task.title}" has been approved!`;
      await Notification.create({
        user: task.assignedTo,
        title: "Task Approved",
        message: msg,
      });
      queueNotifyUserByEmail(task.assignedTo, "Task approved", msg);
    }

    if (fromStatus === "submitted" && (task.status === "rejected" || task.status === "in_progress") && task.assignedTo) {
      const msg = rejectComment
        ? `Your submission for "${task.title}" was not approved. Note from reviewer: "${rejectComment}". Please revise and resubmit when ready.`
        : `Your submission for "${task.title}" was not approved. Please revise and resubmit when ready.`;
      await Notification.create({
        user: task.assignedTo,
        title: "Submission needs revision",
        message: msg,
      });
      queueNotifyUserByEmail(task.assignedTo, "Submission needs revision", msg);
    }

    if (fromStatus === "completed" && task.status === "rejected" && task.assignedTo) {
      const msg = rejectComment
        ? `Your completed task "${task.title}" was marked rejected by an admin (approval reversed). Reason: "${rejectComment}". Contact your lead if this is unexpected.`
        : `Your completed task "${task.title}" was marked rejected by an admin to reverse a mistaken approval. Contact your lead if this is unexpected.`;
      await Notification.create({
        user: task.assignedTo,
        title: "Task approval reversed",
        message: msg,
      });
      queueNotifyUserByEmail(task.assignedTo, "Task approval reversed", msg);
    }

    const populated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email");

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

/** Only admins may hard-delete. Leads must use POST /lead-action-requests (type: delete_task). */
adminRouter.delete("/tasks/:id", requireRole("admin", "lead"), async (req: AuthRequest, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (req.user!.role !== "admin") {
      return res.status(403).json({
        code: "LEAD_REQUIRES_APPROVAL",
        message:
          "Leads cannot delete tasks directly. Submit a delete request from the panel — an admin must approve it.",
      });
    }
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** Tasks with at least one pending assignment request (pool tasks contributors asked for). */
adminRouter.get("/pending-assignment-requests", requireRole("admin", "lead"), async (_req: AuthRequest, res, next) => {
  try {
    const tasks = await Task.find({ "pendingAssignmentRequests.0": { $exists: true } })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email")
      .sort({ updatedAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

/** Approve one contributor — assign task to them and clear pending requests. Admin only (leads cannot assign from pool without approval). */
adminRouter.post("/tasks/:id/approve-assignment", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId || String(userId).trim() === "") {
      return res.status(400).json({ message: "userId is required" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (task.assignedTo != null) {
      return res.status(400).json({ message: "Task is already assigned" });
    }
    const pending = (task.pendingAssignmentRequests || []).some(
      (p: { user: { toString: () => string } }) => p.user.toString() === String(userId)
    );
    if (!pending) {
      return res.status(400).json({ message: "No pending request from this user for this task" });
    }

    const assignErr = await assigneeValidationError(String(userId));
    if (assignErr) {
      return res.status(400).json({ message: assignErr });
    }

    task.assignedTo = userId as any;
    task.pendingAssignmentRequests = [];
    task.history.push({
      actor: req.user!._id,
      action: "assignment_approved",
      fromStatus: task.status,
      toStatus: task.status,
      createdAt: new Date(),
      meta: { assignedTo: userId },
    });
    await task.save();

    const assignMsg = `You've been assigned: "${task.title}"`;
    await Notification.create({
      user: userId,
      title: "Task assigned to you",
      message: assignMsg,
    });
    queueNotifyUserByEmail(userId, "Task assigned to you", assignMsg);

    const updated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** Remove one user's request without assigning (decline). Admin only. */
adminRouter.post("/tasks/:id/reject-assignment", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    const before = (task.pendingAssignmentRequests || []).length;
    task.pendingAssignmentRequests = (task.pendingAssignmentRequests || []).filter(
      (p: { user: { toString: () => string } }) => p.user.toString() !== String(userId)
    );
    if (task.pendingAssignmentRequests.length === before) {
      return res.status(400).json({ message: "No pending request from this user" });
    }
    await task.save();

    const declineMsg = `Your request to work on "${task.title}" was declined.`;
    await Notification.create({
      user: userId,
      title: "Assignment request",
      message: declineMsg,
    });
    queueNotifyUserByEmail(userId, "Assignment request declined", declineMsg);

    const updated = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("pendingAssignmentRequests.user", "name email");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const LEAD_ACTION_TYPES: LeadActionType[] = [
  "edit_task",
  "delete_task",
  "reject_submission",
  "approve_submission",
];

/** Lead submits edit/delete/approve/reject — admins approve here (all task changes go through this for leads). */
adminRouter.post("/lead-action-requests", requireRole("lead"), async (req: AuthRequest, res, next) => {
  try {
  const { type, taskId, payload, reason: reasonRaw } = req.body as {
      type?: LeadActionType;
      taskId?: string;
      payload?: Record<string, unknown>;
      reason?: string;
    };
    const reason = String(reasonRaw ?? "").trim();
    if (!reason) {
      return res.status(400).json({ message: "reason is required — explain why you need this action" });
    }
    if (reason.length > 2000) {
      return res.status(400).json({ message: "reason must be at most 2000 characters" });
    }
    if (reason.length < 5) {
      return res.status(400).json({ message: "reason must be at least 5 characters" });
    }
    if (!type || !taskId || !LEAD_ACTION_TYPES.includes(type)) {
      return res.status(400).json({ message: "type and taskId are required; type must be valid" });
    }
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (type === "approve_submission" || type === "reject_submission") {
      if (task.status !== "submitted") {
        return res.status(400).json({ message: "Task must be in submitted status" });
      }
    }
    if (type === "edit_task") {
      if (!payload || typeof payload !== "object") {
        return res.status(400).json({ message: "payload is required for edit_task" });
      }
    }
    const dup = await LeadActionRequest.findOne({
      task: taskId,
      requestedBy: req.user!._id,
      status: "pending",
      type,
    });
    if (dup) {
      return res.status(400).json({ message: "You already have a pending request of this type for this task" });
    }
  const normalizedPayload =
    type === "edit_task"
      ? payload
      : type === "reject_submission"
        ? {
            rejectComment:
              typeof (payload as any)?.rejectComment === "string"
                ? String((payload as any).rejectComment).trim().slice(0, 500)
                : undefined,
          }
        : undefined;

  const doc = await LeadActionRequest.create({
      type,
      task: taskId,
      requestedBy: req.user!._id,
      status: "pending",
    payload: normalizedPayload,
    reason,
    });
    const populated = await LeadActionRequest.findById(doc._id)
      .populate("task", "title status")
      .populate("requestedBy", "name email");
    const leadName = req.user!.name || "A lead";
    const reasonPreview = reason.length > 120 ? `${reason.slice(0, 117)}…` : reason;
    await notifyAdminsLeadActionLine(
      `${leadName} requested ${type.replace(/_/g, " ")} for "${task.title}". Reason: ${reasonPreview}`,
    );
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/lead-action-requests", requireRole("admin"), async (_req: AuthRequest, res, next) => {
  try {
    const list = await LeadActionRequest.find({ status: "pending" })
      .populate({
        path: "task",
        select:
          "title description status points deadline category contributionType priority assignedTo createdBy submission",
        populate: [
          { path: "assignedTo", select: "name email" },
          { path: "createdBy", select: "name email" },
        ],
      })
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/lead-action-requests/mine", requireRole("lead"), async (req: AuthRequest, res, next) => {
  try {
    const list = await LeadActionRequest.find({ requestedBy: req.user!._id })
      .populate("task", "title status")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/lead-action-requests/:id/approve", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const noteRaw = String((req.body as { note?: unknown })?.note ?? "").trim().slice(0, 1000);
    const resolutionNote = noteRaw || undefined;

    const doc = await LeadActionRequest.findById(req.params.id);
    if (!doc || doc.status !== "pending") {
      return res.status(404).json({ message: "Request not found or already resolved" });
    }
    const task = await Task.findById(doc.task);
    const taskTitle = task?.title ?? "task";
    const adminId = req.user!._id;

    if (!task) {
      doc.status = "declined";
      doc.resolvedAt = new Date();
      doc.resolvedBy = adminId as any;
      doc.resolutionNote = resolutionNote;
      await doc.save();
      return res.status(400).json({ message: "Task no longer exists" });
    }

    switch (doc.type) {
      case "delete_task":
        await Task.findByIdAndDelete(task._id);
        break;
      case "edit_task": {
        const payload = (doc.payload || {}) as Record<string, unknown>;
        if (payload.assignedTo !== undefined) {
          const nextAssignee = parseAssigneeIdFromBody(payload.assignedTo);
          const assignErr = await assigneeValidationError(nextAssignee);
          if (assignErr) {
            return res.status(400).json({ message: assignErr });
          }
        }
        applyCreatorPayloadToTask(task, payload);
        task.history.push({
          actor: adminId,
          action: "edited",
          fromStatus: task.status,
          toStatus: task.status,
          createdAt: new Date(),
          meta: { viaLeadApprovalRequest: true },
        });
        await task.save();
        break;
      }
      case "reject_submission": {
        if (task.status !== "submitted") {
          return res.status(400).json({ message: "Task is no longer submitted" });
        }
        const fromStatus = task.status;
        task.status = "rejected";
        const rejectComment =
          typeof (doc.payload as any)?.rejectComment === "string"
            ? String((doc.payload as any).rejectComment).trim().slice(0, 500)
            : "";
        task.history.push({
          actor: adminId,
          action: "admin_update",
          fromStatus,
          toStatus: task.status,
          createdAt: new Date(),
          meta: rejectComment ? { rejectComment, viaLeadApprovalRequest: true } : { viaLeadApprovalRequest: true },
        });
        await task.save();
        if (task.assignedTo) {
          const subMsg = rejectComment
            ? `Your submission for "${task.title}" was not approved. Note from reviewer: "${rejectComment}". Please revise and resubmit when ready.`
            : `Your submission for "${task.title}" was not approved. Please revise and resubmit when ready.`;
          await Notification.create({
            user: task.assignedTo,
            title: "Submission needs revision",
            message: subMsg,
          });
          queueNotifyUserByEmail(task.assignedTo, "Submission needs revision", subMsg);
        }
        break;
      }
      case "approve_submission": {
        if (task.status !== "submitted") {
          return res.status(400).json({ message: "Task is no longer submitted" });
        }
        const fromStatus = task.status;
        task.status = "completed";
        task.history.push({
          actor: adminId,
          action: "admin_update",
          fromStatus,
          toStatus: task.status,
          createdAt: new Date(),
        });
        await task.save();
        if (task.assignedTo) {
          const apprMsg = `Your submission for "${task.title}" has been approved!`;
          await Notification.create({
            user: task.assignedTo,
            title: "Task Approved",
            message: apprMsg,
          });
          queueNotifyUserByEmail(task.assignedTo, "Task approved", apprMsg);
        }
        break;
      }
      default:
        return res.status(400).json({ message: "Unknown request type" });
    }

    doc.status = "approved";
    doc.resolvedAt = new Date();
    doc.resolvedBy = adminId as any;
    doc.resolutionNote = resolutionNote;
    await doc.save();

    const noteSuffix = resolutionNote ? ` Note: ${resolutionNote}` : "";
    const approvedMsg = `Your request (${doc.type.replace(/_/g, " ")}) for "${taskTitle}" was approved by an admin.${noteSuffix}`;
    await Notification.create({
      user: doc.requestedBy,
      title: "Request approved",
      message: approvedMsg,
    });
    queueNotifyUserByEmail(doc.requestedBy, "Lead request approved", approvedMsg);

    res.json({ success: true, type: doc.type });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/lead-action-requests/:id/decline", requireRole("admin"), async (req: AuthRequest, res, next) => {
  try {
    const noteRaw = String((req.body as { note?: unknown })?.note ?? "").trim().slice(0, 1000);
    const resolutionNote = noteRaw || undefined;

    const doc = await LeadActionRequest.findById(req.params.id).populate("task", "title");
    if (!doc || doc.status !== "pending") {
      return res.status(404).json({ message: "Request not found or already resolved" });
    }
    doc.status = "declined";
    doc.resolvedAt = new Date();
    doc.resolvedBy = req.user!._id as any;
    doc.resolutionNote = resolutionNote;
    await doc.save();
    const t = doc.task as { title?: string } | null;
    const noteSuffix = resolutionNote ? ` Note: ${resolutionNote}` : "";
    const declinedMsg = `Your request (${doc.type.replace(/_/g, " ")}) for "${t?.title ?? "a task"}" was declined by an admin.${noteSuffix}`;
    await Notification.create({
      user: doc.requestedBy,
      title: "Request declined",
      message: declinedMsg,
    });
    queueNotifyUserByEmail(doc.requestedBy, "Lead request declined", declinedMsg);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

