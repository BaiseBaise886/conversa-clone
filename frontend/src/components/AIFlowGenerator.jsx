import React, { useState } from 'react';
import { apiCall } from '../store';

function AIFlowGenerator({ onFlowGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedFlow, setGeneratedFlow] = useState(null);
  const [error, setError] = useState('');

  const examplePrompts = [
    "Create a welcome flow for new users that introduces my product and asks for their needs",
    "Build an abandoned cart recovery flow with a discount code incentive",
    "Generate a lead qualification flow that identifies hot leads for my sales team",
    "Create a product launch flow with multiple touchpoints and A/B test variants",
    "Build a customer satisfaction survey flow with sentiment tracking"
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedFlow(null);

    try {
      const response = await apiCall('/ai/generate-flow', {
        method: 'POST',
        body: JSON.stringify({ prompt })
      });

      setGeneratedFlow(response);
    } catch (err) {
      setError(err.message || 'Failed to generate flow');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFlow = async () => {
    if (!generatedFlow) return;

    try {
      await apiCall('/flows', {
        method: 'POST',
        body: JSON.stringify({
          name: generatedFlow.name,
          description: generatedFlow.description,
          keyword_triggers: generatedFlow.keywords || [],
          flow_definition: generatedFlow,
          is_active: false
        })
      });

      alert('Flow saved successfully! You can activate it in the Flow Builder.');
      setGeneratedFlow(null);
      setPrompt('');
      if (onFlowGenerated) onFlowGenerated();
    } catch (error) {
      alert('Failed to save flow: ' + error.message);
    }
  };

  return (
    <div style={{ marginBottom: '30px' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '30px', color: 'white', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', color: 'white' }}>
          🤖 AI Flow Generator
        </h2>
        <p style={{ fontSize: '15px', opacity: 0.9 }}>
          Describe your marketing flow in plain English, and AI will generate it for you
        </p>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500', fontSize: '15px' }}>
            Describe your flow:
          </label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError('');
            }}
            placeholder="Example: Create a 3-day welcome sequence for new subscribers. Start with a welcome message, wait 24 hours, send a product demo video, wait another 24 hours, then offer a 20% discount code..."
            style={{
              width: '100%',
              minHeight: '150px',
              padding: '15px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '15px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: '15px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c33',
            marginBottom: '20px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={{
            padding: '14px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}
          className={loading ? 'secondary' : 'success'}
        >
          {loading ? '🔄 Generating with AI...' : '✨ Generate Flow'}
        </button>

        {/* Example Prompts */}
        <div style={{ marginTop: '25px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ fontWeight: '500', marginBottom: '12px', color: '#333' }}>
            💡 Example Prompts (click to use):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {examplePrompts.map((example, index) => (
              <div
                key={index}
                onClick={() => setPrompt(example)}
                style={{
                  padding: '12px',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.background = '#f0f4ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#ddd';
                  e.currentTarget.style.background = 'white';
                }}
              >
                {example}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Flow Preview */}
      {generatedFlow && (
        <div style={{ marginTop: '20px', background: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '20px' }}>✨ Generated Flow</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setGeneratedFlow(null)} className="secondary">
                ✖️ Discard
              </button>
              <button onClick={handleSaveFlow} className="success">
                💾 Save Flow
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', background: '#e7f3ff', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              {generatedFlow.name}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
              {generatedFlow.description}
            </div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              <strong>Category:</strong> {generatedFlow.category} | 
              <strong> Trigger Keywords:</strong> {generatedFlow.keywords?.join(', ') || 'None'}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong style={{ fontSize: '15px', display: 'block', marginBottom: '10px' }}>
              Flow Steps ({generatedFlow.nodes?.length || 0} nodes):
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {generatedFlow.nodes?.map((node, index) => (
                <div
                  key={node.id}
                  style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    borderLeft: '3px solid #667eea',
                    fontSize: '14px'
                  }}
                >
                  <div style={{ fontWeight: '500', marginBottom: '5px' }}>
                    {index + 1}. {node.type === 'botResponse' && '💬'}
                    {node.type === 'userInput' && '⌨️'}
                    {node.type === 'delay' && '⏱️'}
                    {node.type === 'condition' && '❓'}
                    {node.type === 'aiResponse' && '🤖'}
                    {' '}
                    {node.type.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  {node.data.message && (
                    <div style={{ color: '#666', fontSize: '13px' }}>
                      "{node.data.message.substring(0, 80)}{node.data.message.length > 80 ? '...' : ''}"
                    </div>
                  )}
                  {node.data.seconds && (
                    <div style={{ color: '#666', fontSize: '13px' }}>
                      Wait: {node.data.seconds} seconds
                    </div>
                  )}
                  {node.data.tag && (
                    <div style={{ color: '#666', fontSize: '13px' }}>
                      Tag: {node.data.tag}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
            <div style={{ fontWeight: '500', marginBottom: '5px', color: '#856404' }}>
              ⚠️ Review Before Activation
            </div>
            <div style={{ fontSize: '13px', color: '#856404' }}>
              This flow was generated by AI. Please review all messages and logic before activating it for production use.
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div style={{ marginTop: '20px', background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>💡 Tips for Better Results:</h4>
        <ul style={{ fontSize: '14px', color: '#666', paddingLeft: '20px', margin: 0 }}>
          <li>Be specific about timing (e.g., "wait 24 hours between messages")</li>
          <li>Mention the goal (e.g., "qualify leads", "recover abandoned carts")</li>
          <li>Include branching logic (e.g., "if they say yes, do X, otherwise do Y")</li>
          <li>Specify tone and style (e.g., "friendly and casual" or "professional")</li>
          <li>Mention any special features (e.g., "use AI to answer questions", "add tags")</li>
        </ul>
      </div>
    </div>
  );
}

export default AIFlowGenerator;