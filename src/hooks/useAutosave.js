import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useAutosave(saveFn, deps, options)
 *
 * Watches `deps` for changes and fires `saveFn` after a debounce delay.
 * Returns { saveStatus } — one of: 'idle' | 'saving' | 'saved' | 'error'
 *
 * Usage:
 *   const { saveStatus } = useAutosave(handleSave, [name, phone], { delay: 1500 });
 *
 * Options:
 *   delay      — debounce ms before save fires (default 1500)
 *   enabled    — false disables autosave (useful on first mount)
 *   onSave     — optional extra callback after successful save
 */
export function useAutosave(saveFn, deps = [], { delay = 1500, enabled = true, onSave } = {}) {
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle'|'saving'|'saved'|'error'
  const timer    = useRef(null);
  const mounted  = useRef(false); // skip first-mount fire
  const latestFn = useRef(saveFn);

  // Keep latest save fn without restarting timers
  useEffect(() => { latestFn.current = saveFn; }, [saveFn]);

  useEffect(() => {
    if (!enabled) return;
    if (!mounted.current) { mounted.current = true; return; } // skip initial mount

    clearTimeout(timer.current);
    setSaveStatus('idle');

    timer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await latestFn.current();
        setSaveStatus('saved');
        onSave?.();
        // Reset to idle after 2.5s
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, delay);

    return () => clearTimeout(timer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { saveStatus };
}

/**
 * AutosaveIndicator — drop-in status chip
 * Props: status ('idle'|'saving'|'saved'|'error'), className
 */
export function AutosaveIndicator({ status, className = '' }) {
  if (status === 'idle') return null;
  const map = {
    saving: { text: 'Saving…',  dot: 'bg-yellow-400 animate-pulse', txt: 'text-yellow-600' },
    saved:  { text: 'Saved ✓',  dot: 'bg-green-500',                 txt: 'text-green-600'  },
    error:  { text: 'Not saved', dot: 'bg-red-500',                   txt: 'text-red-500'    },
  };
  const { text, dot, txt } = map[status] || map.saving;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${txt} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {text}
    </span>
  );
}
