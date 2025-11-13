import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Setup from './components/Setup';
import Dashboard from './components/Dashboard';
import FlowBuilder from './components/FlowBuilder';
import LiveChat from './components/LiveChat';
import CRM from './components/CRM';
import TriggerTest from './components/TriggerTest';
import AIFlowGenerator from './components/AIFlowGenerator';
import MarketingBrain from './components/MarketingBrain';
import MediaLibrary from './components/MediaLibrary';
import FlowAnalytics from './components/FlowAnalytics';
import ABTestManager from './components/ABTestManager';
import MultiChatInterface from './components/MultiChatInterface';
import { getToken, clearAuth, connectWebSocket, disconnectWebSocket, API_URL } from './store';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (token && !needsSetup) {
      setIsAuthenticated(true);
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const orgData = JSON.parse(localStorage.getItem('organization') || '{}');
      setUser(userData);
      setOrganization(orgData);
      
      // Connect WebSocket
      connectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [needsSetup]);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/setup/status`);
      const data = await response.json();
      setNeedsSetup(data.setupNeeded);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      // If we can't check setup status, assume setup is needed
      setNeedsSetup(true);
    } finally {
      setCheckingSetup(false);
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const orgData = JSON.parse(localStorage.getItem('organization') || '{}');
    setUser(userData);
    setOrganization(orgData);
    connectWebSocket();
  };

  const handleLogout = () => {
    clearAuth();
    setIsAuthenticated(false);
    setUser(null);
    setOrganization(null);
    disconnectWebSocket();
    setCurrentPage('dashboard');
  };

  const handleSetupComplete = () => {
    setNeedsSetup(false);
    setCheckingSetup(false);
    // Auto-login after setup - setup stored the token already
    const token = getToken();
    if (token) {
      setIsAuthenticated(true);
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const orgData = JSON.parse(localStorage.getItem('organization') || '{}');
      setUser(userData);
      setOrganization(orgData);
      connectWebSocket();
    }
  };

  // Show loading while checking setup status
  if (checkingSetup) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>⚙️</div>
          <div style={{ fontSize: '24px' }}>Loading Conversa Clone...</div>
        </div>
      </div>
    );
  }

  // Show setup page if setup is needed
  if (needsSetup) {
    return <Setup onSetupComplete={handleSetupComplete} />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const menuItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'multichat', icon: '💬', label: 'Multi-Chat' },
    { id: 'livechat', icon: '🗨️', label: 'Live Chat' },
    { id: 'crm', icon: '👥', label: 'Contacts' },
    { id: 'flows', icon: '🎨', label: 'Flows' },
    { id: 'ai-generator', icon: '🤖', label: 'AI Generator' },
    { id: 'marketing', icon: '🧠', label: 'Marketing Brain' },
    { id: 'media', icon: '📚', label: 'Media Library' },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
    { id: 'abtest', icon: '🧪', label: 'A/B Testing' },
    { id: 'trigger', icon: '⚡', label: 'Trigger Test' }
  ];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '280px' : '70px',
        background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        transition: 'width 0.3s',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
        zIndex: 1000
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>
                🤖 Conversa
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                AI Marketing Platform
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '8px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              marginLeft: sidebarOpen ? '0' : 'auto',
              marginRight: sidebarOpen ? '0' : 'auto'
            }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Organization Info */}
        {sidebarOpen && (
          <div style={{
            padding: '15px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '5px' }}>
              Organization
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>
              {organization?.name || 'My Organization'}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '5px' }}>
              Plan: {organization?.plan || 'Starter'} • {user?.role || 'User'}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div style={{ flex: 1, padding: '10px' }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '5px',
                background: currentPage === item.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '15px',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (currentPage !== item.id) {
                  e.target.style.background = 'rgba(255,255,255,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.id) {
                  e.target.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {/* User Info & Logout */}
        <div style={{
          padding: '15px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          {sidebarOpen && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '3px' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>
                {user?.email || 'user@example.com'}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? '280px' : '70px',
        transition: 'margin-left 0.3s',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Bar */}
        <div style={{
          background: 'white',
          padding: '15px 30px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
            {menuItems.find(item => item.id === currentPage)?.icon}{' '}
            {menuItems.find(item => item.id === currentPage)?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '13px', color: '#666' }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#28a745',
              animation: 'pulse 2s infinite'
            }} title="System Online" />
          </div>
        </div>

        {/* Page Content */}
        <div style={{
          flex: 1,
          padding: '30px',
          overflowY: 'auto'
        }}>
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'multichat' && <MultiChatInterface />}
          {currentPage === 'livechat' && <LiveChat />}
          {currentPage === 'crm' && <CRM />}
          {currentPage === 'flows' && <FlowBuilder />}
          {currentPage === 'ai-generator' && <AIFlowGenerator />}
          {currentPage === 'marketing' && <MarketingBrain />}
          {currentPage === 'media' && <MediaLibrary />}
          {currentPage === 'analytics' && <FlowAnalytics />}
          {currentPage === 'abtest' && <ABTestManager />}
          {currentPage === 'trigger' && <TriggerTest />}
        </div>

        {/* Footer */}
        <div style={{
          background: 'white',
          padding: '15px 30px',
          borderTop: '1px solid #e0e0e0',
          textAlign: 'center',
          fontSize: '13px',
          color: '#666'
        }}>
          <div style={{ marginBottom: '5px' }}>
            Built with ❤️ by{' '}
            <a href="https://github.com/BaiseBaise886" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'none' }}>
              BaiseBaise886
            </a>
          </div>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>
            Conversa Clone v1.0.0 • AI-Powered Marketing Automation Platform
          </div>
        </div>
      </div>

      {/* Pulse Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default App;