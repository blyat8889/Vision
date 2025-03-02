import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Alert, Spinner } from 'react-bootstrap';
import { Sliders, Check, Target, Activity, Zap } from 'react-feather';

import { getPresets, applyPreset } from '../services/api';

const PresetProfiles = () => {
    const [presets, setPresets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [applyingPreset, setApplyingPreset] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Load available presets
    useEffect(() => {
        const fetchPresets = async () => {
            try {
                setLoading(true);
                const data = await getPresets();
                setPresets(data);
                setError(null);
            } catch (err) {
                setError('Failed to load preset profiles');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPresets();
    }, []);

    // Handle applying a preset
    const handleApplyPreset = async (presetId) => {
        try {
            setApplyingPreset(presetId);
            await applyPreset(presetId);

            setSuccess(`Applied preset profile: ${presets.find(p => p.id === presetId).name}`);

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);

            setError(null);
        } catch (err) {
            setError(`Failed to apply preset: ${err.message}`);
            console.error(err);
        } finally {
            setApplyingPreset(null);
        }
    };

    // Render a preset card
    const renderPresetCard = (preset) => {
        const isApplying = applyingPreset === preset.id;

        return (
            <Card key={preset.id} className="mb-3">
                <Card.Body>
                    <Card.Title className="d-flex align-items-center mb-3">
                        {getPresetIcon(preset.id)}
                        <span className="ml-2">{preset.name}</span>
                    </Card.Title>

                    <Card.Text>{preset.description}</Card.Text>

                    <div className="preset-settings mb-3">
                        <h6 className="settings-title">Settings Overview</h6>
                        <Row>
                            {preset.detection && (
                                <Col md={4}>
                                    <div className="setting-group">
                                        <h6 className="setting-group-title">
                                            <Target size={14} className="mr-1" />
                                            Detection
                                        </h6>
                                        <ul className="setting-list">
                                            {Object.entries(preset.detection).map(([key, value]) => (
                                                <li key={key} className="setting-item">
                                                    {formatSettingKey(key)}: <strong>{formatSettingValue(key, value)}</strong>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Col>
                            )}

                            {preset.mouse && (
                                <Col md={4}>
                                    <div className="setting-group">
                                        <h6 className="setting-group-title">
                                            <Activity size={14} className="mr-1" />
                                            Mouse Filter
                                        </h6>
                                        <ul className="setting-list">
                                            {Object.entries(preset.mouse).map(([key, value]) => (
                                                <li key={key} className="setting-item">
                                                    {formatSettingKey(key)}: <strong>{formatSettingValue(key, value)}</strong>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Col>
                            )}

                            {preset.driver && (
                                <Col md={4}>
                                    <div className="setting-group">
                                        <h6 className="setting-group-title">
                                            <Sliders size={14} className="mr-1" />
                                            Driver
                                        </h6>
                                        <ul className="setting-list">
                                            {Object.entries(preset.driver).map(([key, value]) => (
                                                <li key={key} className="setting-item">
                                                    {formatSettingKey(key)}: <strong>{formatSettingValue(key, value)}</strong>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Col>
                            )}
                        </Row>
                    </div>

                    <Button
                        variant="outline-primary"
                        onClick={() => handleApplyPreset(preset.id)}
                        disabled={isApplying}
                        className="d-flex align-items-center"
                    >
                        {isApplying ? (
                            <>
                                <Spinner
                                    as="span"
                                    animation="border"
                                    size="sm"
                                    role="status"
                                    aria-hidden="true"
                                    className="mr-2"
                                />
                                Applying...
                            </>
                        ) : (
                            <>
                                <Check size={16} className="mr-2" />
                                Apply Profile
                            </>
                        )}
                    </Button>
                </Card.Body>
            </Card>
        );
    };

    // Helper function to get icon for preset
    const getPresetIcon = (presetId) => {
        switch (presetId) {
            case 'precision':
                return <Target size={20} />;
            case 'balanced':
                return <Sliders size={20} />;
            case 'fast':
                return <Zap size={20} />;
            default:
                return <Sliders size={20} />;
        }
    };

    // Helper function to format setting keys for display
    const formatSettingKey = (key) => {
        return key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
            .replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space between camelCase words
    };

    // Helper function to format setting values for display
    const formatSettingValue = (key, value) => {
        if (typeof value === 'boolean') {
            return value ? 'Enabled' : 'Disabled';
        }

        if (typeof value === 'number') {
            // Add percentage for certain settings
            if (key.includes('Factor') || key.includes('Strength') || key.includes('Speed')) {
                return `${value}%`;
            }
            return value;
        }

        return value;
    };

    return (
        <div className="preset-profiles">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <div className="preset-description mb-4">
                <h4 className="mb-3">Preset Profiles</h4>
                <p>
                    Apply these preset profiles to quickly configure all system components
                    for specific use cases. Each profile sets optimal parameters for detection,
                    mouse filter, and driver components.
                </p>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Loading preset profiles...</p>
                </div>
            ) : (
                <div className="preset-cards">
                    {presets.map(preset => renderPresetCard(preset))}
                </div>
            )}

            <style jsx>{`
        .settings-title {
          font-size: 0.9rem;
          text-transform: uppercase;
          color: #6c757d;
          letter-spacing: 0.5px;
          margin-bottom: 1rem;
        }
        
        .setting-group {
          margin-bottom: 1.5rem;
        }
        
        .setting-group-title {
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          margin-bottom: 0.5rem;
          color: #495057;
        }
        
        .setting-list {
          list-style: none;
          padding-left: 0.5rem;
          margin-bottom: 0;
          font-size: 0.9rem;
        }
        
        .setting-item {
          margin-bottom: 0.25rem;
          color: #6c757d;
        }
        
        .setting-item strong {
          color: #212529;
        }
      `}</style>
        </div>
    );
};

export default PresetProfiles;