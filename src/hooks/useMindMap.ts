import { useCallback, useReducer } from 'react'
import {
  addChild,
  addFloatingRoot,
  addSibling,
  moveNode,
  moveRoot,
  removeNode,
  toggleCollapse,
  updateText,
} from '../model/mindmap'
import type { MindMap, NodeId } from '../model/types'

/**
 * 開いている 1 つのマインドマップの状態管理。
 * useReducer で履歴（Undo/Redo）付きの状態を持つ。保存は呼び出し側（useMapLibrary）が担当する。
 */

const HISTORY_LIMIT = 100

interface HistoryState {
  past: MindMap[]
  present: MindMap
  future: MindMap[]
}

type EditAction =
  | { type: 'addChild'; parentId: NodeId; id: NodeId; text?: string }
  | { type: 'addSibling'; nodeId: NodeId; id: NodeId; text?: string }
  | { type: 'addFloating'; id: NodeId; x: number; y: number; text?: string }
  | { type: 'updateText'; id: NodeId; text: string }
  | { type: 'remove'; id: NodeId }
  | { type: 'toggleCollapse'; id: NodeId }
  | { type: 'move'; id: NodeId; parentId: NodeId; index?: number }
  | { type: 'moveRoot'; id: NodeId; x: number; y: number }

type Action = EditAction | { type: 'undo' } | { type: 'redo' }

function applyEdit(map: MindMap, action: EditAction): MindMap {
  switch (action.type) {
    case 'addChild':
      return addChild(map, action.parentId, action.id, action.text)
    case 'addSibling':
      return addSibling(map, action.nodeId, action.id, action.text)
    case 'addFloating':
      return addFloatingRoot(map, action.id, action.x, action.y, action.text)
    case 'updateText':
      return updateText(map, action.id, action.text)
    case 'remove':
      return removeNode(map, action.id)
    case 'toggleCollapse':
      return toggleCollapse(map, action.id)
    case 'move':
      return moveNode(map, action.id, action.parentId, action.index)
    case 'moveRoot':
      return moveRoot(map, action.id, action.x, action.y)
  }
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: [...state.past, state.present], present: next, future: rest }
    }
    default: {
      const next = applyEdit(state.present, action)
      if (next === state.present) return state
      return {
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.present],
        present: next,
        future: [],
      }
    }
  }
}

export function useMindMap(initialMap: MindMap) {
  const [state, dispatch] = useReducer(reducer, initialMap, (map) => ({
    past: [],
    present: map,
    future: [],
  }))

  const addChildNode = useCallback(
    (parentId: NodeId, id: NodeId, text?: string) =>
      dispatch({ type: 'addChild', parentId, id, text }),
    [],
  )
  const addSiblingNode = useCallback(
    (nodeId: NodeId, id: NodeId, text?: string) =>
      dispatch({ type: 'addSibling', nodeId, id, text }),
    [],
  )
  const addFloating = useCallback(
    (id: NodeId, x: number, y: number, text?: string) =>
      dispatch({ type: 'addFloating', id, x, y, text }),
    [],
  )
  const setText = useCallback(
    (id: NodeId, text: string) => dispatch({ type: 'updateText', id, text }),
    [],
  )
  const remove = useCallback((id: NodeId) => dispatch({ type: 'remove', id }), [])
  const toggle = useCallback((id: NodeId) => dispatch({ type: 'toggleCollapse', id }), [])
  const move = useCallback(
    (id: NodeId, parentId: NodeId, index?: number) =>
      dispatch({ type: 'move', id, parentId, index }),
    [],
  )
  const moveRootTo = useCallback(
    (id: NodeId, x: number, y: number) => dispatch({ type: 'moveRoot', id, x, y }),
    [],
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  return {
    map: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    addChild: addChildNode,
    addSibling: addSiblingNode,
    addFloating,
    setText,
    remove,
    toggleCollapse: toggle,
    move,
    moveRoot: moveRootTo,
    undo,
    redo,
  }
}

export type MindMapStore = ReturnType<typeof useMindMap>
