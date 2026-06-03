import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth";
import { knowledgeService } from "../../../lib/plugin-knowledge-base/KnowledgeService";

const router = Router();

// GET /knowledge — list articles (with optional ?category=&tag= filters)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { category, tag, limit, offset } = req.query as Record<string, string>;
    const result = await knowledgeService.listArticles(req.auth!.tenantId, {
      category: category || undefined,
      tag: tag || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /knowledge/stats — article count by category
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await knowledgeService.getStats(req.auth!.tenantId);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /knowledge/search?q=... — semantic/keyword search
router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const articles = await knowledgeService.searchArticles(q, req.auth!.tenantId);
    res.json(articles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /knowledge/:id — full article detail
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const article = await knowledgeService.getById(req.params.id, req.auth!.tenantId);
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /knowledge — create new article (triggers auto-indexing)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, content, category, tags } = req.body;
    if (!title || !content || !category) {
      return res.status(400).json({ error: "title, content, and category are required" });
    }
    const article = await knowledgeService.createArticle({
      title,
      content,
      category,
      tags: tags ?? [],
      createdBy: req.auth!.userId,
      tenantId: req.auth!.tenantId,
    });
    res.status(201).json(article);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /knowledge/:id — update article
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const article = await knowledgeService.updateArticle(req.params.id, req.auth!.tenantId, req.body);
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /knowledge/:id — delete article
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await knowledgeService.deleteArticle(req.params.id, req.auth!.tenantId);
    if (!deleted) return res.status(404).json({ error: "Article not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
