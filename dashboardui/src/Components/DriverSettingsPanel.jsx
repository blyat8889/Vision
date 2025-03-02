import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, Alert, Card } from 'react-bootstrap';
import { Cpu, Save, RefreshCw, AlertTriangle } from 'react-feather';
import RangeSlider from 'react-bootstrap-range-slider';

import { getDriverSettings, updateDriverSettings } from '../services/api';

const DriverSettingsPanel = () => {
    // State for driver settings
    const [settings, setSettings] = useState({
        active: false,
        smoothingFactor: 50,
        responseSpeed: 50,
        filteringStrength: 50
    });

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [adminWarning, setAdminWarning] = useState(false);

    // Load initial settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const data = await getDriverSettings();
                setSettings(data);
                setError(null);
            } catch (err) {
                setError('Failed to load driver settings');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        // Check if running as admin (simplified check)
        const checkAdmin = async () => {
            // In a real app, this would be a backend check
            // For now, we'll just simulate it
            try {
                const response = await fetch('/api/status');
                const data = await response.json();

                // If driver is unavailable, might not be running as admin
                if (data && !data.driverAvailable) {
                    setAdminWarning(true);
                }
            } catch (err) {
                // Ignore error, default to false
            }
        };

        fetchSettings();
        checkAdmin();
    }, []);

    // Handle toggle active state
    const handleToggleActive = () => {
        const newSettings = {
            ...settings,
            active: !settings.active
        };

        setSettings(newSettings);
        saveSettings(newSettings);
    };

    // Handle saving settings
    const saveSettings = async (settingsToSave = settings) => {
        try {
            setLoading(true);
            await updateDriverSettings(settingsToSave);
            setSuccess('Settings saved successfully');

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);

            setError(null);
        } catch (err) {
            setError('Failed to save settings. Make sure the driver is installed and you have administrator privileges.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="driver-settings-panel">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            {adminWarning && (
                <Alert variant="warning" className="d-flex align-items-center">
                    <AlertTriangle size={20} className="mr-2" />
                    This application may need administrator privileges to control the driver.
                    Try running the application as administrator.
                </Alert>
            )}

            <Row className="mb-4">
                <Col>
                    <Card>
                        <Card.Body>
                            <h4 className="mb-3 d-flex align-items-center">
                                <Cpu size={22} className="mr-2" />
                                HID Filter Driver Settings
                            </h4>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Driver Status</Form.Label>
                                <Col md={8}>
                                    <Button
                                        variant={settings.active ? "danger" : "success"}
                                        onClick={handleToggleActive}
                                        disabled={loading}
                                    >
                                        {settings.active ? "Disable Driver" : "Enable Driver"}
                                    </Button>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Smoothing Factor</Form.Label>
                                <Col md={8}>
                                    <Row>
                                        <Col xs={9}>
                                            <RangeSlider
                                                value={settings.smoothingFactor}
                                                onChange={e => setSettings({ ...settings, smoothingFactor: parseInt(e.target.value, 10) })}
                                                min={0}
                                                max={100}
                                                tooltipLabel={value => `${value}%`}
                                            />
                                        </Col>
                                        <Col xs={3}>
                                            <Form.Control
                                                value={settings.smoothingFactor}
                                                onChange={e => setSettings({ ...settings, smoothingFactor: parseInt(e.target.value, 10) })}
                                                size="sm"
                                            />
                                        </Col>
                                    </Row>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Response Speed</Form.Label>
                                <Col md={8}>
                                    <Row>
                                        <Col xs={9}>
                                            <RangeSlider
                                                value={settings.responseSpeed}
                                                onChange={e => setSettings({ ...settings, responseSpeed: parseInt(e.target.value, 10) })}
                                                min={0}
                                                max={100}
                                                tooltipLabel={value => value < 33 ? "Slow" : value < 66 ? "Medium" : "Fast"}
                                            />
                                        </Col>
                                        <Col xs={3}>
                                            <Form.Control
                                                value={settings.responseSpeed}
                                                onChange={e => setSettings({ ...settings, responseSpeed: parseInt(e.target.value, 10) })}
                                                size="sm"
                                            />
                                        </Col>
                                    </Row>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Filtering Strength</Form.Label>
                                <Col md={8}>
                                    <Row>
                                        <Col xs={9}>
                                            <RangeSlider
                                                value={settings.filteringStrength}
                                                onChange={e => setSettings({ ...settings, filteringStrength: parseInt(e.target.value, 10) })}
                                                min={0}
                                                max={100}
                                                tooltipLabel={value => value < 33 ? "Light" : value < 66 ? "Medium" : "Strong"}
                                            />
                                        </Col>
                                        <Col xs={3}>
                                            <Form.Control
                                                value={settings.filteringStrength}
                                                onChange={e => setSettings({ ...settings, filteringStrength: parseInt(e.target.value, 10) })}
                                                size="sm"
                                            />
                                        </Col>
                                    </Row>
                                </Col>
                            </Form.Group>

                            <Alert variant="info">
                                <h5>Note on Driver Operation</h5>
                                <p>
                                    The HID Filter Driver operates at the kernel level to provide the most responsive
                                    input adjustment. This requires proper driver installation and may require
                                    administrator privileges to control.
                                </p>
                                <hr />
                                <p className="mb-0">
                                    For research purposes only. The driver follows Windows Driver Kit (WDK) best practices
                                    and does not interfere with any other processes.
                                </p>
                            </Alert>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="mt-4">
                <Col className="d-flex justify-content-end">
                    <Button
                        variant="secondary"
                        className="mr-2 d-flex align-items-center"
                        onClick={() => window.location.reload()}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className="mr-2" />
                        Reset to Defaults
                    </Button>

                    <Button
                        variant="primary"
                        className="d-flex align-items-center"
                        onClick={() => saveSettings()}
                        disabled={loading}
                    >
                        <Save size={16} className="mr-2" />
                        Save Settings
                    </Button>
                </Col>
            </Row>
        </div>
    );
};

export default DriverSettingsPanel;