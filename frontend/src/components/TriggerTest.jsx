import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function TriggerTest() {
  const [contacts, setContacts] = useState([]);
  const [flows, setFlows] = useState([]);
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedFlow, setSelectedFlow] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventData, setEventData] = useState('{}');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contactsData, flowsData] = await Promise.all([
        apiCall('/contacts'),
        apiCall('/flows')
      ]);
      setContacts(contactsData);
      setFlows(flowsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleTrigger = async () => {
    if (!selectedContact || !selectedFlow) {
      alert('Please select both contact and flow');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await apiCall('/webhooks/trigger', {
        method: 'POST',
        body: JSON.stringify({
          contactId: parseInt(selectedContact),
          flowId: parseInt(selectedFlow),
          eventData: JSON.parse(eventData)
        })
      });

      setResult({
        success: true,
        message: response.message || 'Flow triggered successfully!',
        flowName: response.flowName
      });
    } catch (error) {
      setResult({
        success: false,
        message: error.message || 'Failed to trigger flow'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '10px' }}>⚡ Flow Trigger Test</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Manually trigger flows for testing purposes
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '30px',
        marginBottom: '30px'
      }}>
        {/* Left Panel - Configuration */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Configuration</h3>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Select Contact
            </label>
            <select
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
            >
              <option value="">Choose a contact...</option>
              {contacts.map(contact => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} ({contact.phone})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Select Flow
            </label>
            <select
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
            >
              <option value="">Choose a flow...</option>
              {flows.map(flow => (
                <option key={flow.id} value={flow.id}>
                  {flow.name} {!flow.is_active && '(inactive)'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Event Name (optional)
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., abandoned_cart"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Event Data (JSON)
            </label>
            <textarea
              value={eventData}
              onChange={(e) => setEventData(e.target.value)}
              placeholder='{"key": "value"}'
              style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '8px', 
                border: '1px solid #ddd',
                minHeight: '120px',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}
            />
            <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
              Custom data to pass to the flow
            </small>
          </div>

          <button
            onClick={handleTrigger}
            disabled={loading || !selectedContact || !selectedFlow}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
            className={loading ? 'secondary' : 'success'}
          >
            {loading ? '⏳ Triggering...' : '🚀 Trigger Flow'}
          </button>
        </div>

        {/* Right Panel - Result */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Result</h3>

          {!result ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px', 
              color: '#999',
              border: '2px dashed #ddd',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎯</div>
              <p>Configure and trigger a flow to see results here</p>
            </div>
          ) : (
            <div style={{
              padding: '20px',
              borderRadius: '8px',
              background: result.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
              color: result.success ? '#155724' : '#721c24'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '15px', textAlign: 'center' }}>
                {result.success ? '✅' : '❌'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>
                {result.success ? 'Success!' : 'Failed'}
              </div>
              <div style={{ fontSize: '14px', textAlign: 'center', marginBottom: '15px' }}>
                {result.message}
              </div>
              {result.flowName && (
                <div style={{ 
                  fontSize: '13px', 
                  textAlign: 'center', 
                  padding: '10px',
                  background: 'rgba(255,255,255,0.5)',
                  borderRadius: '4px'
                }}>
                  Flow: <strong>{result.flowName}</strong>
                </div>
              )}
            </div>
          )}

          {/* Quick Info */}
          <div style={{ 
            marginTop: '30px', 
            padding: '15px', 
            background: '#f8f9fa', 
            borderRadius: '8px',
            fontSize: '13px',
            color: '#666'
          }}>
            <strong style={{ color: '#333', display: 'block', marginBottom: '10px' }}>
              💡 How it works:
            </strong>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Select a contact and flow from the dropdowns</li>
              <li>Optionally provide event data in JSON format</li>
              <li>Click "Trigger Flow" to start execution</li>
              <li>The flow will execute as if the contact triggered it naturally</li>
              <li>Check your WhatsApp to see the messages being sent</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Triggers */}
      <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>📋 Common Use Cases</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '3px solid #667eea' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Welcome Flow</div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              Test onboarding sequence for new contacts
            </div>
          </div>
          <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '3px solid #f093fb' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Abandoned Cart</div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              Test recovery flow with cart data
            </div>
          </div>
          <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '3px solid #4facfe' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Follow-up</div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              Test post-purchase follow-up sequence
            </div>
          </div>
          <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '3px solid #43e97b' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Re-engagement</div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              Test dormant user reactivation flow
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TriggerTest;