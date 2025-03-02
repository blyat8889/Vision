// App.js - Main application component

import React, { useState, useEffect } from 'react';

import { Container, Row, Col, Card, Tabs, Tab, Button, Form } from 'react-bootstrap';
import {
    Sliders, Eye, MousePointer, Zap, Settings, Radio, Image, Cpu, Grid,
    Shield, Info, AlertTriangle, Target, Menu, Bell, User, LogOut, Search,
    ChevronRight, Calendar, Clock, Activity, BarChart2
} from 'react-feather';
import './ModernDashboard.css';
// Custom components
import ColorDetectionPanel from './Components/ColorDetectionPanel';
import MouseSettingsPanel from './Components/MouseSettingsPanel';
import DriverSettingsPanel from './Components/DriverSettingsPanel';
import DetectionPreview from './Components/DetectionPreview';
import SystemStatus from './Components/SystemStatus';
import PresetProfiles from './Components/PresetProfiles';
import LogViewer from './Components/LogViewer';

// API service
import { getSystemStatus, getDetectionSettings, getMouseSettings, getDriverSettings } from './services/api';

import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
    // State management
    const [activeTab, setActiveTab] = useState('detection');
    const [systemStatus, setSystemStatus] = useState({
        detectionActive: false,
        mouseFilterActive: false,
        driverActive: false,
        fps: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        latency: 0
    });
    const [modernUI, setModernUI] = useState(true);
    const [activeSection, setActiveSection] = useState('dashboard');
    const [colorTargets, setColorTargets] = useState([
        {
            id: '1',
            name: 'Green',
            hexColor: '#4CAF50',
            hsvLower: [40, 50, 50],
            hsvUpper: [80, 255, 255],
            tolerance: 25,
            active: true
        }
    ]);

    // Sample data for charts
    const performanceData = [
        { time: '00:00', cpu: 15, memory: 22, fps: 30 },
        { time: '04:00', cpu: 25, memory: 31, fps: 25 },
        { time: '08:00', cpu: 45, memory: 52, fps: 29 },
        { time: '12:00', cpu: 20, memory: 38, fps: 28 },
        { time: '16:00', cpu: 50, memory: 63, fps: 30 },
        { time: '20:00', cpu: 25, memory: 32, fps: 29 },
    ];

    // Effect to fetch system status periodically
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await getSystemStatus();
                setSystemStatus(status);

                // Also try to fetch detection settings for color targets
                try {
                    const detectionData = await getDetectionSettings();
                    if (detectionData.colorTargets && detectionData.colorTargets.length > 0) {
                        setColorTargets(detectionData.colorTargets);
                    }
                } catch (err) {
                    console.error('Failed to load detection settings', err);
                }

            } catch (error) {
                console.error('Error fetching system status:', error);
            }
        };

        // Initial fetch
        fetchStatus();

        // Set up interval for periodic updates
        const intervalId = setInterval(fetchStatus, 2000);

        // Cleanup on unmount
        return () => clearInterval(intervalId);
    }, []);

    // Toggle between modern and classic UI
    const toggleUI = () => {
        setModernUI(!modernUI);
    };

    // Calculate current date and time
    const currentDate = new Date();
    const dateOptions = { month: 'long', day: 'numeric' };
    const formattedDate = currentDate.toLocaleDateString('en-US', dateOptions);
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

    // Progress circle calculation for FPS
    const maxFps = 60;
    const fpsPercentage = (systemStatus.fps / maxFps) * 100;
    const fpsCircleRadius = 40;
    const fpsCircleCircumference = 2 * Math.PI * fpsCircleRadius;
    const fpsCircleStrokeDashoffset = fpsCircleCircumference - (fpsPercentage / 100) * fpsCircleCircumference;

    // Render modern dashboard
    const renderModernDashboard = () => (
        <div className="modern-dashboard">
            <div className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <Target size={24} className="mr-2" />
                        <span>CV Input System</span>
                    </div>
                </div>

                <div className="sidebar-content">
                    <ul className="sidebar-nav">
                        <li className={activeSection === 'dashboard' ? 'active' : ''} onClick={() => setActiveSection('dashboard')}>
                            <Grid size={18} />
                            <span>Dashboard</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                        <li className={activeSection === 'detection' ? 'active' : ''} onClick={() => setActiveSection('detection')}>
                            <Eye size={18} />
                            <span>Detection</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                        <li className={activeSection === 'mouse' ? 'active' : ''} onClick={() => setActiveSection('mouse')}>
                            <MousePointer size={18} />
                            <span>Mouse Settings</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                        <li className={activeSection === 'driver' ? 'active' : ''} onClick={() => setActiveSection('driver')}>
                            <Cpu size={18} />
                            <span>Driver</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                        <li className={activeSection === 'presets' ? 'active' : ''} onClick={() => setActiveSection('presets')}>
                            <Sliders size={18} />
                            <span>Presets</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                        <li className={activeSection === 'stats' ? 'active' : ''} onClick={() => setActiveSection('stats')}>
                            <BarChart2 size={18} />
                            <span>Statistics</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                        <li className={activeSection === 'logs' ? 'active' : ''} onClick={() => setActiveSection('logs')}>
                            <Radio size={18} />
                            <span>System Logs</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                        <li onClick={() => setModernUI(false)}>
                            <Settings size={18} />
                            <span>Classic UI</span>
                            <ChevronRight size={16} className="nav-arrow" />
                        </li>
                    </ul>
                </div>
            </div>

            <div className="main-content">
                <div className="topbar">
                    <div className="topbar-left">
                        <Button variant="link" className="menu-toggle">
                            <Menu size={20} />
                        </Button>
                        <div className="search-input">
                            <div className="input-group">
                                <div className="input-group-prepend">
                                    <span className="input-group-text">
                                        <Search size={16} />
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="topbar-right">
                        <Button variant="link" className="notification-btn">
                            <Bell size={20} />
                            <span className="badge badge-danger notification-badge">3</span>
                        </Button>
                        <div className="user-profile">
                            <div className="user-avatar">
                                <User size={20} />
                            </div>
                            <div className="user-info d-none d-md-block">
                                <div className="user-name">Admin User</div>
                                <div className="user-role">Administrator</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="dashboard-content">
                    {activeSection === 'dashboard' && (
                        <>
                            <Row className="mb-4">
                                <Col md={5}>
                                    <Card className="vision-preview-card h-100">
                                        <Card.Header className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <Eye size={16} className="mr-2" />
                                                Detection Preview
                                            </div>
                                            <div>
                                                <span
                                                    className={`badge badge-${systemStatus.detectionActive ? "success" : "secondary"} mr-2`}
                                                >
                                                    {systemStatus.detectionActive ? "Active" : "Inactive"}
                                                </span>
                                                <Button
                                                    variant="outline-light"
                                                    size="sm"
                                                    className="icon-button"
                                                    onClick={() => setActiveSection('detection')}
                                                >
                                                    <Settings size={14} />
                                                </Button>
                                            </div>
                                        </Card.Header>
                                        <Card.Body className="p-0">
                                            <DetectionPreview />
                                        </Card.Body>
                                    </Card>
                                </Col>

                                <Col md={7}>
                                    <Row>
                                        <Col md={4}>
                                            <Card className="metric-card">
                                                <Card.Body>
                                                    <div className="metric-title">Current FPS</div>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <div className="metric-circle-container">
                                                            <svg width="100" height="100" viewBox="0 0 100 100">
                                                                <circle
                                                                    cx="50"
                                                                    cy="50"
                                                                    r={fpsCircleRadius}
                                                                    fill="transparent"
                                                                    stroke="#2c2c2c"
                                                                    strokeWidth="8"
                                                                />
                                                                <circle
                                                                    cx="50"
                                                                    cy="50"
                                                                    r={fpsCircleRadius}
                                                                    fill="transparent"
                                                                    stroke="#4CAF50"
                                                                    strokeWidth="8"
                                                                    strokeDasharray={fpsCircleCircumference}
                                                                    strokeDashoffset={fpsCircleStrokeDashoffset}
                                                                    strokeLinecap="round"
                                                                    transform="rotate(-90 50 50)"
                                                                />
                                                                <text
                                                                    x="50"
                                                                    y="50"
                                                                    fill="#fff"
                                                                    fontSize="20"
                                                                    fontWeight="bold"
                                                                    textAnchor="middle"
                                                                    dominantBaseline="middle"
                                                                >
                                                                    {systemStatus.fps}
                                                                </text>
                                                            </svg>
                                                        </div>
                                                        <div className="metric-details">
                                                            <div className="metric-label">Target</div>
                                                            <div className="metric-value">30</div>
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                        <Col md={4}>
                                            <Card className="metric-card">
                                                <Card.Body>
                                                    <div className="metric-title">System Load</div>
                                                    <div className="performance-metrics">
                                                        <div className="performance-metric">
                                                            <div className="metric-label">CPU</div>
                                                            <div className="progress progress-slim">
                                                                <div
                                                                    className="progress-bar bg-info"
                                                                    style={{ width: `${systemStatus.cpuUsage}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="metric-value">{systemStatus.cpuUsage.toFixed(1)}%</div>
                                                        </div>
                                                        <div className="performance-metric">
                                                            <div className="metric-label">Memory</div>
                                                            <div className="progress progress-slim">
                                                                <div
                                                                    className="progress-bar bg-warning"
                                                                    style={{ width: `${systemStatus.memoryUsage}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="metric-value">{systemStatus.memoryUsage.toFixed(1)}%</div>
                                                        </div>
                                                        <div className="performance-metric">
                                                            <div className="metric-label">Latency</div>
                                                            <div className="progress progress-slim">
                                                                <div
                                                                    className="progress-bar bg-danger"
                                                                    style={{ width: `${(systemStatus.latency / 50) * 100}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="metric-value">{systemStatus.latency.toFixed(1)} ms</div>
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                        <Col md={4}>
                                            <Card className="metric-card date-card">
                                                <Card.Body>
                                                    <div className="metric-title">Today</div>
                                                    <div className="date-display">
                                                        <div className="date-number">{currentDate.getDate()}</div>
                                                        <div className="date-details">
                                                            <div className="date-month">{formattedDate}</div>
                                                            <div className="date-day">{dayOfWeek}</div>
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    </Row>

                                    <Row className="mt-3">
                                        <Col md={12}>
                                            <Card>
                                                <Card.Header className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <Activity size={16} className="mr-2" />
                                                        System Performance
                                                    </div>
                                                </Card.Header>
                                                <Card.Body>
                                                    <div
                                                        className="chart-container"
                                                        style={{ height: '200px', position: 'relative' }}
                                                    >
                                                        {/* Chart would go here - using mock display */}
                                                        {performanceData.map((data, index) => (
                                                            <div
                                                                key={index}
                                                                style={{
                                                                    position: 'absolute',
                                                                    bottom: `${data.memory / 2}px`,
                                                                    left: `${(index / (performanceData.length - 1)) * 100}%`,
                                                                    width: '6px',
                                                                    height: '6px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: '#4CAF50'
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    </Row>
                                </Col>
                            </Row>

                            <Row>
                                <Col md={4}>
                                    <Card>
                                        <Card.Header>
                                            <Sliders size={16} className="mr-2" />
                                            Color Targets
                                        </Card.Header>
                                        <Card.Body className="p-0">
                                            {colorTargets.map(color => (
                                                <div key={color.id} className="color-target-item">
                                                    <div className="color-status">
                                                        <Form.Check
                                                            type="switch"
                                                            checked={color.active}
                                                            onChange={() => { }}
                                                            id={`color-switch-${color.id}`}
                                                        />
                                                    </div>
                                                    <div
                                                        className="color-swatch"
                                                        style={{ backgroundColor: color.hexColor }}
                                                    ></div>
                                                    <div className="color-info">
                                                        <div className="color-name">{color.name}</div>
                                                        <div className="color-hex">{color.hexColor}</div>
                                                    </div>
                                                    <div className="color-stats">
                                                        <div className="color-detection-bar">
                                                            <div
                                                                className="color-detection-progress"
                                                                style={{
                                                                    width: `${Math.random() * 100}%`,
                                                                    backgroundColor: color.hexColor
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <div className="color-percent">
                                                            {Math.floor(Math.random() * 100)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </Card.Body>
                                    </Card>
                                </Col>

                                <Col md={8}>
                                    <Card>
                                        <Card.Header>
                                            <Radio size={16} className="mr-2" />
                                            System Logs
                                        </Card.Header>
                                        <Card.Body style={{ height: '300px', padding: 0 }}>
                                            <LogViewer />
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </>
                    )}

                    {activeSection === 'detection' && (
                        <Card>
                            <Card.Header>
                                <Eye size={16} className="mr-2" />
                                Color Detection Settings
                            </Card.Header>
                            <Card.Body>
                                <ColorDetectionPanel />
                            </Card.Body>
                        </Card>
                    )}

                    {activeSection === 'mouse' && (
                        <Card>
                            <Card.Header>
                                <MousePointer size={16} className="mr-2" />
                                Mouse Adjustment Settings
                            </Card.Header>
                            <Card.Body>
                                <MouseSettingsPanel />
                            </Card.Body>
                        </Card>
                    )}

                    {activeSection === 'driver' && (
                        <Card>
                            <Card.Header>
                                <Cpu size={16} className="mr-2" />
                                Driver Settings
                            </Card.Header>
                            <Card.Body>
                                <DriverSettingsPanel />
                            </Card.Body>
                        </Card>
                    )}

                    {activeSection === 'presets' && (
                        <Card>
                            <Card.Header>
                                <Sliders size={16} className="mr-2" />
                                Preset Profiles
                            </Card.Header>
                            <Card.Body>
                                <PresetProfiles />
                            </Card.Body>
                        </Card>
                    )}

                    {activeSection === 'logs' && (
                        <Card>
                            <Card.Header>
                                <Radio size={16} className="mr-2" />
                                System Logs
                            </Card.Header>
                            <Card.Body className="p-0" style={{ height: '600px' }}>
                                <LogViewer />
                            </Card.Body>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );

    // Render classic dashboard
    const renderClassicDashboard = () => (
        <div className="app-container">
            <header className="app-header">
                <Container fluid>
                    <Row className="align-items-center">
                        <Col>
                            <h1>
                                <Target size={32} className="mr-2" />
                                Computer Vision Input Adjustment System
                            </h1>
                        </Col>
                        <Col xs="auto">
                            <SystemStatus status={systemStatus} />
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                className="ml-2"
                                onClick={() => setModernUI(true)}
                            >
                                Modern UI
                            </Button>
                        </Col>
                    </Row>
                </Container>
            </header>

            <Container fluid className="app-content">
                <Row>
                    <Col md={8}>
                        <Card className="preview-card">
                            <Card.Header>
                                <Eye size={18} className="mr-2" />
                                Detection Preview
                            </Card.Header>
                            <Card.Body>
                                <DetectionPreview />
                            </Card.Body>
                        </Card>

                        <Card className="mt-3">
                            <Card.Header>
                                <Tabs
                                    activeKey={activeTab}
                                    onSelect={(key) => setActiveTab(key)}
                                    className="settings-tabs"
                                >
                                    <Tab
                                        eventKey="detection"
                                        title={<span><Image size={16} className="mr-2" />Color Detection</span>}
                                    />
                                    <Tab
                                        eventKey="mouse"
                                        title={<span><MousePointer size={16} className="mr-2" />Mouse Adjustment</span>}
                                    />
                                    <Tab
                                        eventKey="driver"
                                        title={<span><Cpu size={16} className="mr-2" />Driver Settings</span>}
                                    />
                                    <Tab
                                        eventKey="presets"
                                        title={<span><Sliders size={16} className="mr-2" />Presets</span>}
                                    />
                                </Tabs>
                            </Card.Header>
                            <Card.Body>
                                {activeTab === 'detection' && <ColorDetectionPanel />}
                                {activeTab === 'mouse' && <MouseSettingsPanel />}
                                {activeTab === 'driver' && <DriverSettingsPanel />}
                                {activeTab === 'presets' && <PresetProfiles />}
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col md={4}>
                        <Card className="h-100">
                            <Card.Header>
                                <Radio size={18} className="mr-2" />
                                System Logs
                            </Card.Header>
                            <Card.Body className="p-0">
                                <LogViewer />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <Row className="mt-3">
                    <Col>
                        <Card className="info-card">
                            <Card.Body className="d-flex align-items-center">
                                <Info size={24} className="text-info mr-3" />
                                <div>
                                    <h5 className="mb-1">Educational & Research Tool</h5>
                                    <p className="mb-0">
                                        This system is designed for educational purposes to study color detection,
                                        input filtering, and human-computer interaction techniques.
                                    </p>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col>
                        <Card className="warning-card">
                            <Card.Body className="d-flex align-items-center">
                                <AlertTriangle size={24} className="text-warning mr-3" />
                                <div>
                                    <h5 className="mb-1">Ethical Usage Guidelines</h5>
                                    <p className="mb-0">
                                        This tool does not interact with any game memory or processes and complies
                                        with security research best practices.
                                    </p>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>

            <footer className="app-footer">
                <Container fluid>
                    <Row>
                        <Col>
                            <p className="text-muted mb-0">
                                Computer Vision Input Adjustment System - Educational & Research Tool v1.0
                            </p>
                        </Col>
                        <Col xs="auto">
                            <Shield size={16} className="mr-1" />
                            <span className="text-muted">Ethical Research Mode</span>
                        </Col>
                    </Row>
                </Container>
            </footer>
        </div>
    );

    return modernUI ? renderModernDashboard() : renderClassicDashboard();
}

export default App;