import { useState } from 'react';
import InfoTooltip from './InfoTooltip.jsx';

function CollapsiblePanel({ title, defaultOpen = false, children, action, onToggle, description, infoPosition = 'top' }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(o => {
                const n = !o;
                if (onToggle) onToggle(n);
                return n;
              });
            }}
            className="text-left font-semibold text-gray-900 focus:outline-none"
          >
            {title}
          </button>
          {description ? (
            <InfoTooltip description={description} position={infoPosition} />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            type="button"
            onClick={() => {
              setOpen(o => {
                const n = !o;
                if (onToggle) onToggle(n);
                return n;
              });
            }}
            className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm"
          >
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 py-3 md:px-5 md:py-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsiblePanel;


