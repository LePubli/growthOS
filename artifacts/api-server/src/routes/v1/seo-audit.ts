import { Router } from "express";
import { z } from "zod";
import { inspectWebsite, validatePublicWebsite } from "../../lib/seo/inspectWebsite";

const router = Router();
const quota = new Map<string,{start:number;count:number}>();
const schema = z.object({url:z.string().min(4).max(500)});

router.post("/check", async (req,res)=>{
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({error:"URL invalide"}); return; }
  // Invalid/local/private URL inputs are client errors. Only remote fetch
  // failures are 422. Reject before consuming the tenant's hourly quota.
  try { validatePublicWebsite(parsed.data.url); }
  catch { res.status(400).json({error:"Adresse HTTPS publique invalide ou non autorisée"}); return; }
  const tenant = req.auth!.tenantId;
  const now = Date.now();
  const old = quota.get(tenant);
  const window = !old || now-old.start>3_600_000 ? {start:now,count:0}:old;
  if (window.count>=6) {res.status(429).json({error:"Limite : 6 analyses de site par heure"}); return;}
  try {
    window.count++; quota.set(tenant,window);
    const result = await inspectWebsite(parsed.data.url);
    res.setHeader("Cache-Control","no-store");
    res.json(result);
  } catch (error) {
    res.status(422).json({error:error instanceof Error?error.message:"Site indisponible"});
  }
});

export default router;
