import React, { useState, useEffect, useRef } from 'react';
import { Button, Form, Spinner, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { RefreshCw, Trash2, Filter, Download } from 'react-feather';

const LogViewer = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshIntervalState] = useState(null);
    const [filter, setFilter] = useState({
        level: '',
        module: '',
        search: ''
    });

    const logContainerRef = useRef(null);
    const scrolledManually = useRef(false);

    // Fetch logs from the API

    const fetchLogs = async () => {
        try {
            // Construct query params for filtering
            const queryParams = new URLSearchParams();
            if (filter.level) queryParams.append('level', filter.level);
            if (filter.module) queryParams.append('module', filter.module);
            queryParams.append('limit', '100');

            const response = await fetch(`http://127.0.0.1:5000/api/logs?${queryParams.toString()}`);


            if (!response.ok) {
                throw new Error(`Failed to fetch logs: ${response.status}`);
            }

            const data = await response.json();

            // Apply text search filter client-side
            let filteredData = data;
            if (filter.search) {
                const searchLower = filter.search.toLowerCase();
                filteredData = data.filter(log =>
                    log.message.toLowerCase().includes(searchLower) ||
                    log.module.toLowerCase().includes(searchLower)
                );
            }

            setLogs(filteredData);
            setError(null);
        } catch (err) {
            console.error('Error fetching logs:', err);
            setError('Failed to load logs');
        } finally {
            setLoading(false);
        }
    };

    // Initialize log fetching and auto-refresh
    useEffect(() => {
        // Initial fetch
        fetchLogs();

        // Set up auto-refresh if enabled
        if (autoRefresh) {
            const interval = setInterval(fetchLogs, 3000);
            setRefreshIntervalState(interval);
        }

        // Cleanup on unmount
        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        };
    }, [filter, autoRefresh]);

    // Scroll to bottom when logs update, unless scrolled manually
    useEffect(() => {
        if (logContainerRef.current && !scrolledManually.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Handle scroll event to detect manual scrolling
    const handleScroll = () => {
        if (!logContainerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
        const atBottom = scrollHeight - scrollTop - clientHeight < 30;

        scrolledManually.current = !atBottom;
    };

    // Handle auto-refresh toggle
    const toggleAutoRefresh = () => {
        if (autoRefresh) {
            // Disable auto-refresh
            if (refreshInterval) {
                clearInterval(refreshInterval);
                setRefreshIntervalState(null);
            }
        } else {
            // Enable auto-refresh
            const interval = setInterval(fetchLogs, 3000);
            setRefreshIntervalState(interval);
        }

        setAutoRefresh(!autoRefresh);
    };

    // Handle manual refresh
    const handleManualRefresh = () => {
        fetchLogs();
    };

    // Handle clear logs
    const handleClearLogs = async () => {
        try {
            setLoading(true);

            const response = await fetch('/api/logs/clear', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`Failed to clear logs: ${response.status}`);
            }

            // Refresh logs after clearing
            fetchLogs();
        } catch (err) {
            console.error('Error clearing logs:', err);
            setError('Failed to clear logs');
            setLoading(false);
        }
    };

    // Handle filter change
    const handleFilterChange = (field, value) => {
        setFilter(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle log download
    const handleDownload = () => {
        // Create a text version of the logs
        const logText = logs.map(log =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.module}] ${log.message}`
        ).join('\n');

        // Create a blob and download link
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `system-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
        link.click();

        // Clean up
        URL.revokeObjectURL(url);
    };

    // Helper function to get badge color for log level
    const getLevelBadgeColor = (level) => {
        switch (level.toLowerCase()) {
            case 'error': return 'danger';
            case 'warning': return 'warning';
            case 'info': return 'info';
            case 'debug': return 'secondary';
            default: return 'secondary';
        }
    };

    // Helper function to format timestamp
    const formatTimestamp = (timestamp) => {
        // Extract time portion if it's an ISO string
        if (timestamp.includes('T')) {
            return timestamp.split('T')[1].split('.')[0];
        }

        // Otherwise, just return the timestamp or extract time part
        return timestamp.includes(' ') ? timestamp.split(' ')[1] : timestamp;
    };

    return (
        <div className="log-viewer h-100 d-flex flex-column">
            <div className="log-controls p-2 border-bottom">
                <div className="d-flex justify-content-between mb-2">
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={toggleAutoRefresh}
                        active={autoRefresh}
                        className="mr-1"
                    >
                        Auto Refresh {autoRefresh ? 'On' : 'Off'}
                    </Button>

                    <div>
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={handleManualRefresh}
                            disabled={loading}
                            className="mr-1"
                        >
                            <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        </Button>

                        <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={handleClearLogs}
                            disabled={loading}
                            className="mr-1"
                        >
                            <Trash2 size={16} />
                        </Button>

                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Download Logs</Tooltip>}
                        >
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={handleDownload}
                                disabled={logs.length === 0}
                            >
                                <Download size={16} />
                            </Button>
                        </OverlayTrigger>
                    </div>
                </div>

                <div className="d-flex">
                    <Form.Control
                        size="sm"
                        type="text"
                        placeholder="Search logs..."
                        value={filter.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="mr-2"
                    />

                    <Form.Control
                        as="select"
                        size="sm"
                        value={filter.level}
                        onChange={(e) => handleFilterChange('level', e.target.value)}
                        className="mr-2 w-auto"
                    >
                        <option value="">All Levels</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                        <option value="debug">Debug</option>
                    </Form.Control>

                    <Form.Control
                        as="select"
                        size="sm"
                        value={filter.module}
                        onChange={(e) => handleFilterChange('module', e.target.value)}
                        className="w-auto"
                    >
                        <option value="">All Modules</option>
                        <option value="Detection">Detection</option>
                        <option value="Mouse">Mouse</option>
                        <option value="Driver">Driver</option>
                        <option value="System">System</option>
                        <option value="API">API</option>
                    </Form.Control>
                </div>
            </div>

            <div
                className="log-container p-2 flex-grow-1 overflow-auto"
                ref={logContainerRef}
                onScroll={handleScroll}
            >
                {loading && logs.length === 0 ? (
                    <div className="text-center py-3">
                        <Spinner animation="border" variant="primary" size="sm" />
                        <p className="mt-2 text-muted">Loading logs...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-3">
                        <p className="text-danger">{error}</p>
                        <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={handleManualRefresh}
                        >
                            Retry
                        </Button>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-3">
                        <Filter size={24} className="text-muted mb-2" />
                        <p className="text-muted">No logs found{filter.level || filter.module || filter.search ? ' matching your filters' : ''}.</p>
                    </div>
                ) : (
                    <div className="log-entries">
                        {logs.map((log, index) => (
                            <div key={index} className="log-entry">
                                <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                                <Badge
                                    variant={getLevelBadgeColor(log.level)}
                                    className="log-level"
                                >
                                    {log.level.toUpperCase()}
                                </Badge>
                                <span className="log-module">{log.module}</span>
                                <span className="log-message">{log.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx="true">{`
        .log-controls {
          background-color: #f8f9fa;
        }
        
        .log-container {
          background-color: #2d2d2d;
          color: #f8f9fa;
          font-family: monospace;
          font-size: 0.9rem;
        }
        
        .log-entries {
          display: flex;
          flex-direction: column;
        }
        
        .log-entry {
          padding: 4px 0;
          display: flex;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          line-height: 1.4;
        }
        
        .log-timestamp {
          color: #a9a9a9;
          margin-right: 8px;
          flex-shrink: 0;
        }
        
        .log-level {
          margin-right: 8px;
          min-width: 60px;
          text-align: center;
          flex-shrink: 0;
        }
        
        .log-module {
          color: #88b8ff;
          margin-right: 12px;
          min-width: 80px;
          flex-shrink: 0;
        }
        
        .log-message {
          color: #f8f9fa;
          word-break: break-word;
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

export default LogViewer;


