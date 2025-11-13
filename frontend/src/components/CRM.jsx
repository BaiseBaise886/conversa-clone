import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';
import ContactTags from './ContactTags';

function CRM() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    channel_type: 'whatsapp'
  });

  useEffect(() => {
    loadContacts();
  }, [searchQuery]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const data = await apiCall(`/contacts${params}`);
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/contacts', {
        method: 'POST',
        body: JSON.stringify(newContact)
      });
      setShowAddForm(false);
      setNewContact({ name: '', phone: '', email: '', channel_type: 'whatsapp' });
      loadContacts();
    } catch (error) {
      alert('Failed to add contact: ' + error.message);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!confirm('Delete this contact?')) return;
    
    try {
      await apiCall(`/contacts/${id}`, { method: 'DELETE' });
      loadContacts();
      setSelectedContact(null);
    } catch (error) {
      alert('Failed to delete contact: ' + error.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>👥 Contacts CRM</h2>
        <button onClick={() => setShowAddForm(true)} className="success">
          ➕ Add Contact
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="🔍 Search contacts by name, phone, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
        />
      </div>

      {/* Add Contact Modal */}
      {showAddForm && (
        <div className="modal" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>Add New Contact</h3>
            <form onSubmit={handleAddContact}>
              <div style={{ marginBottom: '15px' }}>
                <label>Name:</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Phone:</label>
                <input
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                  required
                  placeholder="+5511999999999"
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Email (optional):</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Channel:</label>
                <select
                  value={newContact.channel_type}
                  onChange={(e) => setNewContact({...newContact, channel_type: e.target.value})}
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddForm(false)} className="secondary">
                  Cancel
                </button>
                <button type="submit" className="success">
                  Add Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedContact ? '1fr 1fr' : '1fr', gap: '20px' }}>
        <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>All Contacts ({contacts.length})</h3>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
          ) : contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>👥</div>
              <p>No contacts yet</p>
              <button onClick={() => setShowAddForm(true)} className="success" style={{ marginTop: '10px' }}>
                Add Your First Contact
              </button>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {contacts.map(contact => (
                <div
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedContact?.id === contact.id ? '#e7f3ff' : 'white',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = selectedContact?.id === contact.id ? '#e7f3ff' : 'white'}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {contact.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    📱 {contact.phone}
                  </div>
                  {contact.email && (
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      ✉️ {contact.email}
                    </div>
                  )}
                  <div style={{ marginTop: '8px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {contact.tags?.map((tag, idx) => (
                      <span key={idx} style={{
                        padding: '2px 8px',
                        background: '#667eea',
                        color: 'white',
                        borderRadius: '10px',
                        fontSize: '11px'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Details */}
        {selectedContact && (
          <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>Contact Details</h3>
              <button onClick={() => handleDeleteContact(selectedContact.id)} className="danger" style={{ padding: '5px 15px' }}>
                🗑️ Delete
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <strong>Name:</strong> {selectedContact.name}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>Phone:</strong> {selectedContact.phone}
              </div>
              {selectedContact.email && (
                <div style={{ marginBottom: '15px' }}>
                  <strong>Email:</strong> {selectedContact.email}
                </div>
              )}
              <div style={{ marginBottom: '15px' }}>
                <strong>Channel:</strong> {selectedContact.channel_type}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>Created:</strong> {new Date(selectedContact.created_at).toLocaleDateString()}
              </div>
            </div>

            <ContactTags contactId={selectedContact.id} />
          </div>
        )}
      </div>
    </div>
  );
}

export default CRM;