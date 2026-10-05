'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Trash2, Plus, Copy, AlertCircle } from 'lucide-react';
import type { StateMachine, AnimationState, StateTransition, StateId, ConditionOp } from '../lib/state-machine-model';
import {
  addState,
  addTransition,
  addCondition,
  addParameter,
  validateStateMachine,
  stateId,
  transitionId,
  parameterId,
} from '../lib/state-machine-model';

interface StateEditorProps {
  machine: StateMachine;
  onChange: (machine: StateMachine) => void;
  selectedStateId?: StateId;
  onSelectState?: (id: StateId) => void;
}

export default function StateEditor({
  machine,
  onChange,
  selectedStateId,
  onSelectState,
}: StateEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draggedState, setDraggedState] = useState<StateId | null>(null);
  const [editingStateName, setEditingStateName] = useState<StateId | null>(null);
  const [newStateName, setNewStateName] = useState('');

  const errors = validateStateMachine(machine);
  const nodeRadius = 60;
  const nodeSpacing = 280;

  // Simple force-directed layout if no metadata positions exist
  const getNodePosition = (state: AnimationState): { x: number; y: number } => {
    if (state.metadata?.x !== undefined && state.metadata?.y !== undefined) {
      return { x: state.metadata.x, y: state.metadata.y };
    }
    // Default grid layout
    const index = machine.states.findIndex(s => s.id === state.id);
    return {
      x: 100 + (index % 3) * nodeSpacing,
      y: 100 + Math.floor(index / 3) * nodeSpacing,
    };
  };

  const screenToWorld = (screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - panX) / zoom,
      y: (screenY - rect.top - panY) / zoom,
    };
  };

  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = 'rgba(12, 14, 18, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transforms
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw transitions (edges)
    ctx.strokeStyle = 'rgba(112, 182, 255, 0.4)';
    ctx.lineWidth = 2 / zoom;
    machine.transitions.forEach(trans => {
      const fromState = machine.states.find(s => s.id === trans.fromState);
      const toState = machine.states.find(s => s.id === trans.toState);
      if (!fromState || !toState) return;

      const from = getNodePosition(fromState);
      const to = getNodePosition(toState);

      // Draw arrow
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const startX = from.x + Math.cos(angle) * nodeRadius;
      const startY = from.y + Math.sin(angle) * nodeRadius;
      const endX = to.x - Math.cos(angle) * nodeRadius;
      const endY = to.y - Math.sin(angle) * nodeRadius;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw arrowhead
      const headlen = 15 / zoom;
      const angle2 = Math.atan2(endY - startY, endX - startX);
      ctx.fillStyle = 'rgba(112, 182, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headlen * Math.cos(angle2 - Math.PI / 6), endY - headlen * Math.sin(angle2 - Math.PI / 6));
      ctx.lineTo(endX - headlen * Math.cos(angle2 + Math.PI / 6), endY - headlen * Math.sin(angle2 + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    });

    // Draw states (nodes)
    machine.states.forEach(state => {
      const pos = getNodePosition(state);
      const isSelected = state.id === selectedStateId;
      const isEntry = state.id === machine.entryState;

      // Node circle
      ctx.fillStyle = isEntry
        ? 'rgba(92, 201, 111, 0.2)'
        : isSelected
          ? 'rgba(112, 182, 255, 0.25)'
          : 'rgba(112, 182, 255, 0.12)';
      ctx.strokeStyle = isEntry
        ? 'rgba(92, 201, 111, 0.8)'
        : isSelected
          ? 'rgba(112, 182, 255, 0.8)'
          : 'rgba(112, 182, 255, 0.4)';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(245, 247, 250, 0.9)';
      ctx.font = `${14 / zoom}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.name, pos.x, pos.y - 8 / zoom);

      // Track key (smaller text)
      ctx.fillStyle = 'rgba(176, 188, 200, 0.7)';
      ctx.font = `${11 / zoom}px monospace`;
      ctx.fillText(state.trackKey.slice(0, 12), pos.x, pos.y + 12 / zoom);
    });

    ctx.restore();
  };

  useEffect(() => {
    drawGraph();
  }, [machine, selectedStateId, panX, panY, zoom]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);

    // Check if clicked on a node
    for (const state of machine.states) {
      const pos = getNodePosition(state);
      const dist = Math.hypot(world.x - pos.x, world.y - pos.y);
      if (dist < nodeRadius) {
        onSelectState?.(state.id);
        return;
      }
    }

    // Deselect
    onSelectState?.(undefined as any);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const newZoom = Math.max(0.5, Math.min(3, zoom - e.deltaY * 0.001));
    setZoom(newZoom);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && dragStart) {
      setPanX(panX + (e.clientX - dragStart.x));
      setPanY(panY + (e.clientY - dragStart.y));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const addNewState = () => {
    const nextMachine = addState(machine, `State ${machine.states.length + 1}`, 'track-key');
    onChange(nextMachine);
  };

  const addNewTransition = () => {
    if (machine.states.length < 2) return;
    const nextMachine = addTransition(machine, machine.states[0].id, machine.states[1].id);
    onChange(nextMachine);
  };

  const deleteState = (id: StateId) => {
    const nextMachine = {
      ...machine,
      states: machine.states.filter(s => s.id !== id),
      transitions: machine.transitions.filter(
        t => t.fromState !== id && t.toState !== id
      ),
    };
    onChange(nextMachine);
  };

  const updateStateName = (id: StateId, newName: string) => {
    const nextMachine = {
      ...machine,
      states: machine.states.map(s =>
        s.id === id ? { ...s, name: newName } : s
      ),
    };
    onChange(nextMachine);
    setEditingStateName(null);
  };

  const selectedState = machine.states.find(s => s.id === selectedStateId);

  return (
    <div className="state-editor">
      <div className="state-graph" onContextMenu={e => e.preventDefault()}>
        <canvas
          ref={canvasRef}
          className="state-graph-canvas"
          width={800}
          height={400}
          onClick={handleCanvasClick}
          onWheel={handleCanvasWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          style={{ cursor: isDragging ? 'grab' : 'auto' }}
        />
        <div className="state-graph-controls">
          <button className="button" onClick={addNewState} title="Add state">
            <Plus size={16} /> State
          </button>
          <button className="button" onClick={addNewTransition} title="Add transition">
            <Plus size={16} /> Trans
          </button>
          <button className="button" onClick={() => setZoom(1)} title="Reset zoom">
            100%
          </button>
        </div>
      </div>

      <div className="state-inspector">
        <div className="section">
          <h3 style={{ marginTop: 0 }}>States</h3>
          {errors.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', padding: '8px', background: 'rgba(255, 107, 107, 0.1)', borderRadius: '6px', marginBottom: '12px', color: '#ff6b6b' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '12px' }}>{errors[0]}</span>
            </div>
          )}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {machine.states.map(state => (
              <div
                key={state.id}
                className={`state-node ${state.id === selectedStateId ? 'active' : ''}`}
                onClick={() => onSelectState?.(state.id)}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  {editingStateName === state.id ? (
                    <input
                      autoFocus
                      value={newStateName}
                      onChange={e => setNewStateName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') updateStateName(state.id, newStateName);
                        if (e.key === 'Escape') setEditingStateName(null);
                      }}
                      onBlur={() => setEditingStateName(null)}
                      className="input"
                      style={{ padding: '4px 6px', fontSize: '12px' }}
                    />
                  ) : (
                    <>
                      <span style={{ fontSize: '12px', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {state.name}
                      </span>
                      {state.id === machine.entryState && <span style={{ fontSize: '10px', opacity: 0.6 }}>⭐ Entry</span>}
                    </>
                  )}
                </div>
                <button
                  className="button ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    deleteState(state.id);
                  }}
                  title="Delete state"
                  style={{ padding: '4px', minHeight: '24px' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {selectedState && (
          <div className="section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <h3>State Details</h3>
            <div className="stack">
              <div className="label">
                Name
                <input
                  type="text"
                  className="input"
                  value={selectedState.name}
                  onChange={e =>
                    onChange({
                      ...machine,
                      states: machine.states.map(s =>
                        s.id === selectedState.id ? { ...s, name: e.target.value } : s
                      ),
                    })
                  }
                  style={{ fontSize: '12px', padding: '6px' }}
                />
              </div>
              <div className="label">
                Track Key
                <input
                  type="text"
                  className="input"
                  value={selectedState.trackKey}
                  onChange={e =>
                    onChange({
                      ...machine,
                      states: machine.states.map(s =>
                        s.id === selectedState.id ? { ...s, trackKey: e.target.value } : s
                      ),
                    })
                  }
                  style={{ fontSize: '12px', padding: '6px' }}
                />
              </div>
              <div className="label">
                Speed
                <input
                  type="number"
                  className="input"
                  value={selectedState.speed}
                  onChange={e =>
                    onChange({
                      ...machine,
                      states: machine.states.map(s =>
                        s.id === selectedState.id ? { ...s, speed: parseFloat(e.target.value) } : s
                      ),
                    })
                  }
                  step={0.1}
                  min={0.1}
                  max={2}
                  style={{ fontSize: '12px', padding: '6px' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
