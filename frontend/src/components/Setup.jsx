import React, { useState, useEffect } from 'react';
import { API_URL } from '../store';

const Setup = ({ onSetupComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [setupStatus, setSetupStatus] = useState(null);
  
  // Database configuration
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '',
    database: 'conversa_clone'
  });
  
  // Admin user configuration
  const [adminConfig, setAdminConfig] = useState({
    email: 'admin@conversa.com',
    password: '',
    confirmPassword: '',
    name: 'Admin User',
    organizationName: 'My Organization'
  });
  
  // Setup results
  const [results, setResults] = useState({
    connectionTest: null,
    databaseCreation: null,
    migrations: null,
    adminCreation: null,
    stats: null
  });

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/setup/status`);
      const data = await response.json();
      setSetupStatus(data);
    } catch (error) {
      console.error('Failed to check setup status:', error);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/setup/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      
      const data = await response.json();
      setResults(prev => ({ ...prev, connectionTest: data }));
      
      if (data.success) {
        setStep(2);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createDatabase = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/setup/create-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      
      const data = await response.json();
      setResults(prev => ({ ...prev, databaseCreation: data }));
      
      if (data.success) {
        setStep(3);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const runMigrations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/setup/run-migrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      
      const data = await response.json();
      setResults(prev => ({ ...prev, migrations: data }));
      
      if (data.success) {
        setStep(4);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async () => {
    setLoading(true);
    setError(null);
    
    if (adminConfig.password !== adminConfig.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    
    if (adminConfig.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/setup/create-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dbConfig,
          adminEmail: adminConfig.email,
          adminPassword: adminConfig.password,
          adminName: adminConfig.name,
          organizationName: adminConfig.organizationName
        })
      });
      
      const data = await response.json();
      setResults(prev => ({ ...prev, adminCreation: data }));
      
      if (data.success) {
        // Get database stats
        await getDatabaseStats();
        setStep(5);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getDatabaseStats = async () => {
    try {
      const response = await fetch(`${API_URL}/setup/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      
      const data = await response.json();
      setResults(prev => ({ ...prev, stats: data }));
    } catch (error) {
      console.error('Failed to get stats:', error);
    }
  };

  const completeSetup = async () => {
    setLoading(true);
    setError(null);
    
    if (adminConfig.password !== adminConfig.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/setup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dbConfig,
          adminEmail: adminConfig.email,
          adminPassword: adminConfig.password,
          adminName: adminConfig.name,
          organizationName: adminConfig.organizationName
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStep(5);
        setResults(prev => ({ ...prev, ...data }));
      } else {
        setError(data.message || 'Setup failed');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step >= s ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {s}
            </div>
            {s < 5 && (
              <div className={`flex-1 h-1 ${step > s ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span>Database</span>
        <span>Create DB</span>
        <span>Migrations</span>
        <span>Admin</span>
        <span>Complete</span>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Database Configuration</h2>
      <p className="text-gray-600 mb-6">
        Configure your MySQL/MariaDB database connection. Make sure your database server is running.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Host</label>
          <input
            type="text"
            value={dbConfig.host}
            onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="localhost"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Port</label>
          <input
            type="text"
            value={dbConfig.port}
            onChange={(e) => setDbConfig({ ...dbConfig, port: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="3306"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={dbConfig.user}
            onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="root"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={dbConfig.password}
            onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="(optional)"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Database Name</label>
          <input
            type="text"
            value={dbConfig.database}
            onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="conversa_clone"
          />
        </div>
      </div>
      
      <button
        onClick={testConnection}
        disabled={loading}
        className="mt-6 w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? 'Testing Connection...' : 'Test Connection & Continue'}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Create Database</h2>
      <p className="text-gray-600 mb-6">
        We will create the database '{dbConfig.database}' if it doesn't exist.
      </p>
      
      {results.connectionTest && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <p className="text-green-800">✓ Database connection successful</p>
        </div>
      )}
      
      <button
        onClick={createDatabase}
        disabled={loading}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? 'Creating Database...' : 'Create Database & Continue'}
      </button>
      
      <button
        onClick={() => setStep(1)}
        className="mt-2 w-full bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
      >
        Back
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Run Database Migrations</h2>
      <p className="text-gray-600 mb-6">
        This will create all necessary tables and schema in your database.
      </p>
      
      {results.databaseCreation && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <p className="text-green-800">✓ {results.databaseCreation.message}</p>
        </div>
      )}
      
      <button
        onClick={runMigrations}
        disabled={loading}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? 'Running Migrations...' : 'Run Migrations & Continue'}
      </button>
      
      <button
        onClick={() => setStep(2)}
        className="mt-2 w-full bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
      >
        Back
      </button>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Create Admin User</h2>
      <p className="text-gray-600 mb-6">
        Create the owner account for your organization. This user will have full administrative access.
      </p>
      
      {results.migrations && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
          <p className="text-green-800">
            ✓ Migrations completed: {results.migrations.executed} executed, {results.migrations.skipped} skipped
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Organization Name</label>
          <input
            type="text"
            value={adminConfig.organizationName}
            onChange={(e) => setAdminConfig({ ...adminConfig, organizationName: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="My Organization"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Admin Name</label>
          <input
            type="text"
            value={adminConfig.name}
            onChange={(e) => setAdminConfig({ ...adminConfig, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Admin User"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={adminConfig.email}
            onChange={(e) => setAdminConfig({ ...adminConfig, email: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="admin@conversa.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={adminConfig.password}
            onChange={(e) => setAdminConfig({ ...adminConfig, password: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Minimum 8 characters"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Confirm Password</label>
          <input
            type="password"
            value={adminConfig.confirmPassword}
            onChange={(e) => setAdminConfig({ ...adminConfig, confirmPassword: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirm password"
          />
        </div>
      </div>
      
      <button
        onClick={createAdmin}
        disabled={loading}
        className="mt-6 w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? 'Creating Admin User...' : 'Create Admin & Complete Setup'}
      </button>
      
      <button
        onClick={() => setStep(3)}
        className="mt-2 w-full bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
      >
        Back
      </button>
    </div>
  );

  const renderStep5 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">✅ Setup Complete!</h2>
      <p className="text-gray-600 mb-6">
        Your Conversa Clone installation is ready. You can now log in with your admin credentials.
      </p>
      
      <div className="bg-blue-50 border border-blue-200 rounded p-6 mb-6">
        <h3 className="font-semibold mb-2">Login Credentials</h3>
        <p className="text-sm mb-1"><strong>Email:</strong> {adminConfig.email}</p>
        <p className="text-sm mb-1"><strong>Organization:</strong> {adminConfig.organizationName}</p>
        <p className="text-yellow-700 text-sm mt-3">⚠️ Please save your password securely!</p>
      </div>
      
      {results.stats && results.stats.stats && (
        <div className="bg-gray-50 border border-gray-200 rounded p-6 mb-6">
          <h3 className="font-semibold mb-2">Database Statistics</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Organizations: {results.stats.stats.organizations}</div>
            <div>Users: {results.stats.stats.users}</div>
            <div>Contacts: {results.stats.stats.contacts}</div>
            <div>Flows: {results.stats.stats.flows}</div>
            <div>Messages: {results.stats.stats.messages}</div>
            <div>Channels: {results.stats.stats.channels}</div>
          </div>
        </div>
      )}
      
      <button
        onClick={onSetupComplete}
        className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
      >
        Go to Login
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Conversa Clone Setup</h1>
          <p className="text-gray-600">First-time database and admin configuration</p>
        </div>
        
        {renderStepIndicator()}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}
        
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>
    </div>
  );
};

export default Setup;
