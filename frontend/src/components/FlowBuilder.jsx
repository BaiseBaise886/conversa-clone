import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function FlowBuilder() {
  const [flows, setFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFlow, setNewFlow] = useState({
    name: '',
    description: '',
    keyword_triggers: ''
  });

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/flows');
      setFlows(data);
    } catch (error) {
      console.error('Failed to load flows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async (e) => {
    e.preventDefault();
    
    try {
      const flowDefinition = {
        nodes: [
          {
            id: '1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: {}
          },
          {
            id: '2',
            type: 'botResponse',
            position: { x: 100, y: 200 },
            data: { message: 'Welcome! This is your new flow.' }
          }
        ],
        edges: [
          {
            id: 'e1-2',
            source: '1',
            target: '2'
          }
        ]
      };

      await apiCall('/flows', {
        method: 'POST',
        body: JSON.stringify({
          name: newFlow.name,
          description: newFlow.description,
          keyword_triggers: newFlow.keyword_triggers.split(',').map(k => k.trim()).filter(Boolean),
          flow_definition: flowDefinition,
          is_active: false
        })
      });

      setShowCreateForm(false);
      setNewFlow({ name: '', description: '', keyword_triggers: '' });
      loadFlows();
    } catch (error) {
      alert('Failed to create flow: ' + error.message);
    }
  };

  const handleToggleActive = async (flowId, currentStatus) => {
    try {
      await apiCall(`/flows/${flowId}/toggle`, {
        method: 'PATCH'
      });
      loadFlows();
    } catch (error) {
      alert('Failed to toggle flow: ' + error.message);
    }
  };

  const handleDeleteFlow = async (flowId) => {
    if (!confirm('Delete this flow?')) return;
    
    try {
      await apiCall(`/flows/${flowId}`, {
        method: 'DELETE'
      });
      loadFlows();
      setSelectedFlow(null);
    } catch (error) {
      alert('Failed to delete flow: ' + error.message);
    }
  };

  const handleDuplicateFlow = async (flowId) => {
    try {
      await apiCall(`/flows/${flowId}/duplicate`, {
        method: 'POST'
      });
      loadFlows();
    } catch (error) {
      alert('Failed to duplicate flow: ' + error.message);
    }
  };

  const renderNodeType = (type) => {
    const icons = {
      start: '▶️',
      botResponse: '💬',
      userInput: '⌨️',
      condition: '❓',
      delay: '⏱️',
      aiResponse: '🤖',
      assignAgent: '👤',
      logEvent: '📊',
      addTag: '🏷️',
      updateScore: '⭐',
      integration: '🔗'
    };
    return icons[type] || '📦';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🎨 Flow Builder</h2>
        <button onClick={() => setShowCreateForm(true)} className="success">
          ➕ Create Flow
        </button>
      </div>

      {/* Create Flow Modal */}
      {showCreateForm && (
        <div className="modal" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>Create New Flow</h3>
            <form onSubmit={handleCreateFlow}>
              <div style={{ marginBottom: '20px' }}>
                <label>Flow Name:</label>
                <input
                  type="text"
                  value={newFlow.name}
                  onChange={(e) => setNewFlow({...newFlow, name: e.target.value})}
                  required
                  placeholder="Welcome Sequence"
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label>Description:</label>
                <textarea
                  value={newFlow.description}
                  onChange={(e) => setNewFlow({...newFlow, description: e.target.value})}
                  placeholder="Describe what this flow does..."
                  style={{ width: '100%', padding: '10px', minHeight: '80px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label>Trigger Keywords (comma-separated):</label>
                <input
                  type="text"
                  value={newFlow.keyword_triggers}
                  onChange={(e) => setNewFlow({...newFlow, keyword_triggers: e.target.value})}
                  placeholder="start, hello, help"
                  style={{ width: '100%', padding: '10px' }}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  Flow will trigger when user sends any of these keywords
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateForm(false)} className="secondary">
                  Cancel
                </button>
                <button type="submit" className="success">
                  Create Flow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Flows List */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedFlow ? '1fr 1fr' : '1fr', gap: '20px' }}>
        {/* Flow List Panel */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner"></div>
              <p>Loading flows...</p>
            </div>
          ) : flows.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px',
              background: 'white',
              borderRadius: '12px',
              color: '#999'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '15px' }}>🎨</div>
              <h3 style={{ marginBottom: '10px', color: '#666' }}>No Flows Yet</h3>
              <p style={{ marginBottom: '20px' }}>Create your first automated flow</p>
              <button onClick={() => setShowCreateForm(true)} className="success">
                Create Flow
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {flows.map(flow => (
                <div
                  key={flow.id}
                  onClick={() => setSelectedFlow(flow)}
                  style={{
                    background: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: selectedFlow?.id === flow.id ? '2px solid #667eea' : '2px solid transparent',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedFlow?.id !== flow.id) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                        {flow.name}
                      </div>
                      {flow.description && (
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                          {flow.description}
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: flow.is_active ? '#d4edda' : '#f0f0f0',
                      color: flow.is_active ? '#28a745' : '#999'
                    }}>
                      {flow.is_active ? '✓ Active' : 'Inactive'}
                    </div>
                  </div>

                  {flow.keyword_triggers && flow.keyword_triggers.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                        Triggers:
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {flow.keyword_triggers.map((keyword, idx) => (
                          <span key={idx} style={{
                            padding: '2px 8px',
                            background: '#e7f3ff',
                            color: '#667eea',
                            borderRadius: '10px',
                            fontSize: '11px'
                          }}>
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {flow.flow_definition?.nodes?.length || 0} nodes • 
                    Created {new Date(flow.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flow Details Panel */}
        {selectedFlow && (
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Flow Details</h3>
              <button onClick={() => setSelectedFlow(null)} style={{ padding: '5px 10px', fontSize: '12px' }} className="secondary">
                ✖️
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>
                {selectedFlow.name}
              </div>
              {selectedFlow.description && (
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
                  {selectedFlow.description}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleToggleActive(selectedFlow.id, selectedFlow.is_active)}
                className={selectedFlow.is_active ? 'secondary' : 'success'}
              >
                {selectedFlow.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
              </button>
              <button onClick={() => handleDuplicateFlow(selectedFlow.id)}>
                📋 Duplicate
              </button>
              <button onClick={() => handleDeleteFlow(selectedFlow.id)} className="danger">
                🗑️ Delete
              </button>
            </div>

            {/* Flow Nodes */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '15px' }}>Flow Nodes ({selectedFlow.flow_definition?.nodes?.length || 0})</h4>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {selectedFlow.flow_definition?.nodes?.map((node, index) => (
                  <div
                    key={node.id}
                    style={{
                      padding: '12px',
                      marginBottom: '10px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      borderLeft: '3px solid #667eea'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '20px' }}>
                        {renderNodeType(node.type)}
                      </span>
                      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {node.type.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                    {node.data.message && (
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '5px', fontStyle: 'italic' }}>
                        "{node.data.message.substring(0, 100)}{node.data.message.length > 100 ? '...' : ''}"
                      </div>
                    )}
                    {node.data.seconds && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                        ⏱️ Wait: {node.data.seconds} seconds
                      </div>
                    )}
                    {node.data.tag && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                        🏷️ Tag: {node.data.tag}
                      </div>
                    )}
                    {node.data.saveAs && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                        💾 Save as: {node.data.saveAs}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Flow Info */}
            <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Created:</strong> {new Date(selectedFlow.created_at).toLocaleString()}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Updated:</strong> {new Date(selectedFlow.updated_at).toLocaleString()}
              </div>
              <div>
                <strong>Status:</strong> {selectedFlow.is_active ? '✓ Active' : 'Inactive'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      {!selectedFlow && (
        <div style={{ marginTop: '30px', background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '15px' }}>💡 About Flow Builder</h3>
          <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
            <p><strong>Available Node Types:</strong></p>
            <ul style={{ paddingLeft: '20px', marginTop: '10px', marginBottom: '15px' }}>
              <li><strong>▶️ Start:</strong> Entry point of the flow</li>
              <li><strong>💬 Bot Response:</strong> Send a message to the user</li>
              <li><strong>⌨️ User Input:</strong> Wait for user to respond</li>
              <li><strong>❓ Condition:</strong> Branch based on user response</li>
              <li><strong>⏱️ Delay:</strong> Wait before next action</li>
              <li><strong>🤖 AI Response:</strong> Use AI to generate response</li>
              <li><strong>👤 Assign Agent:</strong> Transfer to human agent</li>
              <li><strong>🏷️ Add Tag:</strong> Tag the contact</li>
              <li><strong>⭐ Update Score:</strong> Change engagement score</li>
              <li><strong>📊 Log Event:</strong> Track analytics</li>
            </ul>
            <p><strong>Tip:</strong> Use the AI Flow Generator to create complete flows from natural language descriptions!</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlowBuilder;