import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function FlowAnalytics({ flowId }) {
  const [dropOffData, setDropOffData] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [timeData, setTimeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('dropoff'); // dropoff, funnel, timeline

  useEffect(() => {
    if (flowId) {
      loadAnalytics();
    }
  }, [flowId]);

  const loadAnalytics = async () => {
    if (!flowId) return;
    
    setLoading(true);
    try {
      const [dropOff, funnel, timeline] = await Promise.all([
        apiCall(`/analytics/dropoff/${flowId}`),
        apiCall(`/analytics/funnel/${flowId}`),
        apiCall(`/analytics/timeline/${flowId}?days=7`)
      ]);
      
      setDropOffData(dropOff);
      setFunnelData(funnel);
      setTimeData(timeline);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!flowId) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
        <p>Select a flow to view analytics</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '15px' }}>📊 Flow Analytics</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setSelectedView('dropoff')}
            className={selectedView === 'dropoff' ? 'success' : 'secondary'}
          >
            📉 Drop-off Analysis
          </button>
          <button
            onClick={() => setSelectedView('funnel')}
            className={selectedView === 'funnel' ? 'success' : 'secondary'}
          >
            🔄 Funnel View
          </button>
          <button
            onClick={() => setSelectedView('timeline')}
            className={selectedView === 'timeline' ? 'success' : 'secondary'}
          >
            📅 Timeline
          </button>
        </div>
      </div>

      {/* Drop-off Analysis */}
      {selectedView === 'dropoff' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h4 style={{ marginBottom: '20px' }}>Where Users Drop Off</h4>
          
          {dropOffData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No data yet. Users need to interact with this flow first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dropOffData.map((node, index) => {
                const dropOffRate = parseFloat(node.drop_off_rate) * 100;
                const color = dropOffRate > 50 ? '#dc3545' : dropOffRate > 25 ? '#ffc107' : '#28a745';
                
                return (
                  <div
                    key={index}
                    style={{
                      padding: '15px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${color}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                          {node.node_type} - {node.node_id}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          Reached: {node.reached} users
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>
                        {dropOffRate.toFixed(1)}%
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div style={{ 
                      height: '8px', 
                      background: '#e0e0e0', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${dropOffRate}%`, 
                        background: color,
                        transition: 'width 0.3s'
                      }} />
                    </div>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '10px',
                      marginTop: '10px',
                      fontSize: '13px',
                      color: '#666'
                    }}>
                      <div>✅ Completed: {node.completed}</div>
                      <div>❌ Dropped: {node.dropped}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Funnel View */}
      {selectedView === 'funnel' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h4 style={{ marginBottom: '20px' }}>Conversion Funnel</h4>
          
          {funnelData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No funnel data available yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {funnelData.map((stage, index) => {
                const maxReached = funnelData[0]?.reached || 1;
                const percentage = (stage.reached / maxReached) * 100;
                
                return (
                  <div key={index} style={{ position: 'relative' }}>
                    {/* Funnel Stage */}
                    <div style={{
                      background: `linear-gradient(135deg, #667eea ${percentage}%, #f0f0f0 ${percentage}%)`,
                      padding: '20px',
                      borderRadius: '8px',
                      color: percentage > 50 ? 'white' : '#333',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
                            {index + 1}. {stage.label}
                          </div>
                          <div style={{ fontSize: '13px', opacity: 0.9 }}>
                            {stage.nodeType}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                            {stage.reached}
                          </div>
                          <div style={{ fontSize: '13px', opacity: 0.9 }}>
                            {percentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Arrow */}
                    {index < funnelData.length - 1 && (
                      <div style={{ 
                        textAlign: 'center', 
                        fontSize: '24px', 
                        color: '#ddd',
                        margin: '5px 0'
                      }}>
                        ↓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {funnelData.length > 0 && (
            <div style={{ 
              marginTop: '30px', 
              padding: '20px', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px'
            }}>
              <div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>Total Started</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>
                  {funnelData[0]?.reached || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>Completed</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                  {funnelData[funnelData.length - 1]?.completed || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>Conversion Rate</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                  {funnelData.length > 0 
                    ? ((funnelData[funnelData.length - 1]?.completed || 0) / (funnelData[0]?.reached || 1) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline View */}
      {selectedView === 'timeline' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h4 style={{ marginBottom: '20px' }}>Performance Over Time (Last 7 Days)</h4>
          
          {timeData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No timeline data available yet.
            </div>
          ) : (
            <div>
              {/* Simple Bar Chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '200px', marginBottom: '20px' }}>
                {timeData.map((day, index) => {
                  const maxStarts = Math.max(...timeData.map(d => parseInt(d.total_starts) || 0));
                  const height = maxStarts > 0 ? (parseInt(day.total_starts) / maxStarts) * 100 : 0;
                  
                  return (
                    <div
                      key={index}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${height}%`,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '10px',
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                        title={`${day.total_starts} starts, ${day.completions} completions`}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '-25px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#667eea'
                        }}>
                          {day.total_starts}
                        </div>
                      </div>
                      <div style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: '#666',
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                      }}>
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Starts</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Completions</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Abandons</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Avg Time</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeData.map((day, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px' }}>
                          {new Date(day.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          {day.total_starts}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#28a745' }}>
                          {day.completions}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#dc3545' }}>
                          {day.abandons}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          {day.avg_completion_time ? `${Math.round(parseFloat(day.avg_completion_time) / 60)}m` : '-'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                          {day.avg_conversion_value ? `$${parseFloat(day.avg_conversion_value).toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights */}
      <div style={{ 
        marginTop: '20px', 
        background: '#fff3cd', 
        padding: '15px', 
        borderRadius: '8px',
        border: '1px solid #ffc107'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#856404' }}>
          💡 Optimization Tips:
        </div>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404', fontSize: '14px' }}>
          {dropOffData.length > 0 && parseFloat(dropOffData[0]?.drop_off_rate) > 0.3 && (
            <li>High drop-off detected at "{dropOffData[0]?.node_type}" - consider simplifying or improving this step</li>
          )}
          <li>Use A/B testing to compare different message variations</li>
          <li>Monitor response patterns to understand what resonates with users</li>
          <li>Set up conversion tracking to measure ROI accurately</li>
        </ul>
      </div>
    </div>
  );
}

export default FlowAnalytics;