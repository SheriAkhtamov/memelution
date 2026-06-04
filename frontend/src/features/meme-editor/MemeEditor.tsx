import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Minus, Plus, Redo2, RotateCcw, Type, Undo2, X } from 'lucide-react';
import { Button, Modal } from '../../shared/ui';
import { useTranslation } from '../../shared/i18n';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  rotation: number;
  bold: boolean;
  outline: boolean;
}

const FONTS = ['Impact', 'Arial Black', 'Comic Sans MS', 'Roboto', 'Inter'];
const COLORS = ['#FFFFFF', '#000000', '#FF6B00', '#7C3AED', '#2AABEE', '#ef4444', '#22c55e', '#f59e0b'];
const HISTORY_LIMIT = 50;

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Canvas-based meme editor.
 * Upload an image → add draggable text overlays → export as PNG.
 * Supports undo/redo (Ctrl+Z / Ctrl+Shift+Z) and Delete key for selected overlay.
 */
export function MemeEditor({
  open,
  onClose,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  onExport: (blob: Blob) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 500, h: 500 });
  const historyRef = useRef<{ past: TextOverlay[][]; future: TextOverlay[][] }>({ past: [], future: [] });
  const [, forceHistory] = useState(0);

  const selected = overlays.find((o) => o.id === selectedId) || null;
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  // Commit a snapshot of current overlays to history (call BEFORE making a change)
  const commit = useCallback(() => {
    historyRef.current.past.push(overlays.map((o) => ({ ...o })));
    if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
    historyRef.current.future = [];
  }, [overlays]);

  const undo = useCallback(() => {
    if (historyRef.current.past.length === 0) return;
    const previous = historyRef.current.past.pop()!;
    historyRef.current.future.push(overlays.map((o) => ({ ...o })));
    setOverlays(previous);
    const removedId = overlays.find((o) => !previous.find((p) => p.id === o.id))?.id;
    if (removedId && selectedId === removedId) setSelectedId(null);
    forceHistory((n) => n + 1);
  }, [overlays, selectedId]);

  const redo = useCallback(() => {
    if (historyRef.current.future.length === 0) return;
    const next = historyRef.current.future.pop()!;
    historyRef.current.past.push(overlays.map((o) => ({ ...o })));
    setOverlays(next);
    const removedId = next.find((o) => !overlays.find((p) => p.id === o.id))?.id ? null : null;
    if (removedId === null && selectedId && !next.find((o) => o.id === selectedId)) setSelectedId(null);
    forceHistory((n) => n + 1);
  }, [overlays, selectedId]);

  // Reset image + history
  const resetEditor = useCallback(() => {
    setImage(null);
    setOverlays([]);
    setSelectedId(null);
    historyRef.current = { past: [], future: [] };
    forceHistory((n) => n + 1);
  }, []);

  // Load image
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(600, window.innerWidth - 48);
        const scale = maxW / img.width;
        setCanvasSize({ w: maxW, h: Math.round(img.height * scale) });
        setImage(img);
        setOverlays([]);
        setSelectedId(null);
        historyRef.current = { past: [], future: [] };
        forceHistory((n) => n + 1);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // Add text overlay
  const addText = () => {
    commit();
    const overlay: TextOverlay = {
      id: uid(),
      text: t('meme_editor.default_text'),
      x: canvasSize.w / 2,
      y: canvasSize.h / 2,
      fontSize: 36,
      color: '#FFFFFF',
      fontFamily: 'Impact',
      rotation: 0,
      bold: true,
      outline: true,
    };
    setOverlays((prev) => [...prev, overlay]);
    setSelectedId(overlay.id);
  };

  // Update overlay prop. Caller MUST call commit() first if the change should be undoable.
  // Exception: text input calls commit once on focus, then mutates freely.
  const updateOverlay = useCallback((id: string, patch: Partial<TextOverlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  // Remove overlay
  const removeOverlay = (id: string) => {
    commit();
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw checkerboard bg
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (image) {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    for (const overlay of overlays) {
      ctx.save();
      ctx.translate(overlay.x, overlay.y);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      const fontWeight = overlay.bold ? 'bold' : 'normal';
      ctx.font = `${fontWeight} ${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (overlay.outline) {
        ctx.strokeStyle = overlay.color === '#000000' ? '#FFFFFF' : '#000000';
        ctx.lineWidth = overlay.fontSize / 10;
        ctx.lineJoin = 'round';
        ctx.strokeText(overlay.text, 0, 0);
      }

      ctx.fillStyle = overlay.color;
      ctx.fillText(overlay.text, 0, 0);

      // Selection indicator
      if (overlay.id === selectedId) {
        const metrics = ctx.measureText(overlay.text);
        const w = metrics.width + 12;
        const h = overlay.fontSize + 8;
        ctx.strokeStyle = '#2AABEE';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }, [image, overlays, selectedId, canvasSize]);

  useEffect(() => {
    render();
  }, [render]);

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo), Delete/Backspace (remove selected)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((mod && e.shiftKey && e.key.toLowerCase() === 'z') || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (!inField && (e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeOverlay(selectedId);
        return;
      }
      if (!inField && e.key === 'Escape' && selectedId) {
        e.preventDefault();
        setSelectedId(null);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, undo, redo, selectedId, removeOverlay]);

  // Mouse/touch drag
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    // Find clicked overlay (reverse order = top first)
    for (let i = overlays.length - 1; i >= 0; i--) {
      const o = overlays[i];
      const dx = pos.x - o.x;
      const dy = pos.y - o.y;
      if (Math.abs(dx) < o.fontSize * 3 && Math.abs(dy) < o.fontSize) {
        // Snapshot pre-drag position so a single undo reverts the whole move.
        commit();
        setSelectedId(o.id);
        setDragging({ id: o.id, offsetX: dx, offsetY: dy });
        return;
      }
    }
    setSelectedId(null);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    const pos = getPos(e);
    updateOverlay(dragging.id, {
      x: Math.max(0, Math.min(canvasSize.w, pos.x - dragging.offsetX)),
      y: Math.max(0, Math.min(canvasSize.h, pos.y - dragging.offsetY)),
    });
  };

  const handleUp = () => setDragging(null);

  // Export
  const handleExport = () => {
    // Render at full resolution
    const exportCanvas = document.createElement('canvas');
    if (!image) return;
    exportCanvas.width = image.naturalWidth;
    exportCanvas.height = image.naturalHeight;
    const ctx = exportCanvas.getContext('2d')!;
    const scaleX = image.naturalWidth / canvasSize.w;
    const scaleY = image.naturalHeight / canvasSize.h;

    ctx.drawImage(image, 0, 0);

    for (const overlay of overlays) {
      ctx.save();
      ctx.translate(overlay.x * scaleX, overlay.y * scaleY);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      const scaledSize = overlay.fontSize * scaleX;
      const fontWeight = overlay.bold ? 'bold' : 'normal';
      ctx.font = `${fontWeight} ${scaledSize}px ${overlay.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (overlay.outline) {
        ctx.strokeStyle = overlay.color === '#000000' ? '#FFFFFF' : '#000000';
        ctx.lineWidth = scaledSize / 10;
        ctx.lineJoin = 'round';
        ctx.strokeText(overlay.text, 0, 0);
      }

      ctx.fillStyle = overlay.color;
      ctx.fillText(overlay.text, 0, 0);
      ctx.restore();
    }

    exportCanvas.toBlob((blob) => {
      if (blob) onExport(blob);
    }, 'image/png');
  };

  return (
    <Modal open={open} onClose={onClose} title={t('meme_editor.title')}>
      <div className="space-y-4">
        {/* Upload area */}
        {!image ? (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center transition-colors hover:border-[#FF6B00] hover:bg-orange-50/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-[#FF6B00]">
            <ImageIcon size={48} className="text-gray-300 dark:text-zinc-600" />
            <p className="text-sm font-black text-gray-500">{t('meme_editor.upload')}</p>
            <p className="text-xs text-gray-400">{t('meme_editor.formats')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        ) : (
          <>
            {/* Canvas */}
            <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700">
              <canvas
                ref={canvasRef}
                width={canvasSize.w}
                height={canvasSize.h}
                className="w-full cursor-crosshair"
                style={{ touchAction: 'none' }}
                onMouseDown={handleDown}
                onMouseMove={handleMove}
                onMouseUp={handleUp}
                onMouseLeave={handleUp}
                onTouchStart={handleDown}
                onTouchMove={handleMove}
                onTouchEnd={handleUp}
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="h-9 text-xs" onClick={addText}>
                <Type size={14} /> {t('meme_editor.add_text')}
              </Button>
              <Button
                variant="outline"
                className="h-9 w-9 p-0"
                onClick={undo}
                disabled={!canUndo}
                aria-label={t('meme_editor.undo')}
                title="Ctrl+Z"
              >
                <Undo2 size={14} />
              </Button>
              <Button
                variant="outline"
                className="h-9 w-9 p-0"
                onClick={redo}
                disabled={!canRedo}
                aria-label={t('meme_editor.redo')}
                title="Ctrl+Shift+Z"
              >
                <Redo2 size={14} />
              </Button>
              <Button variant="outline" className="h-9 text-xs" onClick={resetEditor}>
                <RotateCcw size={14} /> {t('meme_editor.new_photo')}
              </Button>
              <Button className="ml-auto h-9 text-xs" onClick={handleExport} disabled={!image}>
                <Download size={14} /> {t('meme_editor.export')}
              </Button>
            </div>

            {/* Selected overlay controls */}
            {selected && (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-500">{t('meme_editor.text_settings')}</span>
                  <button onClick={() => removeOverlay(selected.id)} className="text-red-400 hover:text-red-600" aria-label="Удалить текст">
                    <X size={14} />
                  </button>
                </div>

                {/* Text input — commit on focus, then mutate freely while typing */}
                <input
                  value={selected.text}
                  onFocus={() => commit()}
                  onChange={(e) => updateOverlay(selected.id, { text: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-[#FF6B00] dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder={t('meme_editor.meme_text')}
                />

                {/* Font size */}
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-gray-400">{t('meme_editor.size')}</span>
                  <button
                    onClick={() => { commit(); updateOverlay(selected.id, { fontSize: Math.max(12, selected.fontSize - 4) }); }}
                    className="rounded p-1 hover:bg-gray-200 dark:hover:bg-zinc-800"
                    aria-label="Уменьшить шрифт"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-xs font-black">{selected.fontSize}</span>
                  <button
                    onClick={() => { commit(); updateOverlay(selected.id, { fontSize: Math.min(120, selected.fontSize + 4) }); }}
                    className="rounded p-1 hover:bg-gray-200 dark:hover:bg-zinc-800"
                    aria-label="Увеличить шрифт"
                  >
                    <Plus size={14} />
                  </button>
                  <input
                    type="range"
                    min={12}
                    max={120}
                    value={selected.fontSize}
                    onPointerDown={() => commit()}
                    onChange={(e) => updateOverlay(selected.id, { fontSize: Number(e.target.value) })}
                    className="ml-2 flex-1 accent-[#FF6B00]"
                    aria-label="Размер шрифта"
                  />
                </div>

                {/* Font family */}
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-gray-400">{t('meme_editor.font')}</span>
                  <div className="flex flex-wrap gap-1">
                    {FONTS.map((f) => (
                      <button
                        key={f}
                        onClick={() => { commit(); updateOverlay(selected.id, { fontFamily: f }); }}
                        className={`rounded-md px-2 py-1 text-[10px] font-black transition-colors ${
                          selected.fontFamily === f
                            ? 'bg-[#FF6B00] text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                        style={{ fontFamily: f }}
                      >
                        {f.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-gray-400">{t('meme_editor.color')}</span>
                  <div className="flex gap-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => { commit(); updateOverlay(selected.id, { color: c }); }}
                        className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          selected.color === c ? 'border-[#FF6B00] scale-110' : 'border-gray-300 dark:border-zinc-600'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Цвет ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.bold}
                      onChange={(e) => { commit(); updateOverlay(selected.id, { bold: e.target.checked }); }}
                      className="accent-[#FF6B00]"
                    />
                    <span className="font-black">{t('meme_editor.bold')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.outline}
                      onChange={(e) => { commit(); updateOverlay(selected.id, { outline: e.target.checked }); }}
                      className="accent-[#FF6B00]"
                    />
                    <span className="font-black">{t('meme_editor.outline')}</span>
                  </label>
                </div>

                {/* Rotation */}
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-gray-400">{t('meme_editor.rotate')}</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    value={selected.rotation}
                    onPointerDown={() => commit()}
                    onChange={(e) => updateOverlay(selected.id, { rotation: Number(e.target.value) })}
                    className="flex-1 accent-[#FF6B00]"
                    aria-label="Поворот"
                  />
                  <span className="w-8 text-center text-xs font-black">{selected.rotation}°</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
