import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './MultiChatInterface.css';

const MultiChatInterface = ({ socket }) => {
  // State declarations
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');

  /**
   * Updates the input value when a user types
   * @param {Event} e - The input event
   */
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  /**
   * Handles typing indicator from remote users
   * @param {string} user - User that is typing
   */
  const handleRemoteTyping = (user) => {
    // Logic for handling remote typing
  };

  useEffect(() => {
    socket.on('remoteTyping', handleRemoteTyping);
    return () => {
      socket.off('remoteTyping', handleRemoteTyping);
    };
  }, [socket]);

  const sendMessage = () => {
    if (inputValue.trim()) {
      socket.emit('sendMessage', inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="chat-interface">
      <input type="text" value={inputValue} onChange={handleInputChange} placeholder="Type a message..." />
      <button onClick={sendMessage}>Send</button>
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>
    </div>
  );
};

MultiChatInterface.propTypes = {
  socket: PropTypes.object.isRequired,
};

export default MultiChatInterface;
