import { useEffect, useRef, useState } from 'react';

export default function HtmlRichTextEditor({
  label,
  value = '',
  onChange,
  disabled = false,
  required = false,
  minHeight = '220px',
  className = '',
}) {
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState(value || '');
  const editorRef = useRef(null);
  const loadedContent = useRef(value || '');
  const pendingVisualHtml = useRef(null);

  useEffect(() => {
    const next = value || '';
    if (showSource) {
      setSource(next);
      loadedContent.current = next;
      return;
    }
    if (loadedContent.current === next) return;
    loadedContent.current = next;
    setSource(next);
    if (editorRef.current) {
      editorRef.current.innerHTML = next;
    }
  }, [value, showSource]);

  useEffect(() => {
    if (showSource) return undefined;
    const frame = requestAnimationFrame(() => {
      if (!editorRef.current) return;
      const html = pendingVisualHtml.current ?? source ?? '';
      pendingVisualHtml.current = null;
      editorRef.current.innerHTML = html;
      loadedContent.current = html;
      setSource(html);
    });
    return () => cancelAnimationFrame(frame);
  }, [showSource]);

  const emitChange = (html) => {
    loadedContent.current = html;
    onChange?.(html);
  };

  const syncFromEditor = () => {
    const html = editorRef.current?.innerHTML ?? '';
    setSource(html);
    emitChange(html);
  };

  const execFormat = (command, formatValue = null) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, formatValue);
    syncFromEditor();
  };

  const toggleSource = () => {
    if (disabled) return;
    if (!showSource) {
      const html = editorRef.current?.innerHTML ?? source;
      setSource(html);
      loadedContent.current = html;
      emitChange(html);
      setShowSource(true);
      return;
    }
    pendingVisualHtml.current = source;
    setShowSource(false);
  };

  return (
    <div className={`html-rich-text-editor ${className}`.trim()}>
      {label ? (
        <label className="form-label">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
      ) : null}
      <div className="btn-toolbar gap-1 mb-2 border rounded p-2 bg-light flex-wrap">
        {!showSource && (
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => execFormat('bold')} title="Bold"><strong>B</strong></button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => execFormat('italic')} title="Italic"><em>I</em></button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => execFormat('underline')} title="Underline"><u>U</u></button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => execFormat('formatBlock', 'h2')} title="Heading 2">H2</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => execFormat('formatBlock', 'h3')} title="Heading 3">H3</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => execFormat('insertUnorderedList')} title="Bullet list">• List</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => execFormat('insertOrderedList')} title="Numbered list">1. List</button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={disabled}
              onClick={() => {
                const url = window.prompt('Link URL');
                if (url) execFormat('createLink', url);
              }}
              title="Insert link"
            >
              Link
            </button>
          </>
        )}
        <button type="button" className="btn btn-sm btn-outline-primary ms-auto" disabled={disabled} onClick={toggleSource}>
          {showSource ? 'Visual editor' : 'HTML source'}
        </button>
      </div>
      {showSource ? (
        <textarea
          className="form-control font-monospace html-rich-source"
          rows={12}
          value={source}
          disabled={disabled}
          onChange={(e) => {
            const html = e.target.value;
            setSource(html);
            loadedContent.current = html;
            emitChange(html);
          }}
        />
      ) : (
        <div
          ref={editorRef}
          className={`form-control html-rich-editor-surface${disabled ? ' is-disabled' : ''}`}
          contentEditable={!disabled}
          suppressContentEditableWarning
          style={{ minHeight }}
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
        />
      )}
    </div>
  );
}
