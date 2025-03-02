import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Form, Button, InputGroup } from 'react-bootstrap';
import { Camera, Edit2 } from 'react-feather';

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

const ColorPicker = ({
    lowerHsv,
    upperHsv,
    onColorChange,
    onSampleColor,
    loading
}) => {
    // State for the current color and hex input
    const [colorHex, setColorHex] = useState('#00ff00');
    const [tolerance, setTolerance] = useState(25); // 0-100 value for tolerance

    // Canvas refs for the gradient and hue selector
    const gradientRef = useRef(null);
    const hueRef = useRef(null);

    // Initialize hex color from HSV values
    useEffect(() => {
        // Calculate average color from HSV range
        const avgH = Math.floor((lowerHsv[0] + upperHsv[0]) / 2);
        const avgS = Math.floor((lowerHsv[1] + upperHsv[1]) / 2);
        const avgV = Math.floor((lowerHsv[2] + upperHsv[2]) / 2);

        const hex = hsvToHex(avgH, avgS, avgV);
        setColorHex(hex);

        // Calculate approximate tolerance
        const hDiff = Math.abs(upperHsv[0] - lowerHsv[0]);
        const sDiff = Math.abs(upperHsv[1] - lowerHsv[1]);
        const vDiff = Math.abs(upperHsv[2] - lowerHsv[2]);

        // Average the differences and scale to 0-100
        const avgDiff = (hDiff / 179 + sDiff / 255 + vDiff / 255) / 3;
        setTolerance(Math.round(avgDiff * 100));
    }, [lowerHsv, upperHsv]);

    // Draw the color gradient canvas
    useEffect(() => {
        if (gradientRef.current) {
            const canvas = gradientRef.current;
            const ctx = canvas.getContext('2d');

            // Parse the base color
            const hsv = hexToHsv(colorHex);
            const h = hsv[0] * 2; // Convert back to 0-359 for better gradient

            // Draw saturation/value gradient
            for (let s = 0; s <= 100; s++) {
                for (let v = 0; v <= 100; v++) {
                    // Convert HSV to RGB for canvas
                    const rgb = hsvToRgb(h, s / 100, v / 100);
                    ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                    ctx.fillRect(s * (canvas.width / 100), (100 - v) * (canvas.height / 100), canvas.width / 100, canvas.height / 100);
                }
            }
        }

        if (hueRef.current) {
            const canvas = hueRef.current;
            const ctx = canvas.getContext('2d');

            // Draw hue gradient
            for (let h = 0; h < 360; h++) {
                ctx.fillStyle = `hsl(${h}, 100%, 50%)`;
                ctx.fillRect(h * (canvas.width / 360), 0, canvas.width / 360, canvas.height);
            }
        }
    }, [colorHex]);

    // Helper function for canvas - HSV to RGB conversion
    const hsvToRgb = (h, s, v) => {
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

        // Convert to 0-255 range
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];
    };

    // Handle hex input change
    const handleHexChange = (e) => {
        const newHex = e.target.value;

        // Validate hex format
        if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
            setColorHex(newHex);
            updateColorRange(newHex);
        } else if (/^[0-9A-Fa-f]{6}$/.test(newHex)) {
            // Add # if missing
            const fullHex = `#${newHex}`;
            setColorHex(fullHex);
            updateColorRange(fullHex);
        } else {
            // Just update the input for now
            setColorHex(newHex);
        }
    };

    // Handle hex input blur (to ensure valid hex)
    const handleHexBlur = () => {
        // Ensure valid hex on blur
        if (!/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
            // Reset to a valid hex
            setColorHex('#00ff00');
            updateColorRange('#00ff00');
        }
    };

    // Handle tolerance change
    const handleToleranceChange = (e) => {
        const newTolerance = parseInt(e.target.value, 10);
        setTolerance(newTolerance);
        updateColorRange(colorHex, newTolerance);
    };

    // Update HSV range based on hex and tolerance
    const updateColorRange = (hex, tol = tolerance) => {
        const hsv = hexToHsv(hex);

        // Calculate tolerance for each component
        // H gets more tolerance since it's the most important for color detection
        const hTolerance = Math.round((tol / 100) * 30); // Up to 30 degrees of tolerance
        const sTolerance = Math.round((tol / 100) * 100); // Up to 100 saturation points
        const vTolerance = Math.round((tol / 100) * 100); // Up to 100 value points

        const range = createHsvRange(hsv, { h: hTolerance, s: sTolerance, v: vTolerance });

        // Call the parent callback with new HSV range
        onColorChange(range.lower, range.upper);
    };

    return (
        <div className="color-picker">
            <div className="color-preview-container mb-3">
                <div className="color-preview" style={{ backgroundColor: colorHex }}></div>
            </div>

            <Row className="mb-3">
                <Col>
                    <InputGroup>
                        <InputGroup.Text><Edit2 size={16} /></InputGroup.Text>
                        <Form.Control
                            type="text"
                            value={colorHex}
                            onChange={handleHexChange}
                            onBlur={handleHexBlur}
                            placeholder="#00ff00"
                            maxLength={7}
                        />
                    </InputGroup>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col>
                    <Form.Label>Color Tolerance: {tolerance}%</Form.Label>
                    <Form.Range
                        value={tolerance}
                        onChange={handleToleranceChange}
                        min={5}
                        max={50}
                    />
                </Col>
            </Row>

            <div className="color-gradient-container mb-3" style={{ display: 'none' }}>
                <canvas
                    ref={gradientRef}
                    width="200"
                    height="200"
                    className="color-gradient"
                />

                <canvas
                    ref={hueRef}
                    width="200"
                    height="20"
                    className="hue-gradient mt-2"
                />
            </div>

            <Button
                variant="primary"
                className="mb-3 w-100 d-flex align-items-center justify-content-center"
                onClick={onSampleColor}
                disabled={loading}
            >
                <Camera size={16} className="mr-2" />
                Sample Color from Screen
            </Button>

            <style jsx="true">{`
        .color-preview-container {
          width: 100%;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #dee2e6;
        }
        
        .color-preview {
          width: 100%;
          height: 100%;
        }
        
        .color-gradient-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .color-gradient {
          width: 100%;
          height: 200px;
          border-radius: 8px;
          cursor: crosshair;
          border: 1px solid #dee2e6;
        }
        
        .hue-gradient {
          width: 100%;
          height: 20px;
          border-radius: 4px;
          cursor: crosshair;
          border: 1px solid #dee2e6;
        }
      `}</style>
        </div>
    );
};

export default ColorPicker;