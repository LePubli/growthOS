import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Plus, ToggleLeft, ToggleRight, Trash2, CheckCircle,
  XCircle, Clock, ChevronRight, AlertCircle, Zap, ListFilter
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

interface AutopilotRule {
  id: string;
  name: string;
  triggerEvent: string;
  conditionJson: Record<string, any>;
  actionType: string;
  actionConfig: Record<string, any>;
  isActive: boolean;
  createdAt: string;
}

interface AutopilotLog {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerEvent: string;
  executionResult: 'success' | 'error' | 'skipped';
  resultDetails: Record<string, any>;
  createdAt: string;
}

interface MetaItem { value: string; label: string; description: string; configSchema?: Record<string, string> }
interface Meta { triggerEvents: MetaItem[]; actionTypes: MetaItem[] }

const TRIGGER_LABELS: Record<string, string> = {
  'signal.received':     'Signal reçu',
  'erep.alert':          'Alerte e-réputation',
  'deal.stage_changed':  'Changement de stage',
  'prospect.created':    'Nouveau prospect',
  'sequence.email.sent': 'Email de séquence envoyé',
  'meeting.completed':   'Réunion terminée',
};

const ACTION_LABELS: Record<string, string> = {
  'create_task':          'Créer une tâche',
  'send_notification':    'Envoyer une notification',
  'generate_draft_email': 'Générer un draft email',
  'add_tag':              'Ajouter un tag',
  'update_deal_score':    'Modifier le score deal',
};

const RESULT_ICON = {
  success: <CheckCircle size={14} className="text-green-400" />,
  error:   <XCircle size={14} className="text-red-400" />,
  skipped: <Clock size={14} className="text-gray-400" />,
};

