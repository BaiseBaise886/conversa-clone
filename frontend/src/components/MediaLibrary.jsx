import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function MediaLibrary() {
  const [media, setMedia] = useState([]);
  const [filteredMedia, setFilteredMedia] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    loadMedia();
  }, []);

  useEffect(() => {
    if (selectedType === 'all') {
      setFilteredMedia(media);
    } else {
      setFilteredMedia(media.filter(m => m.file_type === selectedType));
    }
  }, [selectedType, media]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/media/library');
      setMedia(response.data || response);
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      await apiCall('/media/upload-multiple', {
        method: 'POST',
        headers: {}, // Let browser set Content-Type with boundary
        body: formData
      });

      loadMedia();
      e.target.value = '';
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this file?')) return;

    try {
      await apiCall(`/media/${id}`, { method: 'DELETE' });
      loadMedia();
      setSelectedMedia(null);
    } catch (error) {
      alert('Failed to delete: ' + error.message);
    }
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'document': return '📄';
      default: return '📎';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const typeCounts = {
    all: media.length,
    image: media.filter(m => m.file_type === 'image').length,
    video: media.filter(m => m.file_type === 'video').length,
    audio: media.filter(m => m.file_type === 'audio').length,
    document: media.filter(m => m.file_type === 'document').length
  };

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '30px', color: 'white', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', color: 'white' }}>
          📚 Media Library
        </h2>
        <p style={{ fontSize: '15px', opacity: 0.9 }}>
          Manage your images, videos, voice notes, and documents
        </p>
      </div>

      {/* Upload Section */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <label
          htmlFor="file-upload"
          style={{
            display: 'block',
            padding: '40px',
            border: '2px dashed #ddd',
            borderRadius: '12px',
            textAlign: 'center',
            cursor: 'pointer',
            background: uploading ? '#f0f0f0' : 'transparent',
            transition: 'all 0.3s'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = '#667eea';
            e.currentTarget.style.background = '#f0f4ff';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.background = 'transparent';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = '#ddd';
            e.currentTarget.style.background = 'transparent';
            
            const files = Array.from(e.dataTransfer.files);
            const input = document.getElementById('file-upload');
            const dataTransfer = new DataTransfer();
            files.forEach(file => dataTransfer.items.add(file));
            input.files = dataTransfer.files;
            handleFileUpload({ target: input });
          }}
        >
          {uploading ? (
            <div>
              <div className="spinner" style={{ marginBottom: '15px' }}></div>
              <div style={{ fontSize: '16px', color: '#666' }}>Uploading...</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📤</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>
                Click to upload or drag and drop
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                Images, Videos, Audio, Documents (Max 16MB)
              </div>
            </div>
          )}
        </label>
        <input
          id="file-upload"
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'image', 'video', 'audio', 'document'].map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={selectedType === type ? 'success' : 'secondary'}
            style={{ padding: '10px 20px' }}
          >
            {type === 'all' ? '📁' : getFileIcon(type)}
            {' '}
            {type.charAt(0).toUpperCase() + type.slice(1)} ({typeCounts[type]})
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner"></div>
          <p>Loading media...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          background: 'white',
          borderRadius: '12px',
          color: '#999'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '15px' }}>
            {selectedType === 'all' ? '📚' : getFileIcon(selectedType)}
          </div>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>
            No {selectedType === 'all' ? 'media' : selectedType + 's'} yet
          </h3>
          <p>Upload files to get started</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '15px'
        }}>
          {filteredMedia.map(file => (
            <div
              key={file.id}
              onClick={() => setSelectedMedia(file)}
              style={{
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                border: selectedMedia?.id === file.id ? '2px solid #667eea' : '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              {/* Preview */}
              <div style={{
                height: '150px',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px'
              }}>
                {file.file_type === 'image' ? (
                  <img
                    src={`/uploads/${file.file_type}s/${file.file_path.split('/').pop()}`}
                    alt={file.file_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = getFileIcon(file.file_type);
                    }}
                  />
                ) : (
                  getFileIcon(file.file_type)
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '12px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '5px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={file.file_name}>
                  {file.file_name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {formatFileSize(file.file_size)}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                  {new Date(file.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media Detail Modal */}
      {selectedMedia && (
        <div className="modal" onClick={() => setSelectedMedia(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '20px' }}>Media Details</h3>
            
            {/* Preview */}
            <div style={{
              marginBottom: '20px',
              background: '#f0f0f0',
              borderRadius: '8px',
              overflow: 'hidden',
              minHeight: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {selectedMedia.file_type === 'image' ? (
                <img
                  src={`/uploads/${selectedMedia.file_type}s/${selectedMedia.file_path.split('/').pop()}`}
                  alt={selectedMedia.file_name}
                  style={{ maxWidth: '100%', maxHeight: '400px' }}
                />
              ) : selectedMedia.file_type === 'video' ? (
                <video controls style={{ maxWidth: '100%', maxHeight: '400px' }}>
                  <source src={`/uploads/${selectedMedia.file_type}s/${selectedMedia.file_path.split('/').pop()}`} />
                </video>
              ) : selectedMedia.file_type === 'audio' ? (
                <audio controls style={{ width: '100%' }}>
                  <source src={`/uploads/${selectedMedia.file_type}/${selectedMedia.file_path.split('/').pop()}`} />
                </audio>
              ) : (
                <div style={{ fontSize: '64px' }}>
                  {getFileIcon(selectedMedia.file_type)}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>File Name:</strong> {selectedMedia.file_name}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Type:</strong> {selectedMedia.file_type} ({selectedMedia.mime_type})
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Size:</strong> {formatFileSize(selectedMedia.file_size)}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Uploaded:</strong> {new Date(selectedMedia.created_at).toLocaleString()}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedMedia(null)} className="secondary">
                Close
              </button>
              <a
                href={`/api/media/${selectedMedia.id}/download`}
                download
                style={{ textDecoration: 'none' }}
              >
                <button>
                  ⬇️ Download
                </button>
              </a>
              <button onClick={() => handleDelete(selectedMedia.id)} className="danger">
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaLibrary;