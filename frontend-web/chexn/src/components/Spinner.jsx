function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 text-gray-500">
      <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}

export default Spinner;


