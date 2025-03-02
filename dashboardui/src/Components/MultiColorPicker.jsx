import React, { useState } from 'react';
import { Row, Col, Form, Button, InputGroup, Badge, Card } from 'react-bootstrap';
import { Camera, Edit2, Plus, Trash2, Check } from 'react-feather';

// Helper function to convert hex to HSV
const hexToHsv = (hex) => {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse the hex string
    let r = parseInt(hex.slice(0, 2), 16) / 255;
    let g = parseInt(hex.slice(2, 4), 16) / 255;
    let b = parseInt(hex.slice(4, 6), 16) / 255;

    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let delta = max - min;

    // Calculate HSV values
    let h = 0;
    let s = max === 0 ? 0 : delta / max;
    let v = max;

    if (delta !== 0) {
        if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }

        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }

    // Convert to OpenCV HSV ranges
    h = Math.round(h / 2); // OpenCV H range is 0-179
    s = Math.round(s * 255);
    v = Math.round(v * 255);

    return [h, s, v];
};

// Helper function to convert HSV to hex
const hsvToHex = (h, s, v) => {
    // Convert from OpenCV ranges
    h = (h * 2) % 360; // Convert from 0-179 to 0-359
    s = s / 255;
    v = v / 255;

    let c = v * s;
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    let m = v - c;

    let r, g, b;

    if (h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    // Convert to 0-255 range and then to hex
    r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    b = Math.round((b + m) * 255).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`;
};

// Create a tolerance range for HSV values
const createHsvRange = (hsv, tolerance) => {
    const [h, s, v] = hsv;

    // Create lower bound with tolerance
    const hLower = Math.max(0, h - tolerance.h);
    const sLower = Math.max(0, s - tolerance.s);
    const vLower = Math.max(0, v - tolerance.v);

    // Create upper bound with tolerance
    const hUpper = Math.min(179, h + tolerance.h);
    const sUpper = Math.min(255, s + tolerance.s);
    const vUpper = Math.min(255, v + tolerance.v);

    return {
        lower: [hLower, sLower, vLower],
        upper: [hUpper, sUpper, vUpper]
    };
};

const MultiColorPicker = ({
    colorTargets,
    onUpdateColors,
    onSampleColor,
    loading
}) => {
    // State for adding a new color
    const [newColorHex, setNewColorHex] = useState('#00ff00');
    const [newColorName, setNewColorName] = useState('');
    const [newColorTolerance, setNewColorTolerance] = useState(25);
    const [isAddingColor, setIsAddingColor] = useState(false);

    // Generate a unique ID for new colors
    const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    };

    // Add a new color to the list
    const handleAddColor = () => {
        // Calculate HSV range for the new color
        const hsv = hexToHsv(newColorHex);

        // Calculate tolerance for each component
        const hTolerance = Math.round((newColorTolerance / 100) * 30);
        const sTolerance = Math.round((newColorTolerance / 100) * 100);
        const vTolerance = Math.round((newColorTolerance / 100) * 100);

        const range = createHsvRange(hsv, { h: hTolerance, s: sTolerance, v: vTolerance });

        // Create new color object
        const newColor = {
            id: generateId(),
            name: newColorName || `Color ${colorTargets.length + 1}`,
            hexColor: newColorHex,
            hsvLower: range.lower,
            hsvUpper: range.upper,
            tolerance: newColorTolerance,
            active: true
        };

        // Add to the list
        onUpdateColors([...colorTargets, newColor]);

        // Reset form
        setNewColorHex('#00ff00');
        setNewColorName('');
        setNewColorTolerance(25);
        setIsAddingColor(false);
    };

    // Update an existing color
    const handleUpdateColor = (id, updates) => {
        const updatedColors = colorTargets.map(color => {
            if (color.id === id) {
                // If updating the hex color, recalculate HSV range
                if (updates.hexColor && updates.hexColor !== color.hexColor) {
                    const hsv = hexToHsv(updates.hexColor);
                    const tolerance = updates.tolerance !== undefined ? updates.tolerance : color.tolerance;

                    const hTolerance = Math.round((tolerance / 100) * 30);
                    const sTolerance = Math.round((tolerance / 100) * 100);
                    const vTolerance = Math.round((tolerance / 100) * 100);

                    const range = createHsvRange(hsv, { h: hTolerance, s: sTolerance, v: vTolerance });

                    return {
                        ...color,
                        ...updates,
                        hsvLower: range.lower,
                        hsvUpper: range.upper
                    };
                }
                // If only updating tolerance, recalculate HSV range
                else if (updates.tolerance !== undefined && updates.tolerance !== color.tolerance) {
                    const hsv = hexToHsv(color.hexColor);
                    const tolerance = updates.tolerance;

                    const hTolerance = Math.round((tolerance / 100) * 30);
                    const sTolerance = Math.round((tolerance / 100) * 100);
                    const vTolerance = Math.round((tolerance / 100) * 100);

                    const range = createHsvRange(hsv, { h: hTolerance, s: sTolerance, v: vTolerance });

                    return {
                        ...color,
                        ...updates,
                        hsvLower: range.lower,
                        hsvUpper: range.upper
                    };
                }

                return { ...color, ...updates };
            }
            return color;
        });

        onUpdateColors(updatedColors);
    };

    // Remove a color from the list
    const handleRemoveColor = (id) => {
        const updatedColors = colorTargets.filter(color => color.id !== id);
        onUpdateColors(updatedColors);
    };

    // Toggle active state for a color
    const handleToggleActive = (id) => {
        const updatedColors = colorTargets.map(color => {
            if (color.id === id) {
                return { ...color, active: !color.active };
            }
            return color;
        });

        onUpdateColors(updatedColors);
    };

    // Handle hex input change for new color
    const handleHexChange = (e) => {
        const hex = e.target.value;

        // Validate hex format
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            setNewColorHex(hex);
        } else if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
            // Add # if missing
            setNewColorHex(`#${hex}`);
        } else {
            // Just update the input for now
            setNewColorHex(hex);
        }
    };

    // Handle hex input blur (to ensure valid hex)
    const handleHexBlur = () => {
        // Ensure valid hex on blur
        if (!/^#[0-9A-Fa-f]{6}$/.test(newColorHex)) {
            // Reset to a valid hex
            setNewColorHex('#00ff00');
        }
    };

    // Sample a color at the current cursor position
    const handleSampleColor = async () => {
        try {
            const colorData = await onSampleColor();

            // Calculate hex from HSV
            const avgH = Math.floor((colorData.hsvLower[0] + colorData.hsvUpper[0]) / 2);
            const avgS = Math.floor((colorData.hsvLower[1] + colorData.hsvUpper[1]) / 2);
            const avgV = Math.floor((colorData.hsvLower[2] + colorData.hsvUpper[2]) / 2);
            const hex = hsvToHex(avgH, avgS, avgV);

            // Add to color list if adding, otherwise just replace active color
            if (isAddingColor) {
                setNewColorHex(hex);
            } else if (colorTargets.length > 0) {
                // Find last active color and update it
                const lastActive = [...colorTargets].reverse().find(c => c.active);
                if (lastActive) {
                    handleUpdateColor(lastActive.id, {
                        hexColor: hex,
                        hsvLower: colorData.hsvLower,
                        hsvUpper: colorData.hsvUpper
                    });
                }
            }
        } catch (error) {
            console.error("Error sampling color:", error);
        }
    };

    return (
        <div className="multi-color-picker">
            {/* Color list */}
            <div className="color-list mb-3">
                {colorTargets.length === 0 && !isAddingColor && (
                    <div className="text-center py-3 text-muted">
                        No colors added yet. Click "Add Color" below to get started.
                    </div>
                )}

                {colorTargets.map((color) => (
                    <Card key={color.id} className={`color-item mb-2 ${!color.active ? 'inactive' : ''}`}>
                        <Card.Body className="py-2 px-3">
                            <Row className="align-items-center">
                                <Col xs={1}>
                                    <Form.Check
                                        type="checkbox"
                                        checked={color.active}
                                        onChange={() => handleToggleActive(color.id)}
                                        aria-label={`Toggle ${color.name}`}
                                    />
                                </Col>
                                <Col xs={7}>
                                    <div className="d-flex align-items-center">
                                        <div
                                            className="color-swatch mr-2"
                                            style={{ backgroundColor: color.hexColor }}
                                        ></div>
                                        <div>
                                            <div className="color-name">{color.name}</div>
                                            <div className="color-hex">{color.hexColor}</div>
                                        </div>
                                    </div>
                                </Col>
                                <Col xs={3}>
                                    <Form.Range
                                        value={color.tolerance}
                                        onChange={(e) => handleUpdateColor(color.id, { tolerance: parseInt(e.target.value, 10) })}
                                        min={5}
                                        max={50}
                                        disabled={!color.active}
                                    />
                                </Col>
                                <Col xs={1} className="text-right">
                                    <Button
                                        variant="link"
                                        className="p-0 text-danger"
                                        onClick={() => handleRemoveColor(color.id)}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                ))}
            </div>

            {/* Add color form */}
            {isAddingColor ? (
                <Card className="mb-3">
                    <Card.Body>
                        <h5 className="mb-3">Add New Color</h5>

                        <Form.Group className="mb-3">
                            <Form.Label>Color Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={newColorName}
                                onChange={(e) => setNewColorName(e.target.value)}
                                placeholder="Enter color name"
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Color (Hex Code)</Form.Label>
                            <Row className="align-items-center">
                                <Col xs={9}>
                                    <InputGroup>
                                        <InputGroup.Text><Edit2 size={16} /></InputGroup.Text>
                                        <Form.Control
                                            type="text"
                                            value={newColorHex}
                                            onChange={handleHexChange}
                                            onBlur={handleHexBlur}
                                            placeholder="#00ff00"
                                            maxLength={7}
                                        />
                                    </InputGroup>
                                </Col>
                                <Col xs={3}>
                                    <div
                                        className="color-preview-box"
                                        style={{ backgroundColor: newColorHex }}
                                    ></div>
                                </Col>
                            </Row>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Color Tolerance: {newColorTolerance}%</Form.Label>
                            <Form.Range
                                value={newColorTolerance}
                                onChange={(e) => setNewColorTolerance(parseInt(e.target.value, 10))}
                                min={5}
                                max={50}
                            />
                        </Form.Group>

                        <div className="d-flex justify-content-between">
                            <Button
                                variant="secondary"
                                onClick={() => setIsAddingColor(false)}
                            >
                                Cancel
                            </Button>

                            <Button
                                variant="primary"
                                onClick={handleAddColor}
                                disabled={!/^#[0-9A-Fa-f]{6}$/.test(newColorHex)}
                            >
                                <Check size={16} className="mr-2" />
                                Add Color
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            ) : (
                <div className="action-buttons mb-3">
                    <Button
                        variant="primary"
                        className="w-100 mb-2"
                        onClick={() => setIsAddingColor(true)}
                    >
                        <Plus size={16} className="mr-2" />
                        Add Color
                    </Button>

                    <Button
                        variant="outline-primary"
                        className="w-100 d-flex align-items-center justify-content-center"
                        onClick={handleSampleColor}
                        disabled={loading || (colorTargets.length === 0 && !isAddingColor)}
                    >
                        <Camera size={16} className="mr-2" />
                        Sample Color from Screen
                    </Button>
                </div>
            )}

            <style jsx="true">{`
        .color-swatch {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }
        
        .color-item {
          transition: opacity 0.2s ease-in-out;
          border-left: 4px solid transparent;
        }
        
        .color-item.inactive {
          opacity: 0.6;
          border-left-color: #dc3545;
        }
        
        .color-name {
          font-weight: 500;
          font-size: 0.9rem;
        }
        
        .color-hex {
          font-size: 0.8rem;
          color: #6c757d;
        }
        
        .color-preview-box {
          width: 100%;
          height: 38px;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }
      `}</style>
        </div>
    );
};

export default MultiColorPicker;