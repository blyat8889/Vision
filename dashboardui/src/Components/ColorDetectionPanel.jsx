import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Button, Alert, Card } from 'react-bootstrap';
import { Sliders, RefreshCw, Play, Square, Save } from 'react-feather';
import RangeSlider from 'react-bootstrap-range-slider';

import {
    getDetectionSettings,
    updateDetectionSettings,
    startDetection,
    stopDetection,
    captureColorSample
} from '../services/api';

// Import our multi-color picker component
import MultiColorPicker from './MultiColorPicker';

import 'react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css';

const ColorDetectionPanel = () => {
    // State for color detection settings
    const [settings, setSettings] = useState({
        active: false,
        colorTargets: [], // Array of multiple color targets
        noiseReduction: 5,
        adaptiveMode: false,
        roiEnabled: false,
        roi: { x: 0, y: 0, width: 800, height: 600 },
        minArea: 100,
        fps: 30
    });

    // State for UI
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [advancedMode, setAdvancedMode] = useState(false);

    // Load initial settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const data = await getDetectionSettings();

                // If the backend doesn't return colorTargets array, create one from the HSV ranges
                if (!data.colorTargets || data.colorTargets.length === 0) {
                    // Convert legacy single-color settings to multi-color format
                    const colorTargets = [{
                        id: '1',
                        name: 'Default Color',
                        hexColor: '#00ff00', // Default to green
                        hsvLower: data.hsvLower || [40, 50, 50],
                        hsvUpper: data.hsvUpper || [80, 255, 255],
                        tolerance: 25,
                        active: true
                    }];

                    setSettings({
                        ...data,
                        colorTargets
                    });
                } else {
                    setSettings(data);
                }

                setError(null);
            } catch (err) {
                setError('Failed to load detection settings');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // Handle toggling detection active state
    const handleToggleActive = async () => {
        try {
            if (settings.active) {
                await stopDetection();
            } else {
                await startDetection();
            }

            // Update local state
            setSettings({
                ...settings,
                active: !settings.active
            });

            setSuccess(`Detection ${!settings.active ? 'started' : 'stopped'} successfully`);

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(`Failed to ${settings.active ? 'stop' : 'start'} detection`);
            console.error(err);
        }
    };

    // Handle saving settings
    const handleSaveSettings = async () => {
        try {
            setLoading(true);

            // For backwards compatibility, also include the first active color's HSV ranges
            // at the top level of the settings object
            const activeColor = settings.colorTargets.find(color => color.active);
            const updatedSettings = {
                ...settings
            };

            if (activeColor) {
                updatedSettings.hsvLower = activeColor.hsvLower;
                updatedSettings.hsvUpper = activeColor.hsvUpper;
            }

            await updateDetectionSettings(updatedSettings);
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

    // Handle color targets updates from MultiColorPicker
    const handleUpdateColors = (colorTargets) => {
        setSettings({
            ...settings,
            colorTargets
        });
    };

    // Handle ROI value changes
    const handleRoiChange = (property, value) => {
        const newRoi = {
            ...settings.roi,
            [property]: parseInt(value, 10)
        };

        setSettings({
            ...settings,
            roi: newRoi
        });
    };

    // Handle color sampling
    const handleColorSample = async () => {
        try {
            setLoading(true);
            console.log('Attempting to sample color...');
            const colorData = await captureColorSample();
            console.log('Color data received:', colorData);

            // Return the sampled color data to the color picker
            return colorData;
        } catch (err) {
            console.error('Detailed error sampling color:', err);
            setError('Failed to sample color');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="detection-panel">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Row className="mb-4">
                <Col md={8}>
                    <Card>
                        <Card.Body>
                            <h4 className="mb-3">Color Detection Settings</h4>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Detection Status</Form.Label>
                                <Col md={8}>
                                    <Button
                                        variant={settings.active ? "danger" : "success"}
                                        onClick={handleToggleActive}
                                        disabled={loading}
                                        className="d-flex align-items-center"
                                    >
                                        {settings.active ?
                                            <><Square size={16} className="mr-2" /> Stop Detection</> :
                                            <><Play size={16} className="mr-2" /> Start Detection</>
                                        }
                                    </Button>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>FPS Limit</Form.Label>
                                <Col md={8}>
                                    <Row>
                                        <Col xs={9}>
                                            <RangeSlider
                                                value={settings.fps}
                                                onChange={e => setSettings({ ...settings, fps: parseInt(e.target.value, 10) })}
                                                min={5}
                                                max={60}
                                                step={5}
                                            />
                                        </Col>
                                        <Col xs={3}>
                                            <Form.Control
                                                value={settings.fps}
                                                onChange={e => setSettings({ ...settings, fps: parseInt(e.target.value, 10) })}
                                                size="sm"
                                            />
                                        </Col>
                                    </Row>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Noise Reduction</Form.Label>
                                <Col md={8}>
                                    <Row>
                                        <Col xs={9}>
                                            <RangeSlider
                                                value={settings.noiseReduction}
                                                onChange={e => setSettings({ ...settings, noiseReduction: parseInt(e.target.value, 10) })}
                                                min={0}
                                                max={15}
                                                step={1}
                                            />
                                        </Col>
                                        <Col xs={3}>
                                            <Form.Control
                                                value={settings.noiseReduction}
                                                onChange={e => setSettings({ ...settings, noiseReduction: parseInt(e.target.value, 10) })}
                                                size="sm"
                                            />
                                        </Col>
                                    </Row>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Minimum Area (px²)</Form.Label>
                                <Col md={8}>
                                    <Row>
                                        <Col xs={9}>
                                            <RangeSlider
                                                value={settings.minArea}
                                                onChange={e => setSettings({ ...settings, minArea: parseInt(e.target.value, 10) })}
                                                min={10}
                                                max={1000}
                                                step={10}
                                            />
                                        </Col>
                                        <Col xs={3}>
                                            <Form.Control
                                                value={settings.minArea}
                                                onChange={e => setSettings({ ...settings, minArea: parseInt(e.target.value, 10) })}
                                                size="sm"
                                            />
                                        </Col>
                                    </Row>
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column md={4}>Adaptive Mode</Form.Label>
                                <Col md={8}>
                                    <Form.Check
                                        type="switch"
                                        id="adaptive-mode-switch"
                                        label="Automatically adjust to lighting changes"
                                        checked={settings.adaptiveMode}
                                        onChange={e => setSettings({ ...settings, adaptiveMode: e.target.checked })}
                                    />
                                </Col>
                            </Form.Group>
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={4}>
                    <Card>
                        <Card.Body>
                            <h4 className="mb-3">Color Targets</h4>

                            <MultiColorPicker
                                colorTargets={settings.colorTargets || []}
                                onUpdateColors={handleUpdateColors}
                                onSampleColor={handleColorSample}
                                loading={loading}
                            />

                            <Button
                                variant="link"
                                className="text-muted w-100"
                                onClick={() => setAdvancedMode(!advancedMode)}
                            >
                                {advancedMode ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {advancedMode && (
                <Row>
                    <Col md={12}>
                        <Card>
                            <Card.Header as="h5">
                                <Sliders size={18} className="mr-2" />
                                Advanced Settings
                            </Card.Header>
                            <Card.Body>
                                <Row className="mt-3">
                                    <Col>
                                        <Form.Check
                                            type="switch"
                                            id="roi-enabled-switch"
                                            label="Enable Region of Interest (ROI)"
                                            checked={settings.roiEnabled}
                                            onChange={e => setSettings({ ...settings, roiEnabled: e.target.checked })}
                                            className="mb-3"
                                        />

                                        {settings.roiEnabled && (
                                            <Row>
                                                <Col md={3}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label>X Position</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            value={settings.roi.x}
                                                            onChange={e => handleRoiChange('x', e.target.value)}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={3}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label>Y Position</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            value={settings.roi.y}
                                                            onChange={e => handleRoiChange('y', e.target.value)}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={3}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label>Width</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            value={settings.roi.width}
                                                            onChange={e => handleRoiChange('width', e.target.value)}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={3}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label>Height</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            value={settings.roi.height}
                                                            onChange={e => handleRoiChange('height', e.target.value)}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                            </Row>
                                        )}
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

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
                        onClick={handleSaveSettings}
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

export default ColorDetectionPanel;