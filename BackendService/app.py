#!/usr/bin/env python
"""
Unified Flask backend for the Computer Vision Input Adjustment System
- Multi-color detection & preview
- API endpoints for detection, mouse & driver settings, logs, and presets
- Performance monitoring and API key security
- WebSocket support for real-time status updates
- Serves static files for the React frontend
"""

import os
import sys
import json
import time
import logging
import threading
import subprocess
import psutil
from datetime import datetime
import cv2
import numpy as np
import pyautogui
import ctypes
import tempfile
from flask import Flask, request, jsonify, send_from_directory, send_file, Response
from flask_cors import CORS
from flask_socketio import SocketIO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Create Flask app and SocketIO instance
app = Flask(__name__, static_folder='../frontend/build')
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")

# API Key for security (adjust the secret key)
API_KEY = "your-secret-key"

# Global state variables
detection_active = False
mouse_filter_active = False
driver_active = False
current_logs = []
max_logs = 100

# Default configuration values
DEFAULT_DETECTION_SETTINGS = {
    'active': False,
    'hsvLower': [40, 50, 50],      # Legacy single-color default (not used if colorTargets defined)
    'hsvUpper': [80, 255, 255],
    'colorTargets': [
        {
            'id': 1,
            'name': 'Default Green',
            'hexColor': '#00ff00',
            'hsvLower': [40, 50, 50],
            'hsvUpper': [80, 255, 255],
            'tolerance': 25,
            'active': True
        }
    ],
    'noiseReduction': 5,
    'adaptiveMode': False,
    'roiEnabled': False,
    'roi': {'x': 0, 'y': 0, 'width': 800, 'height': 600},
    'minArea': 100,
    'fps': 30
}

DEFAULT_MOUSE_SETTINGS = {
    'active': False,
    'smoothingFactor': 50,
    'filterType': 'adaptive',
    'responseSpeed': 50,
    'filteringStrength': 50,
    'movementType': 'hybrid',
    'humanizeEnabled': True,
    'humanizeFactor': 20,
    'predictionEnabled': False,
    'predictionFrames': 5
}

DEFAULT_DRIVER_SETTINGS = {
    'active': False,
    'smoothingFactor': 50,
    'responseSpeed': 50,
    'filteringStrength': 50
}

# Paths for configuration files
CONFIG_DIR = 'config'
os.makedirs(CONFIG_DIR, exist_ok=True)
DETECTION_CONFIG_PATH = os.path.join(CONFIG_DIR, 'detection_settings.json')
MOUSE_CONFIG_PATH = os.path.join(CONFIG_DIR, 'mouse_settings.json')
DRIVER_CONFIG_PATH = os.path.join(CONFIG_DIR, 'driver_settings.json')

def load_config(config_path, default_config):
    """Load configuration from file or create with defaults if it doesn't exist."""
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        else:
            with open(config_path, 'w') as f:
                json.dump(default_config, f, indent=4)
            return default_config
    except Exception as e:
        logger.error(f"Error loading configuration from {config_path}: {e}")
        return default_config

def save_config(config_path, config):
    """Save configuration to file."""
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=4)
        return True
    except Exception as e:
        logger.error(f"Error saving configuration to {config_path}: {e}")
        return False

# Load configurations
detection_settings = load_config(DETECTION_CONFIG_PATH, DEFAULT_DETECTION_SETTINGS)
mouse_settings = load_config(MOUSE_CONFIG_PATH, DEFAULT_MOUSE_SETTINGS)
driver_settings = load_config(DRIVER_CONFIG_PATH, DEFAULT_DRIVER_SETTINGS)

