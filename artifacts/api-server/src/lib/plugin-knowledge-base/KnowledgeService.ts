import { pool } from "@workspace/db";
import { memoryService } from "../plugin-growth-memory/MemoryService";
import { logger } from "../logger";

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: "playbook" | "objection" | "script" | "procedure" | "faq";
  tags: string[];
  createdBy: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleInput {
  title: string;
  content: string;
  category: KnowledgeArticle["category"];
  tags?: string[];
  createdBy?: string;
  tenantId: string;
}

class KnowledgeService {
  async createArticle(data: CreateArticleInput): Promise<KnowledgeArticle> {
    const result = await pool.query<KnowledgeArticle>(
      `INSERT INTO knowledge_articles (title, content, category, tags, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id, title, content, category, tags,
         created_by  AS "createdBy",
         tenant_id   AS "tenantId",
         created_at  AS "createdAt",
         updated_at  AS "updatedAt"`,
      [
        data.title,
        data.content,
        data.category,
        data.tags ?? [],
        data.createdBy ?? null,
        data.tenantId,
      ],
    );

    const article = result.rows[0];

    try {
      await memoryService.indexDocument({
        sourceType: "knowledge_base",
        sourceId: article.id,
        content: `[${data.category.toUpperCase()}] ${data.title}\n\n${data.content}`,
        tenantId: data.tenantId,
        metadata: {
          articleId: article.id,
          title: data.title,
          category: data.category,
          tags: data.tags ?? [],
        },
      });
      logger.info({ articleId: article.id }, "Knowledge article indexed in memory");
    } catch (err) {
      logger.warn({ err, articleId: article.id }, "Failed to index knowledge article in memory — article saved anyway");
    }

    return article;
  }

  async updateArticle(
    id: string,
    tenantId: string,
    data: Partial<Omit<CreateArticleInput, "tenantId" | "createdBy">>,
  ): Promise<KnowledgeArticle | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined)   { sets.push(`title    = $${idx++}`); values.push(data.title); }
    if (data.content !== undefined) { sets.push(`content  = $${idx++}`); values.push(data.content); }
    if (data.category !== undefined){ sets.push(`category = $${idx++}`); values.push(data.category); }
    if (data.tags !== undefined)    { sets.push(`tags     = $${idx++}`); values.push(data.tags); }
    if (sets.length === 0) return this.getById(id, tenantId);

    sets.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const result = await pool.query<KnowledgeArticle>(
      `UPDATE knowledge_articles
       SET ${sets.join(", ")}
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING
         id, title, content, category, tags,
         created_by AS "createdBy",
         tenant_id  AS "tenantId",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      values,
    );

    if (!result.rows[0]) return null;
    const article = result.rows[0];

    try {
      await memoryService.indexDocument({
        sourceType: "knowledge_base",
        sourceId: article.id,
        content: `[${article.category.toUpperCase()}] ${article.title}\n\n${article.content}`,
        tenantId,
        metadata: { articleId: article.id, title: article.title, category: article.category, tags: article.tags },
      });
    } catch (err) {
      logger.warn({ err, articleId: article.id }, "Failed to re-index updated knowledge article");
    }

    return article;
  }

  async getById(id: string, tenantId: string): Promise<KnowledgeArticle | null> {
    const result = await pool.query<KnowledgeArticle>(
      `SELECT id, title, content, category, tags,
              created_by AS "createdBy",
              tenant_id  AS "tenantId",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM knowledge_articles
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async listArticles(
    tenantId: string,
    opts: { category?: string; tag?: string; limit?: number; offset?: number } = {},
  ): Promise<{ articles: KnowledgeArticle[]; total: number }> {
    const conditions = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (opts.category) { conditions.push(`category = $${idx++}`); values.push(opts.category); }
    if (opts.tag)      { conditions.push(`$${idx++} = ANY(tags)`); values.push(opts.tag); }

    const where = conditions.join(" AND ");
    const limit  = opts.limit  ?? 50;
    const offset = opts.offset ?? 0;

    const [dataRes, countRes] = await Promise.all([
      pool.query<KnowledgeArticle>(
        `SELECT id, title, content, category, tags,
                created_by AS "createdBy",
                tenant_id  AS "tenantId",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
         FROM knowledge_articles
         WHERE ${where}
         ORDER BY updated_at DESC
         LIMIT $${idx++} OFFSET $${idx}`,
        [...values, limit, offset],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM knowledge_articles WHERE ${where}`,
        values,
      ),
    ]);

    return {
      articles: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
    };
  }

  async searchArticles(query: string, tenantId: string): Promise<KnowledgeArticle[]> {
    if (!query.trim()) {
      const res = await this.listArticles(tenantId, { limit: 20 });
      return res.articles;
    }
    const result = await pool.query<KnowledgeArticle>(
      `SELECT id, title, content, category, tags,
              created_by AS "createdBy",
              tenant_id  AS "tenantId",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM knowledge_articles
       WHERE tenant_id = $1
         AND (title ILIKE $2 OR content ILIKE $2 OR $3 = ANY(tags))
       ORDER BY updated_at DESC
       LIMIT 30`,
      [tenantId, `%${query}%`, query.toLowerCase()],
    );
    return result.rows;
  }

  async deleteArticle(id: string, tenantId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM knowledge_articles WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(tenantId: string): Promise<Record<string, number>> {
    const result = await pool.query<{ category: string; count: string }>(
      `SELECT category, COUNT(*) AS count FROM knowledge_articles WHERE tenant_id = $1 GROUP BY category`,
      [tenantId],
    );
    const stats: Record<string, number> = {};
    for (const row of result.rows) stats[row.category] = parseInt(row.count, 10);
    return stats;
  }
}

export const knowledgeService = new KnowledgeService();
