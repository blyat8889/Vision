const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create Express app
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store configuration
const configPath = path.join(__dirname, 'config.json');
let systemConfig = {
    sensitivity: 5,
    smoothingFactor: 3,
    detectionThreshold: 0.65,
    calibration: {
        hsvLower: [0, 0, 0],
        hsvUpper: [255, 255, 255]
    },
    enabledModules: {
        backgroundSubtraction: true,
        movementPrediction: true,
        mouseSmoothing: true
    }
};

// Load configuration on startup
if (fs.existsSync(configPath)) {
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        systemConfig = JSON.parse(configData);
        console.log('Configuration loaded successfully');
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

// Save configuration
const saveConfig = () => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(systemConfig, null, 2));
        console.log('Configuration saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving configuration:', error);
        return false;
    }
};

// API Routes
app.get('/api/config', (req, res) => {
    res.json(systemConfig);
});

// Add this near your other route definitions
app.get('/', (req, res) => {
    res.send('Computer Vision Input Adjustment System Server');
    // Alternatively, you could serve your frontend from here:
    // res.sendFile(path.join(__dirname, '../dashboardui/build', 'index.html'));
});

app.post('/api/config', (req, res) => {
    const newConfig = req.body;

    // Validate configuration (basic validation)
    if (typeof newConfig.sensitivity !== 'number' ||
        typeof newConfig.smoothingFactor !== 'number' ||
        typeof newConfig.detectionThreshold !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid configuration parameters' });
    }

    // Update configuration
    systemConfig = { ...systemConfig, ...newConfig };

    // Save configuration
    const saved = saveConfig();

    if (saved) {
        // Apply new configuration to running modules
        applyConfiguration();
        res.json({ success: true, config: systemConfig });
    } else {
        res.status(500).json({ success: false, message: 'Failed to save configuration' });
    }
});

app.post('/api/calibration/hsv', (req, res) => {
    const { hsvLower, hsvUpper } = req.body;

    // Validate HSV values
    if (!Array.isArray(hsvLower) || !Array.isArray(hsvUpper) ||
        hsvLower.length !== 3 || hsvUpper.length !== 3) {
        return res.status(400).json({ success: false, message: 'Invalid HSV parameters' });
    }

    // Update HSV calibration
    systemConfig.calibration.hsvLower = hsvLower;
    systemConfig.calibration.hsvUpper = hsvUpper;

    // Save configuration
    const saved = saveConfig();

    if (saved) {
        // Apply new HSV values to the detection module
        applyHSVCalibration();
        res.json({ success: true, calibration: systemConfig.calibration });
    } else {
        res.status(500).json({ success: false, message: 'Failed to save HSV calibration' });
    }
});

app.get('/api/system/status', (req, res) => {
    // Check if Python modules are running
    checkModulesStatus((status) => {
        res.json(status);
    });
});

app.post('/api/system/start', (req, res) => {
    startSystem((success, message) => {
        if (success) {
            res.json({ success: true, message: 'System started successfully' });
        } else {
            res.status(500).json({ success: false, message });
        }
    });
});

app.post('/api/system/stop', (req, res) => {
    stopSystem((success, message) => {
        if (success) {
            res.json({ success: true, message: 'System stopped successfully' });
        } else {
            res.status(500).json({ success: false, message });
        }
    });
});

app.get('/api/system/logs', (req, res) => {
    const logPath = path.join(__dirname, 'system.log');

    if (fs.existsSync(logPath)) {
        try {
            // Read the last 100 lines of log file
            const logData = fs.readFileSync(logPath, 'utf8');
            const logLines = logData.split('\n').slice(-100).join('\n');
            res.json({ success: true, logs: logLines });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to read log file' });
        }
    } else {
        res.json({ success: true, logs: 'No logs available' });
    }
});

