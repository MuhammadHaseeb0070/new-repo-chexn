import CommunicationThread from './CommunicationThread.jsx';
function ThreadModal({ checkInId, onClose }) {
  if (!checkInId) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-5 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Conversation</h3>
          <button onClick={onClose} className="rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-sm">Close</button>
        </div>
        <div className="mt-4">
          {/* Lazy import avoids circulars; direct import is fine too */}
          {/* eslint-disable-next-line react/jsx-no-undef */}
          <CommunicationThread checkInId={checkInId} />
        </div>
      </div>
    </div>
  );
}

export default ThreadModal;


