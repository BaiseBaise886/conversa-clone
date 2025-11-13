import React, { useState, useEffect } from 'react';
import { apiCall, socket, connectWebSocket } from '../store';

function LiveChat() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, active, resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
    
    // Connect WebSocket
    if (!socket) {
      connectWebSocket();
    }
    
    // Setup Socket.IO listeners
    if (socket) {
      socket.on('chat_claimed', handleChatClaimed);
      socket.on('chat_resolved', handleChatResolved);
      socket.on('new_message', handleNewMessage);
      
      return () => {
        socket.off('chat_claimed', handleChatClaimed);
        socket.off('chat_resolved', handleChatResolved);
        socket.off('new_message', handleNewMessage);
      };
    }
  }, [filter]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const data = await apiCall(`/conversations${params}`);
      setSessions(data.conversations || data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (contactId) => {
    try {
      const data = await apiCall(`/conversations/${contactId}/messages`);
      setMessages(data);
      
      // Join chat room
      if (socket) {
        socket.emit('join_chat', { contactId });
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleClaimChat = async (contactId) => {
    if (socket) {
      socket.emit('claim_chat', { contactId });
    }
  };

  const handleResolveChat = async (contactId) => {
    if (socket) {
      socket.emit('resolve_chat', { contactId });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedSession) return;
    
    if (socket) {
      socket.emit('send_message', {
        contactId: selectedSession.contact_id,
        content: newMessage
      });
      
      setNewMessage('');
    }
  };

  const handleChatClaimed = (data) => {
    loadSessions();
  };

  const handleChatResolved = (data) => {
    if (selectedSession?.contact_id === data.contactId) {
      setSelectedSession(null);
    }
    loadSessions();
  };

  const handleNewMessage = (data) => {
    if (selectedSession?.contact_id === data.message.contact_id) {
      setMessages(prev => [...prev, data.message]);
    }
    loadSessions();
  };

  const handleSelectSession = (session) => {
    setSelectedSession(session);
    loadMessages(session.contact_id);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '10px' }}>💬 Live Chat</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'success' : 'secondary'}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={filter === 'pending' ? 'success' : 'secondary'}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('active')}
            className={filter === 'active' ? 'success' : 'secondary'}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={filter === 'resolved' ? 'success' : 'secondary'}
          >
            Resolved
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedSession ? '350px 1fr' : '1fr',
        gap: '20px',
        height: 'calc(100vh - 250px)'
      }}>
        {/* Sessions List */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '15px',
          overflowY: 'auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>
            Conversations ({sessions.length})
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>💬</div>
              <p>No {filter !== 'all' ? filter : ''} chats</p>
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.contact_id}
                onClick={() => handleSelectSession(session)}
                style={{
                  padding: '12px',
                  marginBottom: '10px',
                  background: selectedSession?.contact_id === session.contact_id ? '#e7f3ff' : '#f8f9fa',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${
                    session.chat_status === 'pending' ? '#ffc107' :
                    session.chat_status === 'active' ? '#28a745' : '#6c757d'
                  }`
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{session.name || session.phone}</span>
                  {session.unread_count > 0 && (
                    <span style={{
                      background: '#28a745',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px'
                    }}>
                      {session.unread_count}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {session.last_message_preview?.substring(0, 50) || 'No messages'}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                  {session.last_message_at 
                    ? new Date(session.last_message_at).toLocaleString()
                    : 'No activity'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat Window */}
        {selectedSession && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {/* Header */}
            <div style={{
              padding: '15px',
              borderBottom: '2px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {selectedSession.name || selectedSession.phone}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {selectedSession.phone} • {selectedSession.channel_type}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedSession.chat_status === 'pending' && (
                  <button onClick={() => handleClaimChat(selectedSession.contact_id)} className="success" style={{ padding: '8px 15px', fontSize: '13px' }}>
                    ✋ Claim
                  </button>
                )}
                {selectedSession.chat_status === 'active' && (
                  <button onClick={() => handleResolveChat(selectedSession.contact_id)} className="secondary" style={{ padding: '8px 15px', fontSize: '13px' }}>
                    ✓ Resolve
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  No messages yet
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.type === 'inbound' ? 'flex-start' : 'flex-end',
                      maxWidth: '70%'
                    }}
                  >
                    <div style={{
                      padding: '10px 15px',
                      borderRadius: '12px',
                      background: msg.type === 'inbound' ? 'white' : '#667eea',
                      color: msg.type === 'inbound' ? '#333' : 'white',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      {msg.content}
                      <div style={{
                        fontSize: '10px',
                        marginTop: '5px',
                        opacity: 0.7,
                        textAlign: 'right'
                      }}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} style={{
              padding: '15px',
              borderTop: '2px solid #f0f0f0',
              display: 'flex',
              gap: '10px'
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '20px'
                }}
              />
              <button type="submit" disabled={!newMessage.trim()}>
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveChat;