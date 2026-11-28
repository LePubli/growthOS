import {Router} from 'express';
import {z} from 'zod';
import {startProspectEnrichment,latestProspectEnrichment,tickProspectEnrichments} from '../../services/prospect-enrichment';
import {CloudBrowserError} from '../../services/cloud-browser';
const router=Router();
router.get('/:id/enrichment',async(req,res,next)=>{
  try{res.json(await latestProspectEnrichment(req.auth!.tenantId,z.string().uuid().parse(req.params.id)));}catch(error){next(error);}
});
router.post('/:id/enrichment',async(req,res,next)=>{
  try{
    z.object({}).strict().parse(req.body||{});
    const job=await startProspectEnrichment(req.auth!.tenantId,req.auth!.userId,z.string().uuid().parse(req.params.id));
    res.status(202).json(job);
    if(process.env.GROWTHOS_SMOKE_TEST!=='true')void tickProspectEnrichments().catch(()=>{});
  }catch(error){next(error);}
});
router.use((error:unknown,_req:any,res:any,_next:any)=>{
  if(error instanceof z.ZodError){res.status(400).json({error:'Paramètres d’enrichissement invalides.'});return;}
  if(error instanceof CloudBrowserError){res.status(error.status).json({error:error.message});return;}
  res.status(503).json({error:'Enrichissement temporairement indisponible.'});
});
export default router;
