import { useState } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';

function SchoolManagement({ schoolId, onUpdated, onDeleted }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('view'); // view | edit | delete
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: '', type: '' });
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/district/institute/${schoolId}`);
      setData(res.data);
      setForm({ name: res.data?.name || '', type: res.data?.type || '' });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load institute');
    } finally {
      setLoading(false);
    }
  };

  const open = (nextMode = 'view') => {
    setMode(nextMode);
    setShow(true);
    if (nextMode !== 'delete') {
      fetchData();
    }
  };

  const close = () => {
    setShow(false);
    setError('');
    setData(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const update = {};
      if (form.name && form.name !== data?.name) update.name = form.name;
      if (form.type && form.type !== data?.name) update.type = form.type; // note: comparing to previous
      if (Object.keys(update).length === 0) {
        setError('No changes to save');
        setLoading(false);
        return;
      }
      await apiClient.put(`/district/institute/${schoolId}`, update);
      close();
      if (onUpdated) onUpdated();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.delete(`/district/institute/${schoolId}`);
      close();
      if (onDeleted) onDeleted();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  if (!show) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); open('view'); }}
        className="p-1.5 sm:p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md"
        title="Manage"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" onClick={close}>
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'view' && 'View Institute'}
            {mode === 'edit' && 'Edit Institute'}
            {mode === 'delete' && 'Delete Institute'}
          </h3>
          <button className="text-gray-400 hover:text-gray-600 text-2xl" onClick={close}>×</button>
        </div>

        {mode === 'view' && (
          <div>
            {loading && <div className="py-6"><Spinner label="Loading..." /></div>}
            {error && <div className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
            {data && (
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500">Name</div>
                  <div className="text-sm font-medium">{data.name || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Type</div>
                  <div className="text-sm font-medium">{data.type || '-'}</div>
                </div>
                <div className="text-sm text-gray-500">Staff/Users in school: {data.staffCount ?? 0}</div>
                <div className="pt-3 flex gap-2">
                  <button className="px-3 py-1.5 bg-blue-600 text-white rounded" onClick={() => setMode('edit')}>Edit</button>
                  <button className="px-3 py-1.5 bg-red-600 text-white rounded" onClick={() => setMode('delete')}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'edit' && (
          <form onSubmit={save} className="space-y-3">
            {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Select type</option>
                <option value="elementary">elementary</option>
                <option value="middle-school">middle-school</option>
                <option value="high-school">high-school</option>
                <option value="college">college</option>
              </select>
            </div>
            <div className="pt-3 flex justify-end gap-2 border-t">
              <button type="button" className="px-3 py-1.5 border rounded" onClick={close}>Cancel</button>
              <button type="submit" disabled={loading} className="px-3 py-1.5 bg-blue-600 text-white rounded">
                {loading ? <><Spinner /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {mode === 'delete' && (
          <div>
            {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded mb-3">{error}</div>}
            <p className="text-sm text-gray-700">Are you sure you want to delete this institute? You must remove or reassign its users first.</p>
            <div className="pt-3 flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={close}>Cancel</button>
              <button className="px-3 py-1.5 bg-red-600 text-white rounded" disabled={loading} onClick={remove}>
                {loading ? <><Spinner /> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SchoolManagement;
