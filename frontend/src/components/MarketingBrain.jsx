import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function MarketingBrain() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    product_description: '',
    price: '',
    target_audience: '',
    marketing_angles: '',
    pain_points: '',
    benefits: '',
    objections: '',
    competitors: '',
    unique_selling_points: '',
    tone_of_voice: 'friendly'
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await apiCall('/marketing/products');
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const processedData = {
        ...formData,
        price: parseFloat(formData.price) || null,
        marketing_angles: formData.marketing_angles.split(',').map(s => s.trim()).filter(Boolean),
        pain_points: formData.pain_points.split(',').map(s => s.trim()).filter(Boolean),
        benefits: formData.benefits.split(',').map(s => s.trim()).filter(Boolean),
        objections: formData.objections.split(',').map(s => s.trim()).filter(Boolean),
        competitors: formData.competitors.split(',').map(s => s.trim()).filter(Boolean),
        unique_selling_points: formData.unique_selling_points.split(',').map(s => s.trim()).filter(Boolean)
      };

      if (selectedProduct) {
        await apiCall(`/marketing/products/${selectedProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(processedData)
        });
      } else {
        await apiCall('/marketing/products', {
          method: 'POST',
          body: JSON.stringify(processedData)
        });
      }

      setShowAddForm(false);
      setSelectedProduct(null);
      setFormData({
        product_name: '',
        product_description: '',
        price: '',
        target_audience: '',
        marketing_angles: '',
        pain_points: '',
        benefits: '',
        objections: '',
        competitors: '',
        unique_selling_points: '',
        tone_of_voice: 'friendly'
      });
      loadProducts();
    } catch (error) {
      alert('Failed to save product: ' + error.message);
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setFormData({
      product_name: product.product_name,
      product_description: product.product_description || '',
      price: product.price || '',
      target_audience: product.target_audience || '',
      marketing_angles: product.marketing_angles?.join(', ') || '',
      pain_points: product.pain_points?.join(', ') || '',
      benefits: product.benefits?.join(', ') || '',
      objections: product.objections?.join(', ') || '',
      competitors: product.competitors?.join(', ') || '',
      unique_selling_points: product.unique_selling_points?.join(', ') || '',
      tone_of_voice: product.tone_of_voice || 'friendly'
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product from Marketing Brain?')) return;
    
    try {
      await apiCall(`/marketing/products/${id}`, { method: 'DELETE' });
      loadProducts();
    } catch (error) {
      alert('Failed to delete product: ' + error.message);
    }
  };

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '30px', color: 'white', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', color: 'white' }}>
          🧠 Marketing Brain
        </h2>
        <p style={{ fontSize: '15px', opacity: 0.9 }}>
          Train the AI on your products, target audience, and marketing strategies
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h3>Products & Services ({products.length})</h3>
        </div>
        <button onClick={() => {
          setSelectedProduct(null);
          setFormData({
            product_name: '',
            product_description: '',
            price: '',
            target_audience: '',
            marketing_angles: '',
            pain_points: '',
            benefits: '',
            objections: '',
            competitors: '',
            unique_selling_points: '',
            tone_of_voice: 'friendly'
          });
          setShowAddForm(true);
        }} className="success">
          ➕ Add Product
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="modal" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{selectedProduct ? 'Edit Product' : 'Add New Product'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Product/Service Name *</label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                    required
                    placeholder="Instagram Growth Course"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <textarea
                    value={formData.product_description}
                    onChange={(e) => setFormData({...formData, product_description: e.target.value})}
                    placeholder="A comprehensive course teaching..."
                    style={{ minHeight: '80px' }}
                  />
                </div>

                <div>
                  <label>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="99.00"
                  />
                </div>

                <div>
                  <label>Tone of Voice</label>
                  <select
                    value={formData.tone_of_voice}
                    onChange={(e) => setFormData({...formData, tone_of_voice: e.target.value})}
                  >
                    <option value="friendly">Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="authoritative">Authoritative</option>
                    <option value="empathetic">Empathetic</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Target Audience</label>
                  <input
                    type="text"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({...formData, target_audience: e.target.value})}
                    placeholder="Small business owners, aged 25-45..."
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Marketing Angles (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.marketing_angles}
                    onChange={(e) => setFormData({...formData, marketing_angles: e.target.value})}
                    placeholder="social proof, scarcity, authority, urgency"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Pain Points (comma-separated)</label>
                  <textarea
                    value={formData.pain_points}
                    onChange={(e) => setFormData({...formData, pain_points: e.target.value})}
                    placeholder="low engagement, not getting followers, wasting time..."
                    style={{ minHeight: '60px' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Benefits (comma-separated)</label>
                  <textarea
                    value={formData.benefits}
                    onChange={(e) => setFormData({...formData, benefits: e.target.value})}
                    placeholder="10x engagement, save 5 hours/week, grow to 10k followers..."
                    style={{ minHeight: '60px' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Common Objections (comma-separated)</label>
                  <textarea
                    value={formData.objections}
                    onChange={(e) => setFormData({...formData, objections: e.target.value})}
                    placeholder="too expensive, no time, already tried similar..."
                    style={{ minHeight: '60px' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Unique Selling Points (comma-separated)</label>
                  <textarea
                    value={formData.unique_selling_points}
                    onChange={(e) => setFormData({...formData, unique_selling_points: e.target.value})}
                    placeholder="only course with live coaching, 90-day guarantee..."
                    style={{ minHeight: '60px' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Competitors (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.competitors}
                    onChange={(e) => setFormData({...formData, competitors: e.target.value})}
                    placeholder="CompetitorA, CompetitorB..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowAddForm(false)} className="secondary">
                  Cancel
                </button>
                <button type="submit" className="success">
                  {selectedProduct ? 'Update' : 'Add'} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {products.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '60px',
            background: 'white',
            borderRadius: '12px',
            color: '#999'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '15px' }}>🧠</div>
            <h3 style={{ marginBottom: '10px', color: '#666' }}>No Products Yet</h3>
            <p style={{ marginBottom: '20px' }}>Train the AI by adding your products and marketing knowledge</p>
            <button onClick={() => setShowAddForm(true)} className="success">
              Add Your First Product
            </button>
          </div>
        ) : (
          products.map(product => (
            <div
              key={product.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                borderTop: '4px solid #667eea'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '18px', margin: 0 }}>{product.product_name}</h3>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => handleEdit(product)} style={{ padding: '5px 10px', fontSize: '12px' }} className="secondary">
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(product.id)} style={{ padding: '5px 10px', fontSize: '12px' }} className="danger">
                    🗑️
                  </button>
                </div>
              </div>

              {product.price && (
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#28a745', marginBottom: '10px' }}>
                  ${parseFloat(product.price).toFixed(2)}
                </div>
              )}

              {product.product_description && (
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px', lineHeight: '1.5' }}>
                  {product.product_description.substring(0, 120)}{product.product_description.length > 120 ? '...' : ''}
                </p>
              )}

              <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                <strong>Target:</strong> {product.target_audience || 'Not specified'}
              </div>

              {product.marketing_angles && product.marketing_angles.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '5px', color: '#666' }}>
                    Marketing Angles:
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {product.marketing_angles.slice(0, 3).map((angle, idx) => (
                      <span key={idx} style={{
                        padding: '3px 8px',
                        background: '#e7f3ff',
                        color: '#667eea',
                        borderRadius: '10px',
                        fontSize: '11px'
                      }}>
                        {angle}
                      </span>
                    ))}
                    {product.marketing_angles.length > 3 && (
                      <span style={{
                        padding: '3px 8px',
                        background: '#f0f0f0',
                        color: '#666',
                        borderRadius: '10px',
                        fontSize: '11px'
                      }}>
                        +{product.marketing_angles.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ 
                marginTop: '15px', 
                paddingTop: '15px', 
                borderTop: '1px solid #f0f0f0',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                fontSize: '12px',
                color: '#666'
              }}>
                <div>
                  📌 {product.pain_points?.length || 0} pain points
                </div>
                <div>
                  ✨ {product.benefits?.length || 0} benefits
                </div>
                <div>
                  ❓ {product.objections?.length || 0} objections
                </div>
                <div>
                  🎯 {product.unique_selling_points?.length || 0} USPs
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Section */}
      <div style={{ marginTop: '30px', background: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginBottom: '15px' }}>💡 How Marketing Brain Works</h3>
        <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          <p>The Marketing Brain is used by AI features to:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>Generate flows that match your product's tone and positioning</li>
            <li>Select the best marketing angle for each customer segment</li>
            <li>Handle objections with context-aware responses</li>
            <li>Personalize messages based on customer pain points</li>
            <li>Create more effective A/B test variants</li>
          </ul>
          <p style={{ marginTop: '15px' }}>
            <strong>Tip:</strong> The more detailed your product information, the better the AI can craft your marketing messages!
          </p>
        </div>
      </div>
    </div>
  );
}

export default MarketingBrain;