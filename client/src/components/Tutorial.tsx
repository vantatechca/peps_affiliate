import { useState, useEffect, useRef } from 'react';

export interface TutorialStep {
  target: string;       // CSS selector for the element to highlight
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  tab?: string;         // if set, this step only shows when activeTab matches
}

interface TutorialProps {
  steps: TutorialStep[];
  storageKey: string;   // unique key per role (admin vs affiliate)
  activeTab?: string;   // current active tab to filter steps
  onComplete?: () => void;
}

export default function Tutorial({ steps, storageKey, activeTab, onComplete }: TutorialProps) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Filter steps: show global steps (no tab) + steps matching current tab
  const visibleSteps = steps.filter(s => !s.tab || s.tab === activeTab);

  // Build a per-tab storage key so each tab's tutorial is tracked independently
  const effectiveKey = activeTab ? `${storageKey}_${activeTab}` : storageKey;

  useEffect(() => {
    const seen = localStorage.getItem(effectiveKey);
    if (!seen) {
      setStep(0);
      setTimeout(() => setActive(true), 600);
    } else {
      setActive(false);
    }
  }, [effectiveKey]);

  useEffect(() => {
    if (!active) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [active, step, visibleSteps.length]);

  function updatePosition() {
    if (!active || step >= visibleSteps.length) return;
    const el = document.querySelector(visibleSteps[step].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height });
    }
  }

  function next() {
    if (step < visibleSteps.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function finish() {
    setActive(false);
    localStorage.setItem(effectiveKey, 'true');
    onComplete?.();
  }

  function restart() {
    // Clear the current tab's tutorial key
    localStorage.removeItem(effectiveKey);
    setStep(0);
    setActive(true);
  }

  if (!active) {
    return (
      <button
        onClick={restart}
        className="fixed bottom-4 right-4 z-40 bg-gray-900 dark:bg-gray-700 text-white text-xs px-3 py-2 rounded-full hover:bg-gray-700 dark:hover:bg-gray-600 flex items-center gap-1.5"
        title="Show tutorial"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Help
      </button>
    );
  }

  if (visibleSteps.length === 0) return null;

  const current = visibleSteps[step];
  const padding = 8;

  // Calculate tooltip position
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 60,
  };

  const p = current.position || 'bottom';
  if (p === 'bottom') {
    tooltipStyle.top = pos.top + pos.height + padding + 12;
    tooltipStyle.left = Math.max(16, pos.left);
  } else if (p === 'top') {
    tooltipStyle.bottom = window.innerHeight - pos.top + padding + 12;
    tooltipStyle.left = Math.max(16, pos.left);
  } else if (p === 'right') {
    tooltipStyle.top = pos.top;
    tooltipStyle.left = pos.left + pos.width + padding + 12;
  } else {
    tooltipStyle.top = pos.top;
    tooltipStyle.right = window.innerWidth - pos.left + padding + 12;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50" style={{ pointerEvents: 'none' }}>
        {/* Dark overlay with cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'auto' }}>
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={pos.left - padding}
                y={pos.top - padding}
                width={pos.width + padding * 2}
                height={pos.height + padding * 2}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.5)"
            mask="url(#tutorial-mask)"
            onClick={finish}
          />
        </svg>

        {/* Highlight border */}
        <div
          className="absolute border-2 border-blue-500 rounded-lg transition-all duration-300"
          style={{
            top: pos.top - padding,
            left: pos.left - padding,
            width: pos.width + padding * 2,
            height: pos.height + padding * 2,
            pointerEvents: 'none',
            boxShadow: '0 0 0 4px rgba(59,130,246,0.2)',
          }}
        />

        {/* Tooltip */}
        <div
          ref={tooltipRef}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-w-[calc(100vw-32px)] sm:max-w-sm"
          style={{ ...tooltipStyle, pointerEvents: 'auto' }}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{current.title}</h4>
            <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">{step + 1} / {visibleSteps.length}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{current.content}</p>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-3">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / visibleSteps.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={finish}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Skip tutorial
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button onClick={prev} className="text-xs text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Back
                </button>
              )}
              <button onClick={next} className="text-xs text-white bg-blue-600 px-3 py-1.5 rounded hover:bg-blue-700 font-medium">
                {step === visibleSteps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
