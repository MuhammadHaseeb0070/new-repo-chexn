import { useId, useState } from 'react';

const POSITION_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

function InfoTooltip({ description, position = 'top', label = 'More info', className = '' }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      >
        <span className="sr-only">{label}</span>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm0 13.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 1.5 0Zm0-6.75a.75.75 0 1 1 .75-.75.75.75 0 0 1-.75.75Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <div
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute z-20 w-60 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg transition-opacity duration-150 ${
          POSITION_CLASSES[position] || POSITION_CLASSES.top
        } ${open ? 'opacity-100' : 'opacity-0'}`}
      >
        {description}
      </div>
    </span>
  );
}

export default InfoTooltip;


