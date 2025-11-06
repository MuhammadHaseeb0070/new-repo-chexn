import { useState, useEffect, useCallback } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';

function CommunicationThread({ checkInId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');

  const fetchMessages = useCallback(async () => {
    try {
      const response = await apiClient.get(`/communications/${checkInId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [checkInId]);

  useEffect(() => {
    if (checkInId) {
      fetchMessages();
    }
  }, [checkInId, fetchMessages]);

  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSending || !newMessage.trim()) return;
    const messageText = newMessage.trim();
    setIsSending(true);
    
    // Optimistic update: Add message immediately to UI
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      text: messageText,
      senderName: 'You', // Will be replaced with actual name from server
      timestamp: new Date()
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    try {
      const response = await apiClient.post(`/communications/${checkInId}/message`, {
        text: messageText
      });
      // Replace optimistic message with real one from server
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? response.data : msg
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(messageText); // Restore message text
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h4 className="font-semibold text-gray-900">Conversation</h4>
      {loading ? (
        <div className="mt-2"><Spinner label="Loading messages..." /></div>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {messages.map((message) => (
              <div key={message.id} className="rounded-md bg-gray-50 p-2">
                <p className="text-sm"><span className="font-medium text-gray-900">{message.senderName || 'Unknown User'}</span>: {message.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={isSending}
              className="flex-1 px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            />
            <button type="submit" disabled={isSending} className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isSending ? (<><Spinner /> <span className="text-white text-sm">Sending</span></>) : 'Send'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default CommunicationThread;

