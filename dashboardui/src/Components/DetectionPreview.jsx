import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Spinner } from 'react-bootstrap';
import { RefreshCw, ZoomIn, ZoomOut, Maximize2, Download } from 'react-feather';

const DetectionPreview = () => {
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [refreshInterval, setRefreshInterval] = useState(null);
    const [fullscreen, setFullscreen] = useState(false);

    const previewRef = useRef(null);

    // Fetch preview image
    const fetchPreview = async () => {
        try {
            setLoading(true);

            // Add timestamp to prevent caching
            const timestamp = new Date().getTime();
            const response = await fetch(`http://127.0.0.1:5000/api/preview?t=${timestamp}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch preview: ${response.status}`);
            }

            // Convert response to blob and create URL
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            // Update state
            setPreviewUrl(url);
            setError(null);
        } catch (err) {
            console.error('Error fetching preview:', err);
            setError('Failed to load detection preview');
        } finally {
            setLoading(false);
        }
    };

    // Initialize preview and setup refresh interval
    useEffect(() => {
        // Initial fetch
        fetchPreview();

        // Set up auto-refresh (1 second interval)
        const interval = setInterval(fetchPreview, 1000);
        setRefreshInterval(interval);

        // Cleanup on unmount
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }

            // Revoke object URL to avoid memory leaks
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, []);

    // Handle zoom in
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.25, 3));
    };

    // Handle zoom out
    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    };

    // Handle fullscreen toggle
    const handleFullscreenToggle = () => {
        setFullscreen(!fullscreen);
    };

    // Handle manual refresh
    const handleManualRefresh = () => {
        fetchPreview();
    };

    // Handle download
    const handleDownload = () => {
        if (previewUrl) {
            const link = document.createElement('a');
            link.href = previewUrl;
            link.download = `detection-preview-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
            link.click();
        }
    };

    return (
        <div className={`detection-preview ${fullscreen ? 'fullscreen' : ''}`}>
            <div className="preview-controls mb-2 d-flex justify-content-between">
                <div>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        className="mr-1"
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 0.5}
                    >
                        <ZoomOut size={16} />
                    </Button>
                    <span className="mx-2">{Math.round(zoomLevel * 100)}%</span>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        className="mr-1"
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 3}
                    >
                        <ZoomIn size={16} />
                    </Button>
                </div>

                <div>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        className="mr-1"
                        onClick={handleFullscreenToggle}
                    >
                        <Maximize2 size={16} />
                    </Button>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        className="mr-1"
                        onClick={handleDownload}
                        disabled={!previewUrl}
                    >
                        <Download size={16} />
                    </Button>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleManualRefresh}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </Button>
                </div>
            </div>

            <div className="preview-container" ref={previewRef}>
                {loading && !previewUrl && (
                    <div className="preview-loading">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2">Loading preview...</p>
                    </div>
                )}

                {error && (
                    <div className="preview-error">
                        <p className="text-danger">{error}</p>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleManualRefresh}
                            disabled={loading}
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {previewUrl && (
                    <div className="preview-image-container" style={{ transform: `scale(${zoomLevel})` }}>
                        <img
                            src={previewUrl}
                            alt="Detection Preview"
                            className="preview-image"
                            style={{ opacity: loading ? 0.7 : 1 }}
                        />
                    </div>
                )}
            </div>

            {fullscreen && (
                <div className="fullscreen-overlay" onClick={handleFullscreenToggle}>
                    <div className="fullscreen-content" onClick={e => e.stopPropagation()}>
                        <Button
                            variant="light"
                            size="sm"
                            className="fullscreen-close"
                            onClick={handleFullscreenToggle}
                        >
                            X
                        </Button>
                        <img
                            src={previewUrl}
                            alt="Detection Preview (Fullscreen)"
                            className="fullscreen-image"
                        />
                    </div>
                </div>
            )}

            <style jsx="true">{`
        .detection-preview {
          position: relative;
          height: 100%;
        }
        
        .preview-container {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }
        
        .preview-image-container {
          transition: transform 0.2s ease-in-out;
          transform-origin: center center;
        }
        
        .preview-image {
          max-width: 100%;
          max-height: 300px;
          transition: opacity 0.2s ease-in-out;
        }
        
        .preview-loading, .preview-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .fullscreen {
          z-index: 1050;
        }
        
        .fullscreen-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1060;
        }
        
        .fullscreen-content {
          position: relative;
          max-width: 90%;
          max-height: 90%;
        }
        
        .fullscreen-image {
          max-width: 100%;
          max-height: 90vh;
        }
        
        .fullscreen-close {
          position: absolute;
          top: -40px;
          right: 0;
          z-index: 1070;
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default DetectionPreview;