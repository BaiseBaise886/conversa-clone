import React, { useState, useEffect } from 'react';
import { apiCall, socket, connectWebSocket } from '../store';

function MultiChatInterface() {
  const [openChats, setOpenChats] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});
  const [newMessages, setNewMessages] = useState({});
  const [typing, setTyping] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
    
    if (!socket) {
      connectWebSocket();
    }

    if (socket) {
      socket.on('new_message', handleNewMessage);
      socket.on('user_typing', handleTyping);
      socket.on('user_stopped_typing', handleStoppedTyping);
      socket.on('messages_read', handleMessagesRead);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('user_typing', handleTyping);
        socket.off('user_stopped_typing', handleStoppedTyping);
        socket.off('messages_read', handleMessagesRead);
      };
    }
  }, [searchQuery, filterStatus]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      let params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      
      const data = await apiCall(`/conversations?${params.toString()}`);
      setConversations(data.conversations || data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (contactId) => {
    try {
      const data = await apiCall(`/conversations/${contactId}/messages`);
      setMessages(prev => ({ ...prev, [contactId]: data }));
      
      if (socket) {
        socket.emit('join_chat', { contactId });
        socket.emit('mark_read', { contactId });
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleOpenChat = (conversation) => {
    const contactId = conversation.contact_id;
    
    if (!openChats.find(c => c.contact_id === contactId)) {
      setOpenChats(prev => [...prev, conversation]);
      loadMessages(contactId);
    }
  };

  const handleCloseChat = (contactId) => {
    setOpenChats(prev => prev.filter(c => c.contact_id !== contactId));
    if (socket) {
      socket.emit('leave_chat', { contactId });
    }
  };

  const handleSendMessage = (contactId, e) => {
    e.preventDefault();
    const message = newMessages[contactId];
    if (!message?.trim()) return;

    if (socket) {
      socket.emit('send_message', {
        contactId,
        content: message
      });
      
      setNewMessages(prev => ({ ...prev, [contactId]: '' }));
    }
  };

  const handleTyping = (contactId, value) => {
    setNewMessages(prev => ({ ...prev, [contactId]: value }));
    
    if (socket) {
      if (value.trim()) {
        socket.emit('typing_start', { contactId });
      } else {
        socket.emit('typing_stop', { contactId });
      }
    }
  };

  const handleNewMessage = (data) => {
    const contactId = data.message.contact_id;
    
    setMessages(prev => ({
      ...prev,
      [contactId]: [...(prev[contactId] || []), data.message]
    }));
    
    loadConversations();
  };

  const handleTyping = (data) => {
    setTyping(prev => ({ ...prev, [data.contactId]: true }));
  };

  const handleStoppedTyping = (data) => {
    setTyping(prev => ({ ...prev, [data.contactId]: false }));
  };

  const handleMessagesRead = (data) => {
    loadConversations();
  };

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', gap: '20px' }}>
      {/* Conversations List */}
      <div style={{
        width: '350px',
        background: 'white',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '2px solid #f0f0f0' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>💬 Chats</h2>
          
          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              marginBottom: '10px'
            }}
          />

          {/* Filters */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {['all', 'pending', 'active', 'bot'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={filterStatus === status ? 'success' : 'secondary'}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px'
                }}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>💬</div>
              <p>No conversations</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.contact_id}
                onClick={() => handleOpenChat(conv)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  background: openChats.find(c => c.contact_id === conv.contact_id) ? '#e7f3ff' : '#f8f9fa',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderLeft: `3px solid ${conv.unread_count > 0 ? '#28a745' : '#ddd'}`
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e7f3ff'}
                onMouseLeave={(e) => {
                  if (!openChats.find(c => c.contact_id === conv.contact_id)) {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {conv.name || conv.phone}
                  </div>
                  {conv.unread_count > 0 && (
                    <span style={{
                      background: '#28a745',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                  {conv.last_message_preview?.substring(0, 40) || 'No messages'}
                  {conv.last_message_preview?.length > 40 && '...'}
                </div>
                <div style={{ fontSize: '11px', color: '#999' }}>
                  {conv.last_message_at 
                    ? new Date(conv.last_message_at).toLocaleString()
                    : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Multi-Chat Windows */}
      <div style={{ 
        flex: 1, 
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(openChats.length, 3)}, 1fr)`,
        gap: '15px'
      }}>
        {openChats.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            background: 'white',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '15px' }}>💬</div>
              <p>Select a conversation to start chatting</p>
              <p style={{ fontSize: '13px', marginTop: '10px' }}>
                You can open multiple chats side by side
              </p>
            </div>
          </div>
        ) : (
          openChats.map(chat => (
            <div
              key={chat.contact_id}
              style={{
                background: 'white',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                maxHeight: '100%'
              }}
            >
              {/* Chat Header */}
              <div style={{
                padding: '12px',
                borderBottom: '2px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {chat.name || chat.phone}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {typing[chat.contact_id] ? 'Typing...' : chat.phone}
                  </div>
                </div>
                <button
                  onClick={() => handleCloseChat(chat.contact_id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: '#999',
                    padding: '0',
                    width: '24px',
                    height: '24px'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Messages Area */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '15px',
                background: '#fafafa',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {messages[chat.contact_id]?.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.type === 'inbound' ? 'flex-start' : 'flex-end',
                      maxWidth: '80%'
                    }}
                  >
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '12px',
                      background: msg.type === 'inbound' ? 'white' : '#667eea',
                      color: msg.type === 'inbound' ? '#333' : 'white',
                      fontSize: '13px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}
                      <div style={{
                        fontSize: '9px',
                        marginTop: '3px',
                        opacity: 0.7,
                        textAlign: 'right'
                      }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <form
                onSubmit={(e) => handleSendMessage(chat.contact_id, e)}
                style={{
                  padding: '12px',
                  borderTop: '2px solid #f0f0f0',
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <input
                  type="text"
                  value={newMessages[chat.contact_id] || ''}
                  onChange={(e) => handleTyping(chat.contact_id, e.target.value)}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '16px',
                    fontSize: '13px'
                  }}
                />
                <button
                  type="submit"
                  disabled={!newMessages[chat.contact_id]?.trim()}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px'
                  }}
                >
                  📤
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MultiChatInterface;