import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function ContactTags({ contactId }) {
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, [contactId]);

  const loadTags = async () => {
    if (!contactId) return;
    
    setLoading(true);
    try {
      const data = await apiCall(`/marketing/tags/${contactId}`);
      setTags(data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    try {
      await apiCall(`/marketing/tags/${contactId}`, {
        method: 'POST',
        body: JSON.stringify({
          tag_name: newTag.toLowerCase().replace(/\s+/g, '_'),
          tag_value: newTag
        })
      });
      setNewTag('');
      loadTags();
    } catch (error) {
      alert('Failed to add tag: ' + error.message);
    }
  };

  const handleRemoveTag = async (tagName) => {
    try {
      await apiCall(`/marketing/tags/${contactId}/${encodeURIComponent(tagName)}`, {
        method: 'DELETE'
      });
      loadTags();
    } catch (error) {
      alert('Failed to remove tag: ' + error.message);
    }
  };

  const handleAutoTag = async () => {
    try {
      await apiCall(`/ai/auto-tag/${contactId}`, {
        method: 'POST'
      });
      loadTags();
    } catch (error) {
      alert('Failed to auto-tag: ' + error.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '10px', textAlign: 'center' }}>Loading tags...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h4 style={{ margin: 0 }}>🏷️ Tags</h4>
        <button onClick={handleAutoTag} style={{ padding: '5px 10px', fontSize: '12px' }} className="secondary">
          🤖 Auto-Tag
        </button>
      </div>

      {/* Existing Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px', minHeight: '40px' }}>
        {tags.length === 0 ? (
          <div style={{ color: '#999', fontSize: '13px', padding: '10px' }}>
            No tags yet. Add tags to segment this contact.
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                background: tag.auto_generated ? '#e7f3ff' : '#667eea',
                color: tag.auto_generated ? '#667eea' : 'white',
                borderRadius: '15px',
                fontSize: '13px',
                border: tag.auto_generated ? '1px solid #667eea' : 'none'
              }}
            >
              <span>
                {tag.auto_generated && '🤖 '}
                {tag.tag_value || tag.tag_name}
              </span>
              <button
                onClick={() => handleRemoveTag(tag.tag_name)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '14px',
                  opacity: 0.7
                }}
                title="Remove tag"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Tag Form */}
      <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add a tag..."
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '13px'
          }}
        />
        <button type="submit" disabled={!newTag.trim()} style={{ padding: '8px 16px', fontSize: '13px' }}>
          Add
        </button>
      </form>

      {/* Common Tags Suggestions */}
      <div style={{ marginTop: '15px' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
          Quick add:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['hot_lead', 'qualified', 'interested', 'follow_up', 'customer', 'vip'].map(tag => (
            <button
              key={tag}
              onClick={() => {
                setNewTag(tag);
                handleAddTag({ preventDefault: () => {} });
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                background: 'transparent',
                border: '1px solid #ddd',
                borderRadius: '10px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        background: '#f8f9fa', 
        borderRadius: '6px', 
        fontSize: '11px',
        color: '#666'
      }}>
        <strong>💡 Tip:</strong> Tags help segment contacts for targeted campaigns and personalized flows.
        Use 🤖 Auto-Tag to let AI suggest tags based on behavior.
      </div>
    </div>
  );
}

export default ContactTags;