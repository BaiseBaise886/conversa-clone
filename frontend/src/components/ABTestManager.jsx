import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function ABTestManager({ flowId }) {
  const [variants, setVariants] = useState([]);
  const [testResults, setTestResults] = useState(null);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newVariant, setNewVariant] = useState({
    variantName: '',
    trafficPercentage: 50
  });

  useEffect(() => {
    if (flowId) {
      loadTestData();
    }
  }, [flowId]);

  const loadTestData = async () => {
    if (!flowId) return;
    
    setLoading(true);
    try {
      const [variantsData, resultsData, winnerData] = await Promise.all([
        apiCall(`/analytics/abtest/${flowId}/variants`),
        apiCall(`/analytics/abtest/${flowId}`),
        apiCall(`/analytics/abtest/${flowId}/winner`).catch(() => null)
      ]);
      
      setVariants(variantsData);
      setTestResults(resultsData);
      setWinner(winnerData);
    } catch (error) {
      console.error('Failed to load A/B test data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariant = async (e) => {
    e.preventDefault();
    
    try {
      // In a real implementation, you'd have a flow editor to modify the flow
      // For now, we'll just create a copy of the original flow
      const originalFlow = await apiCall(`/flows/${flowId}`);
      
      await apiCall('/analytics/abtest/variant', {
        method: 'POST',
        body: JSON.stringify({
          flowId: parseInt(flowId),
          variantName: newVariant.variantName,
          flowDefinition: originalFlow.flow_definition,
          trafficPercentage: parseInt(newVariant.trafficPercentage)
        })
      });
      
      setShowCreateForm(false);
      setNewVariant({ variantName: '', trafficPercentage: 50 });
      loadTestData();
    } catch (error) {
      alert('Failed to create variant: ' + error.message);
    }
  };

  const handlePromoteWinner = async (variantId) => {
    if (!confirm('Promote this variant as the main flow? This will deactivate all other variants.')) {
      return;
    }
    
    try {
      await apiCall(`/analytics/abtest/${flowId}/promote`, {
        method: 'POST',
        body: JSON.stringify({ variantId })
      });
      
      alert('Variant promoted successfully!');
      loadTestData();
    } catch (error) {
      alert('Failed to promote variant: ' + error.message);
    }
  };

  const handleDeactivateVariant = async (variantId) => {
    if (!confirm('Deactivate this variant?')) return;
    
    try {
      await apiCall(`/analytics/abtest/variant/${variantId}`, {
        method: 'DELETE'
      });
      
      loadTestData();
    } catch (error) {
      alert('Failed to deactivate variant: ' + error.message);
    }
  };

  if (!flowId) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>🧪</div>
        <p>Select a flow to manage A/B tests</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner"></div>
        <p>Loading A/B test data...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>🧪 A/B Testing</h3>
        <button onClick={() => setShowCreateForm(true)} className="success">
          ➕ Create Variant
        </button>
      </div>

      {/* Winner Banner */}
      {winner && winner.hasWinner && (
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #38ef7d 0%, #11998e 100%)',
          color: 'white',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(56, 239, 125, 0.3)'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>
            🏆 Winner Detected!
          </div>
          <div style={{ fontSize: '16px', opacity: 0.95, marginBottom: '15px' }}>
            Variant has {winner.improvement}% improvement with {winner.confidence} confidence
          </div>
          <button
            onClick={() => handlePromoteWinner(winner.winner.variant_id)}
            style={{
              padding: '10px 20px',
              background: 'white',
              color: '#11998e',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🚀 Promote to Main Flow
          </button>
        </div>
      )}

      {/* Create Variant Modal */}
      {showCreateForm && (
        <div className="modal" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>Create A/B Test Variant</h3>
            <form onSubmit={handleCreateVariant}>
              <div style={{ marginBottom: '20px' }}>
                <label>Variant Name:</label>
                <input
                  type="text"
                  value={newVariant.variantName}
                  onChange={(e) => setNewVariant({...newVariant, variantName: e.target.value})}
                  required
                  placeholder="e.g., Variant B - Shorter Messages"
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label>Traffic Split (%):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newVariant.trafficPercentage}
                  onChange={(e) => setNewVariant({...newVariant, trafficPercentage: e.target.value})}
                  required
                  style={{ width: '100%', padding: '10px' }}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  Percentage of users who will see this variant
                </small>
              </div>

              <div style={{
                padding: '15px',
                background: '#f8f9fa',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#666'
              }}>
                <strong>Note:</strong> After creating, you'll need to modify the variant's flow definition in the Flow Builder to create a meaningful test.
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateForm(false)} className="secondary">
                  Cancel
                </button>
                <button type="submit" className="success">
                  Create Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variants List */}
      {variants.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          background: 'white',
          borderRadius: '12px',
          color: '#999'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '15px' }}>🧪</div>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>No A/B Tests Yet</h3>
          <p style={{ marginBottom: '20px' }}>Create variants to test different approaches and optimize conversion</p>
          <button onClick={() => setShowCreateForm(true)} className="success">
            Create Your First Variant
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Control (Original) */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #667eea'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                  🎯 Control (Original)
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
                  The original flow version
                </div>
              </div>
              <div style={{
                padding: '5px 12px',
                background: '#e7f3ff',
                color: '#667eea',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                CONTROL
              </div>
            </div>

            {testResults && testResults.length > 0 && testResults[0] && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '15px',
                marginTop: '15px',
                padding: '15px',
                background: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Users</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {testResults[0].total_starts || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Conversion</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                    {testResults[0].avg_conversion_rate 
                      ? `${(parseFloat(testResults[0].avg_conversion_rate) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Avg Time</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {testResults[0].avg_time_seconds 
                      ? `${Math.round(parseFloat(testResults[0].avg_time_seconds) / 60)}m`
                      : '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Revenue</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea' }}>
                    {testResults[0].total_revenue 
                      ? `$${parseFloat(testResults[0].total_revenue).toFixed(0)}`
                      : '$0'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Variants */}
          {variants.map((variant, index) => {
            const variantResults = testResults?.find(r => r.variant_id === variant.id);
            const isActive = variant.is_active;
            
            return (
              <div
                key={variant.id}
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${isActive ? '#f093fb' : '#ccc'}`,
                  opacity: isActive ? 1 : 0.6
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                      {variant.variant_name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      Traffic: {variant.traffic_percentage}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isActive ? (
                      <div style={{
                        padding: '5px 12px',
                        background: '#d4edda',
                        color: '#28a745',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        ✓ ACTIVE
                      </div>
                    ) : (
                      <div style={{
                        padding: '5px 12px',
                        background: '#f0f0f0',
                        color: '#999',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        INACTIVE
                      </div>
                    )}
                    {isActive && (
                      <button
                        onClick={() => handleDeactivateVariant(variant.id)}
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                        className="danger"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>

                {variantResults ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '15px',
                    padding: '15px',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Users</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {variantResults.total_starts || 0}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Conversion</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                        {variantResults.avg_conversion_rate 
                          ? `${(parseFloat(variantResults.avg_conversion_rate) * 100).toFixed(1)}%`
                          : '0%'}
                      </div>
                      {testResults[0] && variantResults.avg_conversion_rate && testResults[0].avg_conversion_rate && (
                        <div style={{ fontSize: '11px', color: parseFloat(variantResults.avg_conversion_rate) > parseFloat(testResults[0].avg_conversion_rate) ? '#28a745' : '#dc3545' }}>
                          {parseFloat(variantResults.avg_conversion_rate) > parseFloat(testResults[0].avg_conversion_rate) ? '↑' : '↓'}
                          {' '}
                          {Math.abs(((parseFloat(variantResults.avg_conversion_rate) - parseFloat(testResults[0].avg_conversion_rate)) / parseFloat(testResults[0].avg_conversion_rate)) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Avg Time</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {variantResults.avg_time_seconds 
                          ? `${Math.round(parseFloat(variantResults.avg_time_seconds) / 60)}m`
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Revenue</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea' }}>
                        {variantResults.total_revenue 
                          ? `$${parseFloat(variantResults.total_revenue).toFixed(0)}`
                          : '$0'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#999',
                    fontSize: '13px'
                  }}>
                    No data yet. Variant needs user interactions to show results.
                  </div>
                )}

                {variantResults && parseInt(variantResults.total_starts) > 100 && (
                  <button
                    onClick={() => handlePromoteWinner(variant.id)}
                    style={{ marginTop: '15px', padding: '8px 16px', fontSize: '13px' }}
                    className="success"
                  >
                    🚀 Promote to Main Flow
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Statistical Info */}
      <div style={{
        marginTop: '30px',
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h4 style={{ marginBottom: '15px' }}>📚 About A/B Testing</h4>
        <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          <p><strong>How it works:</strong></p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>Create variants to test different versions of your flow</li>
            <li>Traffic is automatically split between control and variants</li>
            <li>Statistical significance is calculated automatically (95% confidence)</li>
            <li>Minimum sample size: 100 users per variant</li>
            <li>Once a winner is detected, you can promote it to become the main flow</li>
          </ul>
          
          <p style={{ marginTop: '15px' }}><strong>Best Practices:</strong></p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>Test one variable at a time (message copy, timing, sequence, etc.)</li>
            <li>Run tests for at least 7 days or until statistical significance</li>
            <li>Aim for at least 100-200 users per variant for reliable results</li>
            <li>Don't stop tests too early - let them reach significance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ABTestManager;