// Helper functions
function checkModulesStatus(callback) {
    const platform = os.platform();
    let command = '';

    if (platform === 'win32') {
        command = 'tasklist';
    } else {
        command = 'ps aux';
    }

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error checking processes: ${error}`);
            callback({
                success: false,
                detectionModule: false,
                mouseModule: false,
                driverLoaded: false
            });
            return;
        }

        const detectionRunning = stdout.includes('screen_analyzer.py') || stdout.includes('python') && stdout.includes('DetectionModule');
        const mouseRunning = stdout.includes('vision_mouse_integration.py') || stdout.includes('python') && stdout.includes('MouseModule');

        // Check if driver is loaded
        checkDriverStatus((driverLoaded) => {
            callback({
                success: true,
                detectionModule: detectionRunning,
                mouseModule: mouseRunning,
                driverLoaded: driverLoaded
            });
        });
    });
}

function checkDriverStatus(callback) {
    const platform = os.platform();

    if (platform === 'win32') {
        exec('driverquery', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error checking driver: ${error}`);
                callback(false);
                return;
            }

            const driverLoaded = stdout.includes('HidFilterDriver');
            callback(driverLoaded);
        });
    } else {
        // For non-Windows platforms, we'll assume the driver isn't applicable
        callback(false);
    }
}

function startSystem(callback) {
    const pythonPath = 'python'; // Adjust based on your system
    const detectionScript = path.join(__dirname, '..', 'DetectionModule', 'screen_analyzer.py');
    const mouseScript = path.join(__dirname, '..', 'MouseModule', 'vision_mouse_integration.py');

    // Start detection module
    const detectionProcess = exec(`${pythonPath} "${detectionScript}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error starting detection module: ${error}`);
            logMessage(`Detection module start error: ${error}`);
        }
    });

    // Start mouse module
    const mouseProcess = exec(`${pythonPath} "${mouseScript}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error starting mouse module: ${error}`);
            logMessage(`Mouse module start error: ${error}`);
            callback(false, 'Failed to start mouse module');
            return;
        }
    });

    // Wait a bit to check if processes started successfully
    setTimeout(() => {
        checkModulesStatus((status) => {
            if (status.detectionModule && status.mouseModule) {
                logMessage('System started successfully');
                callback(true);
            } else {
                logMessage('Failed to start system components');
                callback(false, 'Failed to start system components');
            }
        });
    }, 2000);
}

function stopSystem(callback) {
    const platform = os.platform();
    let command = '';

    if (platform === 'win32') {
        // Windows commands
        exec('taskkill /F /IM python.exe /FI "WINDOWTITLE eq Detection*"', () => { });
        exec('taskkill /F /IM python.exe /FI "WINDOWTITLE eq Mouse*"', () => { });
    } else {
        // Unix-based commands
        exec('pkill -f "python.*screen_analyzer.py"', () => { });
        exec('pkill -f "python.*vision_mouse_integration.py"', () => { });
    }

    // Wait a bit to check if processes were terminated
    setTimeout(() => {
        checkModulesStatus((status) => {
            if (!status.detectionModule && !status.mouseModule) {
                logMessage('System stopped successfully');
                callback(true);
            } else {
                logMessage('Failed to stop system components');
                callback(false, 'Failed to stop system components');
            }
        });
    }, 1000);
}

function applyConfiguration() {
    // This would typically involve IPC with the Python modules
    // For now, we'll just log the action
    logMessage(`Applied new configuration: sensitivity=${systemConfig.sensitivity}, smoothingFactor=${systemConfig.smoothingFactor}`);

    // In a real implementation, you might write the config to a file that the Python modules read
    // Or implement a more sophisticated IPC mechanism
}

function applyHSVCalibration() {
    // Similar to applyConfiguration, this would involve IPC with the Python detection module
    logMessage(`Applied new HSV calibration: Lower=${systemConfig.calibration.hsvLower}, Upper=${systemConfig.calibration.hsvUpper}`);
}

function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // Append to log file
    fs.appendFile(path.join(__dirname, 'system.log'), logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });

    console.log(message);
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    logMessage(`Server started on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    logMessage('Server shutting down');

    // Stop all system components
    stopSystem(() => {
        process.exit(0);
    });
});