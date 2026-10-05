import { useCallback, useState } from 'react'

const MAX_UNDO_STEPS = 200

// The edits made to one open file, kept only in memory. `update` records one undo step; the original file is never touched.
export type EditSession<Edits> = {
  edits: Edits
  changeCount: number
  canUndo: boolean
  canRedo: boolean
  update(change: (currentEdits: Edits) => Edits): void
  undo(): void
  redo(): void
  revertAll(): void
  // Forget every edit and the undo history, e.g. when the file is re-read with another delimiter.
  reset(): void
}

type History<Edits> = { past: Edits[]; present: Edits; future: Edits[] }

export function useEditSession<Edits>(createEmptyEdits: () => Edits, countChanges: (edits: Edits) => number): EditSession<Edits> {
  const [history, setHistory] = useState<History<Edits>>(() => ({ past: [], present: createEmptyEdits(), future: [] }))

  const update = useCallback((change: (currentEdits: Edits) => Edits) => {
    setHistory((current) => {
      const nextEdits = change(current.present)
      if (nextEdits === current.present) return current
      return { past: [...current.past, current.present].slice(-MAX_UNDO_STEPS), present: nextEdits, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current
      return {
        past: current.past.slice(0, -1),
        present: current.past[current.past.length - 1],
        future: [current.present, ...current.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) return current
      return { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) }
    })
  }, [])

  // Reverting everything is itself one undo step, so a misclick can be undone.
  const revertAll = useCallback(() => {
    update((currentEdits) => (countChanges(currentEdits) === 0 ? currentEdits : createEmptyEdits()))
  }, [update, countChanges, createEmptyEdits])

  const reset = useCallback(() => {
    setHistory({ past: [], present: createEmptyEdits(), future: [] })
  }, [createEmptyEdits])

  return {
    edits: history.present,
    changeCount: countChanges(history.present),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    update,
    undo,
    redo,
    revertAll,
    reset,
  }
}
