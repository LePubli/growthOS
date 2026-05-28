/**
 * ============================================================
 * GrowthOS UI Slots System
 * ============================================================
 * Composants placeholder où les plugins injectent leurs UIs
 * 
 * Architecture:
 * 1. Slots définis dans le core avec props type-safe
 * 2. Plugins enregistrent leurs composants via registry
 * 3. Rendu dynamique conditionnel selon activation
 * 4. Support multiple plugins par slot (ordre configurable)
 */

'use client';

import React, { ReactNode } from 'react';
import { usePluginRegistry } from './registry';

// ── Types de Slots ───────────────────────────────────────────────

export interface DashboardSlotProps {
  tenantId: string;
  userId: string;
}

export interface ProspectActionsSlotProps {
  prospectId: string;
  tenantId: string;
  prospect: any;
}

export interface PipelineExtensionSlotProps {
  dealId: string;
  tenantId: string;
  stage: string;
}

export interface SequenceExtensionSlotProps {
  sequenceId: string;
  tenantId: string;
}

export interface ProspectListToolbarSlotProps {
  selectedCount: number;
  total: number;
  filters: any;
}

// ── Type pour les composants injectés par plugins ────────────────

interface PluginUIComponent<P = any> {
  component: React.ComponentType<P>;
  order?: number;
  pluginName: string;
}

// ── Registry des composants UI par slot ──────────────────────────

const slotRegistry: Record<string, PluginUIComponent[]> = {
  'dashboard-top': [],
  'dashboard-sidebar': [],
  'prospect-actions': [],
  'prospect-list-toolbar': [],
  'pipeline-extension': [],
  'sequence-extension': [],
};

/**
 * Enregistrer un composant UI pour un slot
 * À appeler depuis l'initialisation du plugin
 */
export function registerUIComponent<P>(
  slotName: string,
  component: React.ComponentType<P>,
  options: { order?: number; pluginName: string }
): void {
  if (!slotRegistry[slotName]) {
    slotRegistry[slotName] = [];
    console.warn(`[UI Slots] Slot "${slotName}" n'existe pas, création automatique`);
  }
  
  slotRegistry[slotName].push({
    component: component as any,
    order: options.order ?? 100,
    pluginName: options.pluginName,
  });

  // Trier par ordre
  slotRegistry[slotName].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

// ── Composants Slot Core ─────────────────────────────────────────

interface DashboardSlotProps {
  tenantId: string;
  userId: string;
}

export function DashboardSlot({ tenantId, userId }: DashboardSlotProps) {
  const components = slotRegistry['dashboard-top'] || [];
  
  if (components.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
      {components.map(({ component: Component, pluginName }) => (
        <Component key={pluginName} tenantId={tenantId} userId={userId} />
      ))}
    </div>
  );
}

interface ProspectActionsSlotProps {
  prospectId: string;
  tenantId: string;
  prospect: any;
}

export function ProspectActionsSlot({ prospectId, tenantId, prospect }: ProspectActionsSlotProps) {
  const components = slotRegistry['prospect-actions'] || [];
  
  if (components.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {components.map(({ component: Component, pluginName }) => (
        <Component 
          key={pluginName} 
          prospectId={prospectId} 
          tenantId={tenantId} 
          prospect={prospect} 
        />
      ))}
    </div>
  );
}

interface ProspectListToolbarSlotProps {
  selectedCount: number;
  total: number;
  filters: any;
}

export function ProspectListToolbarSlot({ selectedCount, total, filters }: ProspectListToolbarSlotProps) {
  const components = slotRegistry['prospect-list-toolbar'] || [];
  
  if (components.length === 0) return null;

  return (
    <div className="flex items-center gap-2 py-2 border-t border-b border-gray-100">
      {components.map(({ component: Component, pluginName }) => (
        <Component 
          key={pluginName} 
          selectedCount={selectedCount} 
          total={total} 
          filters={filters} 
        />
      ))}
    </div>
  );
}

interface PipelineExtensionSlotProps {
  dealId: string;
  tenantId: string;
  stage: string;
}

export function PipelineExtensionSlot({ dealId, tenantId, stage }: PipelineExtensionSlotProps) {
  const components = slotRegistry['pipeline-extension'] || [];
  
  if (components.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {components.map(({ component: Component, pluginName }) => (
        <Component 
          key={pluginName} 
          dealId={dealId} 
          tenantId={tenantId} 
          stage={stage} 
        />
      ))}
    </div>
  );
}

interface SequenceExtensionSlotProps {
  sequenceId: string;
  tenantId: string;
}

export function SequenceExtensionSlot({ sequenceId, tenantId }: SequenceExtensionSlotProps) {
  const components = slotRegistry['sequence-extension'] || [];
  
  if (components.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
      {components.map(({ component: Component, pluginName }) => (
        <Component 
          key={pluginName} 
          sequenceId={sequenceId} 
          tenantId={tenantId} 
        />
      ))}
    </div>
  );
}

// ── Hook pour utiliser les slots dynamiquement ───────────────────

export function useSlotComponents(slotName: string) {
  const { activePlugins } = usePluginRegistry();
  
  const components = slotRegistry[slotName] || [];
  
  // Filtrer uniquement les plugins actifs
  const activeComponents = components.filter(c => activePlugins.has(c.pluginName));

  return activeComponents;
}

// ── Helper pour rendre un slot custom ────────────────────────────

export function renderSlot<P extends object>(slotName: string, props: P): ReactNode {
  const components = slotRegistry[slotName] || [];
  
  if (components.length === 0) return null;

  return components.map(({ component: Component, pluginName }) => (
    <Component key={pluginName} {...props} />
  ));
}

// ── Exports ──────────────────────────────────────────────────────

export const UISlots = {
  register: registerUIComponent,
  render: renderSlot,
  Dashboard: DashboardSlot,
  ProspectActions: ProspectActionsSlot,
  ProspectListToolbar: ProspectListToolbarSlot,
  PipelineExtension: PipelineExtensionSlot,
  SequenceExtension: SequenceExtensionSlot,
};

export default UISlots;
