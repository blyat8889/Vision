import React from 'react';
import { Card } from 'react-bootstrap';

// This is a reusable settings panel component used by other setting screens
const SettingsPanel = ({ title, description, children }) => {
    return (
        <div className="settings-panel">
            <Card>
                <Card.Header>
                    <h5 className="mb-0">{title}</h5>
                    {description && <p className="text-muted mb-0 mt-1">{description}</p>}
                </Card.Header>
                <Card.Body>
                    {children}
                </Card.Body>
            </Card>
        </div>
    );
};

export default SettingsPanel;