import { useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

export function EditNote({ note, onSaved }: {
  note: { id: string; title: string; description?: string | null };
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  if (!editing) return <button type="button" className="text-xs text-teal-700"
    onClick={() => { setTitle(note.title); setBody(note.description || ''); setEditing(true); }}>Modifier</button>;
  return <form className="grid gap-2" onSubmit={async event => {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await apiClient.patch(`/activities/${note.id}`, { title: title.trim(), description: body });
      setEditing(false);
      onSaved();
    } catch { toast.error('La note n’a pas pu être enregistrée.'); }
    finally { setSaving(false); }
  }}>
    <input aria-label="Titre de la note" required value={title} onChange={e => setTitle(e.target.value)} />
    <textarea aria-label="Contenu de la note" value={body} onChange={e => setBody(e.target.value)} />
    <div className="flex gap-2 text-xs"><button disabled={saving}>Enregistrer</button>
      <button type="button" disabled={saving} onClick={() => setEditing(false)}>Annuler</button></div>
  </form>;
}
