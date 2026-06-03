import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

interface SourcingJob {
  id: string;
  type: string;
  name: string;
  status: "queued" | "running" | "paused" | "completed" | "error";
  count: number;
  duration: string;
  createdAt: string;
  params: Record<string, string>;
  progress?: number;
  error?: string;
}

const jobStore = new Map<string, SourcingJob[]>();

function getTenantJobs(tenantId: string): SourcingJob[] {
  return jobStore.get(tenantId) ?? [];
}

router.get("/jobs", requireAuth, (req, res) => {
  const tenantId = (req as any).user?.tenantId ?? "default";
  res.json(getTenantJobs(tenantId));
});

router.post("/jobs", requireAuth, (req, res) => {
  const tenantId = (req as any).user?.tenantId ?? "default";
  const { type, name, params } = req.body as { type: string; name: string; params: Record<string, string> };

  if (!type || !name) {
    res.status(400).json({ error: "type and name are required" });
    return;
  }

  const job: SourcingJob = {
    id: Date.now().toString(),
    type,
    name,
    status: "queued",
    count: 0,
    duration: "—",
    createdAt: new Date().toISOString(),
    params: params ?? {},
    progress: 0,
  };

  const jobs = getTenantJobs(tenantId);
  jobs.unshift(job);
  jobStore.set(tenantId, jobs);

  res.status(201).json(job);
});

router.get("/jobs/:id", requireAuth, (req, res) => {
  const tenantId = (req as any).user?.tenantId ?? "default";
  const job = getTenantJobs(tenantId).find(j => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.patch("/jobs/:id", requireAuth, (req, res) => {
  const tenantId = (req as any).user?.tenantId ?? "default";
  const jobs = getTenantJobs(tenantId);
  const idx = jobs.findIndex(j => j.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  jobs[idx] = { ...jobs[idx], ...req.body };
  res.json(jobs[idx]);
});

router.delete("/jobs/:id", requireAuth, (req, res) => {
  const tenantId = (req as any).user?.tenantId ?? "default";
  const jobs = getTenantJobs(tenantId).filter(j => j.id !== req.params.id);
  jobStore.set(tenantId, jobs);
  res.status(204).send();
});

export default router;
