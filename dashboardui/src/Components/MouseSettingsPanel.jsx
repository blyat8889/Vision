import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, Alert, Card, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { Settings, Save, RefreshCw, Activity } from 'react-feather';
import RangeSlider from 'react-bootstrap-range-slider';

import { getMouseSettings, updateMouseSettings } from '../services/api';

const MouseSettingsPanel = () => {
    // State for mouse settings
    const [settings, setSettings] = useState({
        active: false,
        smoothingFactor: 50,
        filterType: 'adaptive',
        responseSpeed: 50,
        filteringStrength: 50,
        movementType: 'hybrid',
        humanizeEnabled: true,
        humanizeFactor: 20,
        predictionEnabled: false,
        predictionFrames: 5
    });

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [advancedMode, setAdvancedMode] = useState(false);

    // Load initial settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const data = await getMouseSettings();
                setSettings(data);
                setError(null);
            } catch (err) {
                setError('Failed to load mouse settings');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
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

    // Handle filter type change
    const handleFilterTypeChange = (type) => {
        const newSettings = {
            ...settings,
            filterType: type
        };

        setSettings(newSettings);
    };

    // Handle movement type change
    const handleMovementTypeChange = (type) => {
        const newSettings = {
            ...settings,
            movementType: type
        };

        setSettings(newSettings);
    };

    // Handle saving settings
    const saveSettings = async (settingsToSave = settings) => {
        try {
            setLoading(true);
            await updateMouseSettings(settingsToSave);
            setSuccess('Settings saved successfully');

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);

            setError(null);
        } catch (err) {
            setError('Failed to save settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mouse-settings-panel">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Row className="mb-4">
                <Col>
                    <Card>
                        <Card.Body>
                            <h4 className="mb-3 d-flex align-items-center">
                                <Settings size={22} className="mr-2" />
                                Mouse Input Adjustment
                            </h4>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Filter Status</Form.Label>
                                <Col md={8}>
                                    <Button
                                        variant={settings.active ? "danger" : "success"}
                                        onClick={handleToggleActive}
                                        disabled={loading}
                                    >
                                        {settings.active ? "Disable Filter" : "Enable Filter"}
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
                                <Form.Label column md={4}>Filter Type</Form.Label>
                                <Col md={8}>
                                    <ToggleButtonGroup
                                        type="radio"
                                        name="filter-type"
                                        value={settings.filterType}
                                        onChange={handleFilterTypeChange}
                                        className="w-100"
                                    >
                                        <ToggleButton id="filter-exponential" value="exponential" variant="outline-primary" size="sm">
                                            Exponential
                                        </ToggleButton>
                                        <ToggleButton id="filter-moving-avg" value="moving_avg" variant="outline-primary" size="sm">
                                            Moving Avg
                                        </ToggleButton>
                                        <ToggleButton id="filter-adaptive" value="adaptive" variant="outline-primary" size="sm">
                                            Adaptive
                                        </ToggleButton>
                                    </ToggleButtonGroup>
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

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Movement Type</Form.Label>
                                <Col md={8}>
                                    <ToggleButtonGroup
                                        type="radio"
                                        name="movement-type"
                                        value={settings.movementType}
                                        onChange={handleMovementTypeChange}
                                        className="w-100"
                                    >
                                        <ToggleButton id="movement-smoothed" value="smoothed" variant="outline-primary" size="sm">
                                            Smoothed
                                        </ToggleButton>
                                        <ToggleButton id="movement-human" value="human" variant="outline-primary" size="sm">
                                            Human-like
                                        </ToggleButton>
                                        <ToggleButton id="movement-hybrid" value="hybrid" variant="outline-primary" size="sm">
                                            Hybrid
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Human-like Movement</Form.Label>
                                <Col md={8}>
                                    <Form.Check
                                        type="switch"
                                        id="humanize-switch"
                                        label="Add human-like randomization"
                                        checked={settings.humanizeEnabled}
                                        onChange={e => setSettings({ ...settings, humanizeEnabled: e.target.checked })}
                                    />

                                    {settings.humanizeEnabled && (
                                        <Row className="mt-2">
                                            <Col xs={9}>
                                                <RangeSlider
                                                    value={settings.humanizeFactor}
                                                    onChange={e => setSettings({ ...settings, humanizeFactor: parseInt(e.target.value, 10) })}
                                                    min={0}
                                                    max={100}
                                                    tooltipLabel={value => `${value}%`}
                                                    size="sm"
                                                />
                                            </Col>
                                            <Col xs={3}>
                                                <Form.Control
                                                    value={settings.humanizeFactor}
                                                    onChange={e => setSettings({ ...settings, humanizeFactor: parseInt(e.target.value, 10) })}
                                                    size="sm"
                                                />
                                            </Col>
                                        </Row>
                                    )}
                                </Col>
                            </Form.Group>

                            <Button
                                variant="link"
                                className="text-muted p-0 mb-3"
                                onClick={() => setAdvancedMode(!advancedMode)}
                            >
                                {advancedMode ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                            </Button>

                            {advancedMode && (
                                <div className="advanced-settings">
                                    <Form.Group as={Row} className="mb-3">
                                        <Form.Label column md={4}>Motion Prediction</Form.Label>
                                        <Col md={8}>
                                            <Form.Check
                                                type="switch"
                                                id="prediction-switch"
                                                label="Enable motion prediction"
                                                checked={settings.predictionEnabled}
                                                onChange={e => setSettings({ ...settings, predictionEnabled: e.target.checked })}
                                            />

                                            {settings.predictionEnabled && (
                                                <Row className="mt-2">
                                                    <Form.Label column xs={6}>Prediction Frames</Form.Label>
                                                    <Col xs={6}>
                                                        <Form.Control
                                                            type="number"
                                                            value={settings.predictionFrames}
                                                            onChange={e => setSettings({ ...settings, predictionFrames: parseInt(e.target.value, 10) })}
                                                            min={1}
                                                            max={20}
                                                            size="sm"
                                                        />
                                                    </Col>
                                                </Row>
                                            )}
                                        </Col>
                                    </Form.Group>
                                </div>
                            )}
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

export default MouseSettingsPanel;