const RESULT_COLOR = {
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  error:   'bg-red-500/10 text-red-400 border-red-500/20',
  skipped: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const DEFAULT_ACTION_CONFIGS: Record<string, Record<string, any>> = {
  create_task:          { title: 'Tâche — {{company}}', priority: 'medium', dueDays: 2 },
  send_notification:    { title: 'Alerte Autopilot', message: 'Événement {{type}} détecté' },
  generate_draft_email: { subject: 'Sujet pour {{company}}', tone: 'professionnel' },
  add_tag:              { tag: 'autopilot' },
  update_deal_score:    { delta: 10 },
};

function WizardModal({ meta, onClose, onSave }: {
  meta: Meta;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    triggerEvent: meta.triggerEvents[0]?.value ?? '',
    conditionJson: {},
    actionType: meta.actionTypes[0]?.value ?? '',
    actionConfig: DEFAULT_ACTION_CONFIGS[meta.actionTypes[0]?.value ?? ''] ?? {},
  });

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleActionChange = (actionType: string) => {
    setForm(f => ({ ...f, actionType, actionConfig: DEFAULT_ACTION_CONFIGS[actionType] ?? {} }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Donnez un nom à la règle'); return; }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 p-6 border-b border-white/10">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${step === s ? 'bg-purple-600 text-white' : step > s ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                {step > s ? <CheckCircle size={14} /> : s}
              </div>
              {s < 3 && <ChevronRight size={14} className="text-gray-600" />}
            </div>
          ))}
          <div className="ml-auto text-sm text-gray-400">
            {step === 1 ? 'Déclencheur' : step === 2 ? 'Action' : 'Finaliser'}
          </div>
        </div>

        <div className="p-6">
          {/* Étape 1 — Déclencheur */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap size={16} className="text-yellow-400" /> Choisir le déclencheur
              </h3>
              <div className="space-y-2">
                {meta.triggerEvents.map(ev => (
                  <label key={ev.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${form.triggerEvent === ev.value ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'}`}>
                    <input
                      type="radio"
                      name="triggerEvent"
                      value={ev.value}
                      checked={form.triggerEvent === ev.value}
                      onChange={() => setForm(f => ({ ...f, triggerEvent: ev.value }))}
                      className="mt-0.5 accent-purple-500"
                    />
                    <div>
                      <div className="font-medium text-sm">{ev.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{ev.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Étape 2 — Action */}
          {step === 2 && (
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Bot size={16} className="text-purple-400" /> Choisir l'action
              </h3>
              <div className="space-y-2 mb-4">
                {meta.actionTypes.map(ac => (
                  <label key={ac.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${form.actionType === ac.value ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20'}`}>
                    <input
                      type="radio"
                      name="actionType"
                      value={ac.value}
                      checked={form.actionType === ac.value}
                      onChange={() => handleActionChange(ac.value)}
                      className="mt-0.5 accent-purple-500"
                    />
                    <div>
                      <div className="font-medium text-sm">{ac.label}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Config rapide */}
              {form.actionType === 'create_task' && (
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <label className="block text-xs text-gray-400 mb-1">Titre de la tâche</label>
                  <input
                    value={form.actionConfig.title ?? ''}
                    onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, title: e.target.value } }))}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    placeholder="Tâche — {{company}}"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Priorité</label>
                      <select
                        value={form.actionConfig.priority ?? 'medium'}
                        onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, priority: e.target.value } }))}
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="low" className="bg-gray-900">Basse</option>
                        <option value="medium" className="bg-gray-900">Moyenne</option>
                        <option value="high" className="bg-gray-900">Haute</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Échéance (jours)</label>
                      <input
                        type="number"
                        value={form.actionConfig.dueDays ?? 2}
                        onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, dueDays: Number(e.target.value) } }))}
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        min={1} max={30}
                      />
                    </div>
                  </div>
                </div>
              )}

              {form.actionType === 'send_notification' && (
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Titre</label>
                    <input
                      value={form.actionConfig.title ?? ''}
                      onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, title: e.target.value } }))}
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Message</label>
                    <input
                      value={form.actionConfig.message ?? ''}
                      onChange={e => setForm(f => ({ ...f, actionConfig: { ...f.actionConfig, message: e.target.value } }))}
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      placeholder="Événement {{type}} détecté pour {{company}}"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Étape 3 — Finaliser */}
          {step === 3 && (
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" /> Finaliser la règle
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom de la règle</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  placeholder="Ex: Tâche quand signal reçu"
                />
              </div>
              <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28">Déclencheur</span>
                  <span className="text-white font-medium">{TRIGGER_LABELS[form.triggerEvent] ?? form.triggerEvent}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28">Action</span>
                  <span className="text-white font-medium">{ACTION_LABELS[form.actionType] ?? form.actionType}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-white/10">
          <button onClick={step === 1 ? onClose : handleBack} className="text-sm text-gray-400 hover:text-white transition-colors">
            {step === 1 ? 'Annuler' : '← Retour'}
          </button>
          {step < 3 ? (
            <button onClick={handleNext} className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              Suivant →
            </button>
          ) : (
            <button onClick={handleSubmit} className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              Créer la règle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AutopilotPage() {
  const qc = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['autopilot-rules'],
    queryFn: () => apiClient.get('/autopilot/rules').then(r => r.json()),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['autopilot-logs'],
    queryFn: () => apiClient.get('/autopilot/logs?limit=50').then(r => r.json()),
    enabled: activeTab === 'logs',
  });

  const { data: meta } = useQuery<Meta>({
    queryKey: ['autopilot-meta'],
    queryFn: () => apiClient.get('/autopilot/meta').then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/autopilot/rules/${id}`, { isActive }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autopilot-rules'] }),
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/autopilot/rules/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['autopilot-rules'] }); toast.success('Règle supprimée'); },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/autopilot/rules', data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autopilot-rules'] });
      setShowWizard(false);
      toast.success('Règle créée avec succès');
    },
    onError: () => toast.error('Erreur lors de la création'),
  });

  const rules: AutopilotRule[] = rulesData?.rules ?? [];
  const logs: AutopilotLog[] = logsData?.logs ?? [];
  const activeCount = rules.filter(r => r.isActive).length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Bot size={20} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Agents Autopilot</h1>
            <p className="text-gray-400 text-sm">
              {activeCount} règle{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
              {' '}· Automatisez vos actions commerciales en réponse aux événements IA
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-purple-600/20"
        >
          <Plus size={16} /> Ajouter une règle
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'rules' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Bot size={14} /> Règles ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'logs' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <ListFilter size={14} /> Historique
        </button>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div>
          {rulesLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Bot size={20} className="animate-pulse mr-2" /> Chargement…
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/15 rounded-2xl">
              <Bot size={48} className="text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Aucune règle autopilot</h3>
              <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                Créez votre première règle pour automatiser des actions en réponse aux signaux IA, alertes e-réputation ou changements de pipeline.
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={15} /> Créer ma première règle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.id} className={`bg-white/5 border rounded-xl p-4 flex items-center gap-4 transition-all
                  ${rule.isActive ? 'border-white/15 hover:border-purple-500/30' : 'border-white/8 opacity-60'}`}>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                    className="shrink-0 transition-colors"
                    title={rule.isActive ? 'Désactiver' : 'Activer'}
                  >
                    {rule.isActive
                      ? <ToggleRight size={28} className="text-purple-400" />
                      : <ToggleLeft size={28} className="text-gray-600" />
                    }
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-white truncate">{rule.name}</span>
                      {rule.isActive && (
                        <span className="shrink-0 text-xs bg-green-500/15 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Actif</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Zap size={11} className="text-yellow-400" />
                        {TRIGGER_LABELS[rule.triggerEvent] ?? rule.triggerEvent}
                      </span>
                      <span>→</span>
                      <span className="flex items-center gap-1">
                        <Bot size={11} className="text-purple-400" />
                        {ACTION_LABELS[rule.actionType] ?? rule.actionType}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div>
          {logsLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <ListFilter size={20} className="animate-pulse mr-2" /> Chargement…
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/15 rounded-2xl">
              <AlertCircle size={40} className="text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Aucune exécution</h3>
              <p className="text-gray-500 text-sm">Les logs apparaîtront ici dès qu'une règle sera déclenchée.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                  <div className="shrink-0">
                    {RESULT_ICON[log.executionResult]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-white truncate">{log.ruleName ?? 'Règle supprimée'}</span>
                      <span className={`text-xs border px-1.5 py-0.5 rounded-full ${RESULT_COLOR[log.executionResult]}`}>
                        {log.executionResult === 'success' ? 'Succès' : log.executionResult === 'error' ? 'Erreur' : 'Ignoré'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {TRIGGER_LABELS[log.triggerEvent] ?? log.triggerEvent}
                      {log.resultDetails?.action && ` → ${ACTION_LABELS[log.resultDetails.action] ?? log.resultDetails.action}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-gray-600">
                    {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wizard Modal */}
      {showWizard && meta && (
        <WizardModal
          meta={meta}
          onClose={() => setShowWizard(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}
