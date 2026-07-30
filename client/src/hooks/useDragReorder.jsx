import { useState } from 'react';

/**
 * Native HTML5 drag-and-drop row reordering for editable CRUD tables.
 *
 * The array is left untouched for the whole gesture — dragIndex/overIndex only
 * drive CSS highlighting — and the actual splice + `orderKey` renumbering
 * (1..N) happens exactly once, on drop. Reordering the array on every
 * dragover (the first version of this hook) forced React to reconcile the
 * DOM while the browser's native drag was still in progress; for rows keyed
 * by array index that unmounted/remounted the exact node being dragged and
 * killed the gesture, and even for stably-keyed rows, moving the dragged
 * node in the tree mid-drag is unreliable across browsers. Committing once
 * on drop keeps the DOM fully stable until the gesture is already over.
 *
 * Usage: spread `dragHandleProps(i)` onto the small grip element that starts
 * the drag, and `rowDropProps(i)` + `rowClassName(i)` onto the row itself.
 */
export function useDragReorder(items, setItems, { orderKey = 'order' } = {}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const commit = (from, to) => {
    if (from === null || to === null || from === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return orderKey ? next.map((row, idx) => ({ ...row, [orderKey]: idx + 1 })) : next;
    });
  };

  const dragHandleProps = (i) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragIndex(i);
      // Firefox refuses to start a native drag at all unless dataTransfer
      // carries data set during dragstart — harmless elsewhere.
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* Safari/older browsers: ignore */ }
    },
    onDragEnd: endDrag,
  });

  const rowDropProps = (i) => ({
    onDragOver: (e) => {
      e.preventDefault();
      if (overIndex !== i) setOverIndex(i);
    },
    onDrop: (e) => {
      e.preventDefault();
      commit(dragIndex, i);
      endDrag();
    },
  });

  const rowClassName = (i) => [
    dragIndex === i && 'cis-dnd-row-dragging',
    overIndex === i && dragIndex !== null && dragIndex !== i && 'cis-dnd-row-dragover',
  ].filter(Boolean).join(' ') || undefined;

  return { dragHandleProps, rowDropProps, rowClassName, dragIndex };
}

/** Drag-handle grip icon — drop into the first cell of a sortable row and
 * spread `dragHandleProps(i)` from useDragReorder onto it. */
export function DragHandle(props) {
  return (
    <span className="cis-dnd-handle" title="Drag to reorder" {...props}>
      <i className="fa fa-bars" aria-hidden="true" />
    </span>
  );
}
