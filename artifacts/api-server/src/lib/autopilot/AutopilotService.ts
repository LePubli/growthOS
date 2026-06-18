/**
 * AutopilotService — Moteur de règles IA autonomes
 * Évalue les conditions d'une règle et exécute l'action correspondante.
 */

import { pool } from "@workspace/db";
import { logger } from "../logger";
import { pluginEventBus } from "../plugin-runtime/event-bus";

export type TriggerEvent =
  | "signal.received"
  | "erep.alert"
  | "deal.stage_changed"
  | "prospect.created"
  | "sequence.email.sent"
  | "meeting.completed";

export type ActionType =
  | "create_task"
  | "send_notification"
  | "generate_draft_email"
  | "add_tag"
  | "update_deal_score";

export interface AutopilotRule {
  id: string;
  tenantId: string;
  name: string;
  triggerEvent: TriggerEvent;
  conditionJson: Record<string, any>;
  actionType: ActionType;
  actionConfig: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutopilotLog {
  id: string;
  tenantId: string;
  ruleId: string;
  ruleName: string;
  triggerEvent: string;
  executionResult: "success" | "error" | "skipped";
  resultDetails: Record<string, any>;
  createdAt: string;
}

class AutopilotService {
  async getRules(tenantId: string): Promise<AutopilotRule[]> {
    const { rows } = await pool.query<AutopilotRule>(
      `SELECT id, tenant_id as "tenantId", name, trigger_event as "triggerEvent",
              condition_json as "conditionJson", action_type as "actionType",
              action_config as "actionConfig", is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM autopilot_rules
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows;
  }

  async getActiveRules(tenantId: string, triggerEvent: TriggerEvent): Promise<AutopilotRule[]> {
    const { rows } = await pool.query<AutopilotRule>(
      `SELECT id, tenant_id as "tenantId", name, trigger_event as "triggerEvent",
              condition_json as "conditionJson", action_type as "actionType",
              action_config as "actionConfig", is_active as "isActive",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM autopilot_rules
       WHERE tenant_id = $1 AND trigger_event = $2 AND is_active = true
       ORDER BY created_at ASC`,
      [tenantId, triggerEvent],
    );
    return rows;
  }

  async getLogs(tenantId: string, limit = 50): Promise<AutopilotLog[]> {
    const { rows } = await pool.query<AutopilotLog>(
      `SELECT l.id, l.tenant_id as "tenantId", l.rule_id as "ruleId",
              r.name as "ruleName", l.trigger_event as "triggerEvent",
              l.execution_result as "executionResult",
              l.result_details as "resultDetails",
              l.created_at as "createdAt"
       FROM autopilot_logs l
       LEFT JOIN autopilot_rules r ON r.id = l.rule_id
       WHERE l.tenant_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return rows;
  }

  async createRule(tenantId: string, data: {
    name: string;
    triggerEvent: TriggerEvent;
    conditionJson: Record<string, any>;
    actionType: ActionType;
    actionConfig: Record<string, any>;
  }): Promise<AutopilotRule> {
    const { rows } = await pool.query<AutopilotRule>(
      `INSERT INTO autopilot_rules (tenant_id, name, trigger_event, condition_json, action_type, action_config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id as "tenantId", name, trigger_event as "triggerEvent",
                 condition_json as "conditionJson", action_type as "actionType",
                 action_config as "actionConfig", is_active as "isActive",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [tenantId, data.name, data.triggerEvent, JSON.stringify(data.conditionJson), data.actionType, JSON.stringify(data.actionConfig)],
    );
    return rows[0];
  }

  async updateRule(tenantId: string, ruleId: string, data: Partial<{
    name: string;
    isActive: boolean;
    conditionJson: Record<string, any>;
    actionConfig: Record<string, any>;
  }>): Promise<AutopilotRule | null> {
    const fields: string[] = [];
    const values: any[] = [tenantId, ruleId];
    let idx = 3;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }
    if (data.conditionJson !== undefined) { fields.push(`condition_json = $${idx++}`); values.push(JSON.stringify(data.conditionJson)); }
    if (data.actionConfig !== undefined) { fields.push(`action_config = $${idx++}`); values.push(JSON.stringify(data.actionConfig)); }

    if (fields.length === 0) return null;
    fields.push(`updated_at = NOW()`);

    const { rows } = await pool.query<AutopilotRule>(
      `UPDATE autopilot_rules SET ${fields.join(", ")}
       WHERE tenant_id = $1 AND id = $2
       RETURNING id, tenant_id as "tenantId", name, trigger_event as "triggerEvent",
                 condition_json as "conditionJson", action_type as "actionType",
                 action_config as "actionConfig", is_active as "isActive",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    );
    return rows[0] ?? null;
  }

  async deleteRule(tenantId: string, ruleId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM autopilot_rules WHERE tenant_id = $1 AND id = $2`,
      [tenantId, ruleId],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Évalue les conditions d'une règle contre l'payload de l'événement */
  private matchesCondition(rule: AutopilotRule, eventPayload: Record<string, any>): boolean {
    const cond = rule.conditionJson;
    if (!cond || Object.keys(cond).length === 0) return true;

    for (const [key, expected] of Object.entries(cond)) {
      const actual = eventPayload[key];
      if (typeof expected === "object" && expected !== null) {
        if ("gte" in expected && !(actual >= expected.gte)) return false;
        if ("lte" in expected && !(actual <= expected.lte)) return false;
        if ("contains" in expected && !String(actual ?? "").toLowerCase().includes(String(expected.contains).toLowerCase())) return false;
      } else {
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  /** Exécute l'action d'une règle */
  private async executeAction(rule: AutopilotRule, eventPayload: Record<string, any>): Promise<{ ok: boolean; details: Record<string, any> }> {
    const cfg = rule.actionConfig;

    switch (rule.actionType) {
      case "create_task": {
        const title = (cfg.title ?? "Tâche autopilot").replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(eventPayload[k] ?? k));
        await pool.query(
          `INSERT INTO tasks (tenant_id, title, status, priority, due_date, created_by)
           VALUES ($1, $2, 'pending', $3, $4, NULL)`,
          [rule.tenantId, title, cfg.priority ?? "medium", cfg.dueDays ? `NOW() + INTERVAL '${Number(cfg.dueDays)} days'` : null],
        );
        return { ok: true, details: { action: "create_task", title } };
      }

      case "send_notification": {
        const message = (cfg.message ?? "Événement autopilot déclenché").replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(eventPayload[k] ?? k));
        await pool.query(
          `INSERT INTO notifications (tenant_id, type, title, body, is_read)
           VALUES ($1, 'autopilot', $2, $3, false)`,
          [rule.tenantId, cfg.title ?? "Autopilot", message],
        );
        pluginEventBus.emit("notification.created", { tenantId: rule.tenantId, message });
        return { ok: true, details: { action: "send_notification", message } };
      }

      case "generate_draft_email": {
        const subject = (cfg.subject ?? "Follow-up automatique").replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(eventPayload[k] ?? k));
        return { ok: true, details: { action: "generate_draft_email", subject, note: "Draft généré (intégration template à configurer)" } };
      }

      case "add_tag":
        return { ok: true, details: { action: "add_tag", tag: cfg.tag ?? "autopilot" } };

      case "update_deal_score":
        return { ok: true, details: { action: "update_deal_score", delta: cfg.delta ?? 10 } };

      default:
        return { ok: false, details: { error: `Action inconnue: ${rule.actionType}` } };
    }
  }

  /** Point d'entrée principal — appelé par l'AgentWorker */
  async evaluateAndExecute(event: TriggerEvent, tenantId: string, payload: Record<string, any>): Promise<void> {
    const rules = await this.getActiveRules(tenantId, event);
    if (rules.length === 0) return;

    for (const rule of rules) {
      let executionResult: "success" | "error" | "skipped" = "skipped";
      let resultDetails: Record<string, any> = {};

      try {
        if (!this.matchesCondition(rule, payload)) {
          executionResult = "skipped";
          resultDetails = { reason: "condition non remplie" };
        } else {
          const res = await this.executeAction(rule, payload);
          executionResult = res.ok ? "success" : "error";
          resultDetails = res.details;
        }
      } catch (err: any) {
        executionResult = "error";
        resultDetails = { error: err.message };
        logger.error({ err, ruleId: rule.id }, "AutopilotService: action failed");
      }

      // Persister le log
      await pool.query(
        `INSERT INTO autopilot_logs (tenant_id, rule_id, trigger_event, execution_result, result_details)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, rule.id, event, executionResult, JSON.stringify(resultDetails)],
      ).catch(e => logger.warn({ e }, "AutopilotService: log insert failed"));

      logger.debug({ ruleId: rule.id, event, executionResult }, "AutopilotService: rule evaluated");
    }
  }
}

export const autopilotService = new AutopilotService();