def add_log(level, module, message):
    """Add a log entry to the log history and file logger."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = {
        'timestamp': timestamp,
        'level': level,
        'module': module,
        'message': message
    }
    current_logs.append(log_entry)
    if len(current_logs) > max_logs:
        current_logs.pop(0)
    if level == 'info':
        logger.info(f"{module}: {message}")
    elif level == 'warning':
        logger.warning(f"{module}: {message}")
    elif level == 'error':
        logger.error(f"{module}: {message}")
    elif level == 'debug':
        logger.debug(f"{module}: {message}")

# Background thread for system performance monitoring
def monitor_system_performance():
    global detection_active, mouse_filter_active, driver_active
    while True:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory_percent = psutil.virtual_memory().percent
        if cpu_percent > 80:
            add_log('warning', 'System', f'High CPU usage: {cpu_percent}%')
        if memory_percent > 80:
            add_log('warning', 'System', f'High memory usage: {memory_percent}%')
        # Check driver status (for Windows service example)
        try:
            driver_running = False
            for service in psutil.win_service_iter():
                if service.name() == 'HidFilterDriver':
                    driver_running = True
                    break
            if driver_running != driver_active:
                driver_active = driver_running
                add_log('info', 'Driver', f'Driver status changed to {driver_active}')
        except Exception as e:
            add_log('error', 'System', f'Error checking driver status: {e}')
        time.sleep(5)

monitor_thread = threading.Thread(target=monitor_system_performance, daemon=True)
monitor_thread.start()

# --- API Key Security ---
@app.before_request
def verify_api_key():
    """Require a valid API key for all endpoints except a few public ones."""
    public_paths = ["/", "/api/status", "/api/logs", "/socket.io/"]
    if any(request.path.startswith(p) for p in public_paths):
        return
    api_key = request.headers.get("X-API-KEY")
    if api_key != API_KEY:
        add_log('warning', 'Security', 'Unauthorized API access attempt')
        return jsonify({"error": "Unauthorized"}), 403

# --- API Endpoints ---

@app.route('/api/status', methods=['GET'])
def get_system_status():
    """Get the current system status along with performance metrics."""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.5)
        memory_percent = psutil.virtual_memory().percent
        current_fps = detection_settings['fps'] if detection_active else 0
        estimated_latency = 15.0  # Placeholder latency in milliseconds
        status = {
            'detectionActive': detection_active,
            'mouseFilterActive': mouse_filter_active,
            'driverActive': driver_active,
            'fps': current_fps,
            'cpuUsage': cpu_percent,
            'memoryUsage': memory_percent,
            'latency': estimated_latency
        }
        return jsonify(status)
    except Exception as e:
        add_log('error', 'API', f'Error getting system status: {e}')
        return jsonify({'error': str(e)}), 500

# --- Detection Settings ---
@app.route('/api/detection/settings', methods=['GET'])
def get_detection_settings():
    return jsonify(detection_settings)

@app.route('/api/detection/settings', methods=['POST'])
def update_detection_settings():
    global detection_settings
    try:
        new_settings = request.json
        detection_settings.update(new_settings)
        if save_config(DETECTION_CONFIG_PATH, detection_settings):
            add_log('info', 'Detection', 'Detection settings updated')
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to save detection settings'}), 500
    except Exception as e:
        add_log('error', 'API', f'Error updating detection settings: {e}')
        return jsonify({'error': str(e)}), 500

# --- Detection Control ---
@app.route('/api/detection/start', methods=['POST'])
def start_detection():
    global detection_active
    try:
        detection_active = True
        detection_settings['active'] = True
        save_config(DETECTION_CONFIG_PATH, detection_settings)
        add_log('info', 'Detection', 'Detection started')
        return jsonify({'success': True})
    except Exception as e:
        add_log('error', 'API', f'Error starting detection: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/detection/stop', methods=['POST'])
def stop_detection():
    global detection_active
    try:
        detection_active = False
        detection_settings['active'] = False
        save_config(DETECTION_CONFIG_PATH, detection_settings)
        add_log('info', 'Detection', 'Detection stopped')
        return jsonify({'success': True})
    except Exception as e:
        add_log('error', 'API', f'Error stopping detection: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/detection/sample', methods=['POST'])
def sample_color():
    """Sample a color from the screen center."""
    try:
        screenshot = pyautogui.screenshot()
        screenshot_np = np.array(screenshot)
        screenshot_bgr = cv2.cvtColor(screenshot_np, cv2.COLOR_RGB2BGR)
        height, width = screenshot_bgr.shape[:2]
        center_x, center_y = width // 2, height // 2
        sample_size = 20
        x1 = max(0, center_x - sample_size // 2)
        y1 = max(0, center_y - sample_size // 2)
        x2 = min(width, center_x + sample_size // 2)
        y2 = min(height, center_y + sample_size // 2)
        region = screenshot_bgr[y1:y2, x1:x2]
        hsv_region = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
        avg_hsv = np.mean(hsv_region, axis=(0, 1)).astype(int)
        h_tolerance, s_tolerance, v_tolerance = 10, 50, 50
        h_lower = max(0, avg_hsv[0] - h_tolerance)
        h_upper = min(179, avg_hsv[0] + h_tolerance)
        s_lower = max(0, avg_hsv[1] - s_tolerance)
        s_upper = min(255, avg_hsv[1] + s_tolerance)
        v_lower = max(0, avg_hsv[2] - v_tolerance)
        v_upper = min(255, avg_hsv[2] + v_tolerance)
        hsv_lower = [int(h_lower), int(s_lower), int(v_lower)]
        hsv_upper = [int(h_upper), int(s_upper), int(v_upper)]
        add_log('info', 'Detection', f'Sampled color HSV: {avg_hsv.tolist()}')
        return jsonify({
            'success': True,
            'hsvLower': hsv_lower,
            'hsvUpper': hsv_upper
        })
    except Exception as e:
        add_log('error', 'API', f'Error sampling color: {e}')
        return jsonify({'error': str(e)}), 500

# --- Mouse Settings ---
@app.route('/api/mouse/settings', methods=['GET'])
def get_mouse_settings():
    return jsonify(mouse_settings)

@app.route('/api/mouse/settings', methods=['POST'])
def update_mouse_settings():
    global mouse_settings, mouse_filter_active
    try:
        new_settings = request.json
        mouse_settings.update(new_settings)
        mouse_filter_active = mouse_settings.get('active', False)
        if save_config(MOUSE_CONFIG_PATH, mouse_settings):
            add_log('info', 'Mouse', 'Mouse settings updated')
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to save mouse settings'}), 500
    except Exception as e:
        add_log('error', 'API', f'Error updating mouse settings: {e}')
        return jsonify({'error': str(e)}), 500

# --- Driver Settings ---
@app.route('/api/driver/settings', methods=['GET'])
def get_driver_settings():
    return jsonify(driver_settings)

@app.route('/api/driver/settings', methods=['POST'])
def update_driver_settings():
    global driver_settings
    try:
        new_settings = request.json
        driver_settings.update(new_settings)
        if save_config(DRIVER_CONFIG_PATH, driver_settings):
            add_log('info', 'Driver', 'Driver settings updated')
            # Simulate driver communication here if needed
            add_log('info', 'Driver', 'Driver settings applied')
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to save driver settings'}), 500
    except Exception as e:
        add_log('error', 'API', f'Error updating driver settings: {e}')
        return jsonify({'error': str(e)}), 500

# --- Logs ---
@app.route('/api/logs', methods=['GET'])
def get_logs():
    level = request.args.get('level')
    module = request.args.get('module')
    limit = request.args.get('limit', default=50, type=int)
    filtered_logs = current_logs
    if level:
        filtered_logs = [log for log in filtered_logs if log['level'] == level]
    if module:
        filtered_logs = [log for log in filtered_logs if log['module'] == module]
    filtered_logs = filtered_logs[-limit:]
    return jsonify(filtered_logs)

@app.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    global current_logs
    current_logs = []
    add_log('info', 'System', 'Logs cleared')
    return jsonify({'success': True})

# --- Presets ---
@app.route('/api/presets', methods=['GET'])
def get_presets():
    presets = [
        {
            'id': 'precision',
            'name': 'Precision Mode',
            'description': 'High smoothing, slow response for precise targeting',
            'detection': {
                'noiseReduction': 8,
                'minArea': 50,
                'adaptiveMode': True
            },
            'mouse': {
                'smoothingFactor': 80,
                'filterType': 'exponential',
                'responseSpeed': 30,
                'filteringStrength': 70,
                'movementType': 'smoothed',
                'humanizeEnabled': False
            },
            'driver': {
                'active': True,
                'smoothingFactor': 80,
                'responseSpeed': 30,
                'filteringStrength': 70
            }
        },
        {
            'id': 'balanced',
            'name': 'Balanced Mode',
            'description': 'Medium smoothing and response for general use',
            'detection': {
                'noiseReduction': 5,
                'minArea': 100,
                'adaptiveMode': True
            },
            'mouse': {
                'smoothingFactor': 50,
                'filterType': 'adaptive',
                'responseSpeed': 50,
                'filteringStrength': 50,
                'movementType': 'hybrid',
                'humanizeEnabled': True
            },
            'driver': {
                'active': True,
                'smoothingFactor': 50,
                'responseSpeed': 50,
                'filteringStrength': 50
            }
        },
        {
            'id': 'fast',
            'name': 'Fast Response Mode',
            'description': 'Low smoothing, fast response for quick movements',
            'detection': {
                'noiseReduction': 3,
                'minArea': 150,
                'adaptiveMode': False
            },
            'mouse': {
                'smoothingFactor': 30,
                'filterType': 'moving_avg',
                'responseSpeed': 80,
                'filteringStrength': 40,
                'movementType': 'human',
                'humanizeEnabled': True
            },
            'driver': {
                'active': True,
                'smoothingFactor': 30,
                'responseSpeed': 80,
                'filteringStrength': 40
            }
        }
    ]
    return jsonify(presets)

@app.route('/api/presets/<preset_id>/apply', methods=['POST'])
def apply_preset(preset_id):
    global detection_settings, mouse_settings, driver_settings, mouse_filter_active
    presets_response = get_presets()
    presets = json.loads(presets_response.data)
    preset = next((p for p in presets if p['id'] == preset_id), None)
    if not preset:
        return jsonify({'error': f'Preset {preset_id} not found'}), 404
    try:
        if 'detection' in preset:
            detection_settings.update(preset['detection'])
            save_config(DETECTION_CONFIG_PATH, detection_settings)
        if 'mouse' in preset:
            mouse_settings.update(preset['mouse'])
            mouse_filter_active = mouse_settings.get('active', False)
            save_config(MOUSE_CONFIG_PATH, mouse_settings)
        if 'driver' in preset:
            driver_settings.update(preset['driver'])
            save_config(DRIVER_CONFIG_PATH, driver_settings)
        add_log('info', 'System', f'Applied preset profile: {preset["name"]}')
        return jsonify({'success': True, 'message': f'Applied preset: {preset["name"]}'})
    except Exception as e:
        add_log('error', 'API', f'Error applying preset {preset_id}: {e}')
        return jsonify({'error': str(e)}), 500

# --- Preview Endpoint (Multi-Color Detection) ---
@app.route('/api/preview', methods=['GET'])
def get_preview_image():
    """Get a preview image with multi-color detection overlays."""
    try:
        screenshot = pyautogui.screenshot()
        screenshot_np = np.array(screenshot)
        if detection_active:
            screenshot_bgr = cv2.cvtColor(screenshot_np, cv2.COLOR_RGB2BGR)
            result = screenshot_bgr.copy()
            active_targets = [t for t in detection_settings.get('colorTargets', []) if t.get('active', True)]
            if not active_targets:
                active_targets = [{
                    'id': 1,
                    'name': 'Default',
                    'hsvLower': detection_settings['hsvLower'],
                    'hsvUpper': detection_settings['hsvUpper'],
                    'active': True
                }]
            for target in active_targets:
                target_name = target.get('name', 'Color')
                lower = np.array(target['hsvLower'])
                upper = np.array(target['hsvUpper'])
                hsv = cv2.cvtColor(screenshot_bgr, cv2.COLOR_BGR2HSV)
                mask = cv2.inRange(hsv, lower, upper)
                kernel_size = detection_settings['noiseReduction']
                if kernel_size > 0:
                    kernel = np.ones((kernel_size, kernel_size), np.uint8)
                    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
                    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                contours = [c for c in contours if cv2.contourArea(c) > detection_settings['minArea']]
                # Generate a visualization color based on target ID
                target_id = int(target.get('id', 1))
                colors = [(0, 255, 0), (0, 0, 255), (255, 0, 0), (0, 255, 255), (255, 0, 255), (255, 255, 0)]
                viz_color = colors[(target_id - 1) % len(colors)]
                cv2.drawContours(result, contours, -1, viz_color, 2)
                for contour in contours:
                    M = cv2.moments(contour)
                    if M["m00"] > 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        cv2.circle(result, (cx, cy), 5, viz_color, -1)
                        cv2.line(result, (cx - 10, cy), (cx + 10, cy), viz_color, 2)
                        cv2.line(result, (cx, cy - 10), (cx, cy + 10), viz_color, 2)
                        cv2.putText(result, target_name, (cx + 10, cy - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, viz_color, 1)
            result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
            from PIL import Image
            preview_image = Image.fromarray(result_rgb)
        else:
            preview_image = pyautogui.screenshot()
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        preview_image.save(temp_file.name)
        return send_file(temp_file.name, mimetype='image/png')
    except Exception as e:
        add_log('error', 'API', f'Error generating preview: {e}')
        return jsonify({'error': str(e)}), 500

# --- Optional: Camera Stream Endpoint (MJPEG Streaming) ---
@app.route('/api/camera/stream')
def camera_stream():
    """Stream continuous preview frames as MJPEG."""
    def generate_frames():
        while True:
            try:
                screenshot = pyautogui.screenshot()
                screenshot_np = np.array(screenshot)
                ret, buffer = cv2.imencode('.jpg', cv2.cvtColor(screenshot_np, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(1.0 / detection_settings.get('fps', 30))
            except Exception as e:
                add_log('error', 'CameraStream', f'Error streaming frame: {e}')
                break
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

# --- WebSocket Events ---
@socketio.on('connect')
def handle_connect():
    add_log('info', 'WebSocket', 'Client connected')

@socketio.on('request_status')
def send_status():
    status = {
        'detectionActive': detection_active,
        'mouseFilterActive': mouse_filter_active,
        'driverActive': driver_active,
        'fps': detection_settings['fps']
    }
    socketio.emit('status_update', status)

# --- Serve React Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# --- Admin Check ---
def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

if not is_admin():
    add_log('warning', 'System', 'Not running as administrator. Driver control may not work properly.')

# --- Main Entry Point ---
if __name__ == '__main__':
    add_log('info', 'System', 'Backend server starting')
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
