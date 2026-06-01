import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Link, AlignLeft, AlignCenter, AlignRight, Minus, Code, Eye, EyeOff,
  Undo, Redo, Type,
} from 'lucide-react';

/* ─────────────────────────── types ─────────────────────────── */

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  variables?: { key: string; label: string }[];
}

/* ─────────────────────────── fake preview data ─────────────────────────── */

const PREVIEW_DATA: Record<string, string> = {
  first_name: 'Jean',
  last_name: 'Dupont',
  company: 'Acme SAS',
  job_title: 'Directeur Commercial',
  sender_name: 'Alice Martin',
  unsubscribe_link: '#',
  website: 'https://acme.fr',
  phone: '+33 6 12 34 56 78',
};

function substituteVars(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = PREVIEW_DATA[key];
    return val ? `<span style="background:#EDE9FE;color:#6D28D9;padding:1px 4px;border-radius:4px;font-size:inherit">${val}</span>` : `<span style="background:#FEE2E2;color:#DC2626;padding:1px 4px;border-radius:4px">{{${key}}}</span>`;
  });
}

/* ─────────────────────────── toolbar button ─────────────────────────── */

function Btn({ onClick, title, active, children }: {
  onClick: () => void; title: string; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        padding: '5px 7px',
        borderRadius: 7,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--color-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        transition: 'background .1s,color .1s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--body-bg)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'var(--card-border)', margin: '0 3px', flexShrink: 0 }} />;
}

/* ─────────────────────────── link dialog ─────────────────────────── */

function LinkDialog({ onInsert, onClose }: { onInsert: (url: string, text: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState('');
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 14, boxShadow: '0 8px 24px rgba(0,0,0,.15)', width: 280, marginTop: 4 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Texte du lien</label>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Cliquez ici"
          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--body-bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://"
          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--body-bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onMouseDown={e => { e.preventDefault(); onClose(); }}
          style={{ flex: 1, padding: '6px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
          Annuler
        </button>
        <button onMouseDown={e => { e.preventDefault(); onInsert(url, text); }}
          style={{ flex: 1, padding: '6px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Insérer
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── main component ─────────────────────────── */

export default function EmailEditor({ value, onChange, placeholder = 'Rédigez votre email…', minHeight = 260, variables }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'wysiwyg' | 'html' | 'preview'>('wysiwyg');
  const [htmlSource, setHtmlSource] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  /* ── sync value → editor (only when mode switches) */
  useEffect(() => {
    if (mode === 'wysiwyg' && editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    if (mode === 'html') setHtmlSource(value || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* ── initial mount */
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = value || '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── detect active formats on selection change */
  const updateFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
    });
  }, []);

  /* ── execCommand wrapper */
  const exec = useCallback((cmd: string, value?: string) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    updateFormats();
  }, [onChange, updateFormats]);

  /* ── save selection before link dialog opens */
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) setSavedRange(sel.getRangeAt(0).cloneRange());
  };

  /* ── restore selection */
  const restoreSelection = () => {
    if (savedRange && editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(savedRange); }
    }
  };

  /* ── insert variable at cursor */
  const insertVariable = (varKey: string) => {
    if (mode !== 'wysiwyg') return;
    if (editorRef.current) editorRef.current.focus();
    const token = `{{${varKey}}}`;
    document.execCommand('insertHTML', false,
      `<span style="background:#EDE9FE;color:#6D28D9;padding:1px 5px;border-radius:5px;font-size:inherit;font-family:inherit" contenteditable="false" data-var="${varKey}">${token}</span>&nbsp;`
    );
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  /* ── link insert */
  const insertLink = (url: string, text: string) => {
    restoreSelection();
    const displayText = text || url;
    document.execCommand('insertHTML', false,
      `<a href="${url}" style="color:#6D28D9;text-decoration:underline">${displayText}</a>`
    );
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setShowLinkDialog(false);
  };

  /* ── toolbar heading */
  const setHeading = (tag: string) => {
    exec('formatBlock', tag);
  };

  const DEFAULT_VARS = variables || [
    { key: 'first_name', label: 'Prénom' },
    { key: 'last_name', label: 'Nom' },
    { key: 'company', label: 'Entreprise' },
    { key: 'job_title', label: 'Poste' },
    { key: 'sender_name', label: 'Expéditeur' },
    { key: 'unsubscribe_link', label: 'Désabonnement' },
  ];

  const containerStyle: React.CSSProperties = {
    border: '1.5px solid var(--card-border)',
    borderRadius: 14,
    overflow: 'hidden',
    background: 'var(--card-bg)',
  };

  /* ─── toolbar ─── */
  const Toolbar = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px',
      borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)',
      flexWrap: 'wrap', position: 'relative',
    }}>
      {/* Undo/Redo */}
      <Btn onClick={() => exec('undo')} title="Annuler"><Undo size={13} /></Btn>
      <Btn onClick={() => exec('redo')} title="Rétablir"><Redo size={13} /></Btn>
      <Sep />

      {/* Heading */}
      <Btn onClick={() => setHeading('h2')} title="Titre 1"><span style={{ fontSize: 11, fontWeight: 700 }}>H2</span></Btn>
      <Btn onClick={() => setHeading('h3')} title="Titre 2"><span style={{ fontSize: 11, fontWeight: 700 }}>H3</span></Btn>
      <Btn onClick={() => setHeading('p')} title="Paragraphe"><Type size={13} /></Btn>
      <Sep />

      {/* Inline formatting */}
      <Btn onClick={() => exec('bold')} title="Gras" active={activeFormats.bold}><Bold size={13} /></Btn>
      <Btn onClick={() => exec('italic')} title="Italique" active={activeFormats.italic}><Italic size={13} /></Btn>
      <Btn onClick={() => exec('underline')} title="Souligné" active={activeFormats.underline}><Underline size={13} /></Btn>
      <Btn onClick={() => exec('strikeThrough')} title="Barré" active={activeFormats.strikeThrough}><Strikethrough size={13} /></Btn>
      <Sep />

      {/* Lists */}
      <Btn onClick={() => exec('insertUnorderedList')} title="Liste à puces" active={activeFormats.insertUnorderedList}><List size={13} /></Btn>
      <Btn onClick={() => exec('insertOrderedList')} title="Liste numérotée" active={activeFormats.insertOrderedList}><ListOrdered size={13} /></Btn>
      <Sep />

      {/* Alignment */}
      <Btn onClick={() => exec('justifyLeft')} title="Aligner à gauche" active={activeFormats.justifyLeft}><AlignLeft size={13} /></Btn>
      <Btn onClick={() => exec('justifyCenter')} title="Centrer" active={activeFormats.justifyCenter}><AlignCenter size={13} /></Btn>
      <Btn onClick={() => exec('justifyRight')} title="Aligner à droite" active={activeFormats.justifyRight}><AlignRight size={13} /></Btn>
      <Sep />

      {/* Link */}
      <div style={{ position: 'relative' }}>
        <Btn onClick={() => { saveSelection(); setShowLinkDialog(v => !v); }} title="Lien">
          <Link size={13} />
        </Btn>
        {showLinkDialog && (
          <LinkDialog onInsert={insertLink} onClose={() => setShowLinkDialog(false)} />
        )}
      </div>

      {/* Divider */}
      <Btn onClick={() => exec('insertHorizontalRule')} title="Séparateur"><Minus size={13} /></Btn>

      <div style={{ flex: 1 }} />

      {/* Mode switcher */}
      {(['wysiwyg', 'html', 'preview'] as const).map(m => (
        <button
          key={m}
          onMouseDown={e => { e.preventDefault(); setMode(m); }}
          style={{
            padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            background: mode === m ? 'var(--color-primary)' : 'transparent',
            color: mode === m ? '#fff' : 'var(--text-muted)',
            transition: 'background .1s,color .1s',
          }}>
          {m === 'wysiwyg' ? 'Éditer' : m === 'html' ? 'HTML' : 'Aperçu'}
        </button>
      ))}
    </div>
  );

  /* ─── variable chips ─── */
  const VarChips = (
    <div style={{ display: 'flex', gap: 4, padding: '6px 10px', borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 2 }}>Variables :</span>
      {DEFAULT_VARS.map(v => (
        <button
          key={v.key}
          onMouseDown={e => { e.preventDefault(); insertVariable(v.key); }}
          title={`Insérer ${v.label}`}
          style={{
            padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: '#EDE9FE', color: '#6D28D9', border: 'none',
            transition: 'opacity .1s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
          {`{{${v.key}}}`}
        </button>
      ))}
    </div>
  );

  return (
    <div style={containerStyle}>
      {Toolbar}

      {mode !== 'preview' && VarChips}

      {/* ── WYSIWYG ── */}
      {mode === 'wysiwyg' && (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
          onKeyUp={updateFormats}
          onMouseUp={updateFormats}
          onSelect={updateFormats}
          style={{
            minHeight,
            padding: '16px 18px',
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
          data-placeholder={placeholder}
          className="email-editor-body"
        />
      )}

      {/* ── HTML source ── */}
      {mode === 'html' && (
        <textarea
          value={htmlSource}
          onChange={e => setHtmlSource(e.target.value)}
          onBlur={() => onChange(htmlSource)}
          style={{
            width: '100%', minHeight, padding: '16px 18px', outline: 'none', resize: 'vertical',
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
            background: '#1E293B', color: '#94A3B8', border: 'none', boxSizing: 'border-box',
          }}
        />
      )}

      {/* ── Preview ── */}
      {mode === 'preview' && (
        <div style={{ padding: 16 }}>
          {/* Email client chrome */}
          <div style={{ borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: '8px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FC5F57' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
              <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Aperçu — boîte de réception</span>
            </div>
            <div style={{ padding: '20px 24px', minHeight: 200, fontSize: 14, lineHeight: 1.7, color: '#374151', fontFamily: 'Georgia, serif' }}
              dangerouslySetInnerHTML={{ __html: substituteVars(value || '') || '<p style="color:#9CA3AF;font-style:italic">Aucun contenu à afficher</p>' }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Les variables sont substituées avec des données de démonstration
          </div>
        </div>
      )}

      {/* ── Placeholder CSS ── */}
      <style>{`
        .email-editor-body:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
        .email-editor-body h2 { font-size: 1.25em; font-weight: 700; margin: .6em 0; }
        .email-editor-body h3 { font-size: 1.1em; font-weight: 700; margin: .5em 0; }
        .email-editor-body ul { list-style: disc; padding-left: 1.5em; margin: .5em 0; }
        .email-editor-body ol { list-style: decimal; padding-left: 1.5em; margin: .5em 0; }
        .email-editor-body a { color: #6D28D9; text-decoration: underline; }
        .email-editor-body hr { border: none; border-top: 1px solid var(--card-border); margin: 1em 0; }
        .email-editor-body p { margin: .3em 0; }
      `}</style>
    </div>
  );
}
