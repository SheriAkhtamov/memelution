import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export interface TabsProps<T extends string> {
  value: T;
  items: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}

export function Tabs<T extends string>({ value, items, onChange }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const movePill = useCallback((animate: boolean) => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const active = Array.from(list.querySelectorAll<HTMLButtonElement>('[data-motion-tab]'))
      .find((tab) => tab.dataset.motionTab === value);
    if (!active) return;
    if (!animate) pill.style.transition = 'none';
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    pill.style.width = `${active.offsetWidth}px`;
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = '';
    }
  }, [value]);

  useLayoutEffect(() => {
    movePill(false);
  }, [movePill]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => movePill(false));
    observer.observe(list);
    return () => observer.disconnect();
  }, [movePill]);

  return (
    <div ref={listRef} className="t-tabs" role="tablist">
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          role="tab"
          aria-selected={value === item.id}
          data-motion-tab={item.id}
          className="t-tab shrink-0 text-[0.82rem] font-black"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
