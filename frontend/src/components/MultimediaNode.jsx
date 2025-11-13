import React, { useState, useEffect } from 'react';
import { apiCall } from '../store';

function MultimediaNode({ nodeData, onUpdate }) {
  const [selectedMedia, setSelectedMedia] = useState(nodeData?.mediaId || null);
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [caption, setCaption] = useState(nodeData?.caption || '');
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    loadMediaLibrary();
  }, [filterType]);

  const loadMediaLibrary = async () => {
    try {
      const params = filterType !== 'all' ? `?type=${filterType}` : '';
      const data = await apiCall(`/media/library${params}`);
      setMediaLibrary(data.data || data);
    } catch (error) {
      console.error('Failed to load media library:', error);
    }
  };

  const handleSelectMedia = (media) => {
    setSelectedMedia(media);
    if (onUpdate) {
      onUpdate({
        mediaId: media.id,
        mediaType: media.file_type,
        mediaUrl: media.file_path,
        mediaName: media.file_name,
        caption
      });
    }
    setShowLibrary(false);
  };

  const handleCaptionChange = (value) => {
    setCaption(value);
    if (onUpdate && selectedMedia) {
      onUpdate({
        mediaId: selectedMedia.id,
        mediaType: selectedMedia.file_type,
        mediaUrl: selectedMedia.file_path,
        mediaName: selectedMedia.file_name,
        caption: value
      });
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

  return (
    <div style={{
      padding: '20px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h4 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        📎 Multimedia Message
      </h4>

      {/* Selected Media Display */}
      {selectedMedia && (
        <div style={{
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '15px',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{ fontSize: '40px' }}>
            {getFileIcon(selectedMedia.file_type)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              {selectedMedia.file_name}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {selectedMedia.file_type} • {formatFileSize(selectedMedia.file_size)}
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedMedia(null);
              if (onUpdate) onUpdate(null);
            }}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Remove
          </button>
        </div>
      )}

      {/* Caption Input */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
          Caption (optional):
        </label>
        <textarea
          value={caption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          placeholder="Add a caption for this media..."
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            minHeight: '80px',
            fontSize: '13px',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Select Media Button */}
      {!selectedMedia && (
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          style={{
            width: '100%',
            padding: '12px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = '#5568d3'}
          onMouseLeave={(e) => e.target.style.background = '#667eea'}
        >
          📚 Select from Media Library
        </button>
      )}

      {/* Media Library Modal */}
      {showLibrary && (
        <div style={{
          marginTop: '15px',
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '8px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h5 style={{ margin: 0 }}>Select Media</h5>
            <button
              onClick={() => setShowLibrary(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#999'
              }}
            >
              ×
            </button>
          </div>

          {/* Type Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
            {['all', 'image', 'video', 'audio', 'document'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: filterType === type ? '#667eea' : 'white',
                  color: filterType === type ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {type === 'all' ? '📁' : getFileIcon(type)} {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Media Grid */}
          {mediaLibrary.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>
                {filterType === 'all' ? '📚' : getFileIcon(filterType)}
              </div>
              <p>No {filterType === 'all' ? 'media' : filterType} files</p>
              <p style={{ fontSize: '13px', marginTop: '5px' }}>
                Upload files in the Media Library first
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '10px'
            }}>
              {mediaLibrary.map(media => (
                <div
                  key={media.id}
                  onClick={() => handleSelectMedia(media)}
                  style={{
                    background: 'white',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Preview */}
                  <div style={{
                    height: '100px',
                    background: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px'
                  }}>
                    {media.file_type === 'image' ? (
                      <img
                        src={`/uploads/${media.file_type}s/${media.file_path.split('/').pop()}`}
                        alt={media.file_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = getFileIcon(media.file_type);
                        }}
                      />
                    ) : (
                      getFileIcon(media.file_type)
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '8px' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }} title={media.file_name}>
                      {media.file_name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      {formatFileSize(media.file_size)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div style={{
        marginTop: '15px',
        padding: '12px',
        background: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#856404'
      }}>
        <strong>💡 Tip:</strong> Supported formats:
        <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
          <li>Images: JPEG, PNG, GIF, WebP</li>
          <li>Videos: MP4, 3GPP, QuickTime</li>
          <li>Audio: MP3, WAV, OGG, Opus (voice notes)</li>
          <li>Documents: PDF, Word, Excel</li>
        </ul>
      </div>
    </div>
  );
}

export default MultimediaNode;