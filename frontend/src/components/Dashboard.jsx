import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const statsData = await apiCall('/webhooks/stats');
      setStats(statsData);

      const eventsData = await apiCall('/webhooks/events?limit=10');
      setRecentActivity(eventsData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const StatCard = ({ icon, title, value, color, subtitle }) => (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '25px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            {title}
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
            {value?.toLocaleString() || 0}
          </div>
          {subtitle && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ fontSize: '40px', opacity: 0.3 }}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>📊 Dashboard</h1>
        <p style={{ color: '#666' }}>Welcome back! Here's your overview.</p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <StatCard
          icon="👥"
          title="Total Contacts"
          value={stats?.totalContacts}
          color="#667eea"
        />
        <StatCard
          icon="💬"
          title="Total Messages"
          value={stats?.totalMessages}
          color="#f093fb"
        />
        <StatCard
          icon="💼"
          title="Active Flows"
          value={stats?.activeFlows}
          color="#4facfe"
        />
        <StatCard
          icon="📱"
          title="Connected Channels"
          value={stats?.connectedChannels}
          color="#43e97b"
        />
      </div>

      {/* Chat Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <StatCard
          icon="🔔"
          title="Pending Chats"
          value={stats?.pendingChats}
          color="#ff9a56"
          subtitle="Awaiting response"
        />
        <StatCard
          icon="💡"
          title="Active Chats"
          value={stats?.activeChats}
          color="#00d2ff"
          subtitle="In progress"
        />
        <StatCard
          icon="✅"
          title="Resolved Chats"
          value={stats?.resolvedChats}
          color="#38ef7d"
          subtitle="Completed"
        />
      </div>

      {/* Recent Activity */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '25px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          📋 Recent Activity
        </h2>
        
        {recentActivity.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📭</div>
            <p>No recent activity yet</p>
            <p style={{ fontSize: '14px', marginTop: '5px' }}>Events will appear here as they happen</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.map((event, index) => (
              <div
                key={index}
                style={{
                  padding: '15px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderLeft: '3px solid #667eea'
                }}
              >
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '5px' }}>
                    {event.event_name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {event.contact_name || event.phone || 'Unknown contact'}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#999', textAlign: 'right' }}>
                  {new Date(event.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{
        marginTop: '30px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '30px',
        color: 'white'
      }}>
        <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>🚀 Quick Actions</h2>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button className="secondary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
            ➕ Create Flow
          </button>
          <button className="secondary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
            👥 Add Contact
          </button>
          <button className="secondary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
            📊 View Analytics
          </button>
          <button className="secondary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
            📱 Connect Channel
          </button>
        </div>
      </div>

      {/* Tips Section */}
      <div style={{
        marginTop: '30px',
        background: '#fff3cd',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #ffc107'
      }}>
        <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#856404' }}>
          💡 Pro Tips
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404' }}>
          <li>Use AI to generate flows from natural language</li>
          <li>Set up A/B tests to optimize your conversion rates</li>
          <li>Enable auto-tagging to segment users automatically</li>
          <li>Monitor drop-off analysis to find improvement areas</li>
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;