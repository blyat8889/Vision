# DetectionModule.py - Improved integration with the frontend

import cv2
import numpy as np
import logging
import time
import threading
import json
import os
from background_subtraction import apply_background_subtraction
from hsv_calibrator import HSVCalibrator

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("detection.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("DetectionModule")

class ColorDetector:
    """Handles detection of specified colors in video frames"""
    
    def __init__(self):
        self.active = False
        self.fps_limit = 60
        self.noise_reduction = 5
        self.min_area = 10
        self.adaptive_mode = True
        self.color_targets = []
        self.last_frame_time = 0
        self.frame_interval = 1.0 / self.fps_limit
        self.hsv_calibrator = HSVCalibrator()
        self.detection_results = {
            "x_percent": 0,
            "y_percent": 0,
            "confidence": 0,
            "area": 0,
            "timestamp": 0
        }
        self._lock = threading.Lock()
        
        # Add default color target (green)
        self.add_color_target("Default Color", "#00FF00")
        
        logger.info("ColorDetector initialized")
        
    def start(self):
        """Start the detection process"""
        if not self.active:
            self.active = True
            logger.info("Color detection started")
            return True
        return False
        
    def stop(self):
        """Stop the detection process"""
        if self.active:
            self.active = False
            logger.info("Color detection stopped")
            return True
        return False
    
    def set_fps_limit(self, fps):
        """Set the frames per second limit"""
        if 1 <= fps <= 120:
            self.fps_limit = fps
            self.frame_interval = 1.0 / self.fps_limit
            logger.info(f"FPS limit set to {fps}")
            return True
        return False
    
    def set_noise_reduction(self, value):
        """Set noise reduction level (blur kernel size)"""
        if 0 <= value <= 20:
            self.noise_reduction = value
            logger.info(f"Noise reduction set to {value}")
            return True
        return False
    
    def set_min_area(self, value):
        """Set minimum contour area to detect"""
        if 1 <= value <= 100:
            self.min_area = value
            logger.info(f"Minimum area set to {value}")
            return True
        return False
    
    def set_adaptive_mode(self, enabled):
        """Enable or disable adaptive lighting mode"""
        self.adaptive_mode = bool(enabled)
        logger.info(f"Adaptive mode {'enabled' if enabled else 'disabled'}")
        return True
    
    def add_color_target(self, name, hex_color):
        """Add a color target to detect"""
        try:
            # Convert hex color to RGB
            hex_color = hex_color.lstrip('#')
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            
            # Convert RGB to HSV
            hsv = self.hsv_calibrator.rgb_to_hsv(*rgb)
            
            # Create color target with default tolerance
            color_target = {
                "id": int(time.time() * 1000),  # Unique ID
                "name": name,
                "hex_code": f"#{hex_color}",
                "rgb": rgb,
                "hsv": hsv,
                "hsv_lower": self.hsv_calibrator.get_hsv_lower(hsv, tolerance=10),
                "hsv_upper": self.hsv_calibrator.get_hsv_upper(hsv, tolerance=10),
                "tolerance": 10
            }
            
            self.color_targets.append(color_target)
            logger.info(f"Added color target: {name} ({hex_color})")
            return color_target["id"]
        except Exception as e:
            logger.error(f"Error adding color target: {str(e)}")
            return None
    
    def update_color_target(self, target_id, **kwargs):
        """Update properties of a color target"""
        try:
            # Find the target by ID
            target = next((t for t in self.color_targets if t["id"] == target_id), None)
            if not target:
                logger.warning(f"Color target with ID {target_id} not found")
                return False
            
            # Update provided properties
            for key, value in kwargs.items():
                if key in target:
                    target[key] = value
            
            # If hex_code was updated, recalculate RGB and HSV
            if "hex_code" in kwargs:
                hex_color = kwargs["hex_code"].lstrip('#')
                target["rgb"] = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                target["hsv"] = self.hsv_calibrator.rgb_to_hsv(*target["rgb"])
            
            # If tolerance was updated or HSV changed, recalculate bounds
            if "tolerance" in kwargs or "hsv" in kwargs:
                target["hsv_lower"] = self.hsv_calibrator.get_hsv_lower(
                    target["hsv"], tolerance=target["tolerance"])
                target["hsv_upper"] = self.hsv_calibrator.get_hsv_upper(
                    target["hsv"], tolerance=target["tolerance"])
            
            logger.info(f"Updated color target: {target['name']}")
            return True
        except Exception as e:
            logger.error(f"Error updating color target: {str(e)}")
            return False
    
    def remove_color_target(self, target_id):
        """Remove a color target by ID"""
        initial_count = len(self.color_targets)
        self.color_targets = [t for t in self.color_targets if t["id"] != target_id]
        if len(self.color_targets) < initial_count:
            logger.info(f"Removed color target with ID {target_id}")
            return True
        logger.warning(f"Color target with ID {target_id} not found")
        return False
    
    def sample_color_from_frame(self, frame, x, y):
        """Sample a color from the given coordinates in a frame"""
        try:
            # Ensure coordinates are within frame bounds
            height, width = frame.shape[:2]
            if 0 <= x < width and 0 <= y < height:
                # Extract the RGB color at the specified point
                b, g, r = frame[y, x]
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                
                # Create a new color target
                name = f"Sampled Color #{len(self.color_targets) + 1}"
                target_id = self.add_color_target(name, hex_color)
                
                logger.info(f"Sampled color at ({x}, {y}): {hex_color}")
                return {
                    "id": target_id,
                    "name": name,
                    "hex_code": hex_color
                }
            else:
                logger.warning(f"Coordinates ({x}, {y}) out of bounds")
                return None
        except Exception as e:
            logger.error(f"Error sampling color: {str(e)}")
            return None
    
    def process_frame(self, frame):
        """Process a video frame to detect colors"""
        # Rate limiting based on FPS setting
        current_time = time.time()
        if current_time - self.last_frame_time < self.frame_interval:
            return None
        
        self.last_frame_time = current_time
        
        try:
            with self._lock:
                # Skip if no color targets or detection is inactive
                if not self.active or not self.color_targets:
                    return None
                
                # Apply noise reduction if enabled
                if self.noise_reduction > 0:
                    # Must be odd number for Gaussian blur
                    kernel_size = self.noise_reduction * 2 + 1
                    processed = cv2.GaussianBlur(frame, (kernel_size, kernel_size), 0)
                else:
                    processed = frame.copy()
                
                # Convert to HSV color space
                hsv_frame = cv2.cvtColor(processed, cv2.COLOR_BGR2HSV)
                
                # Get the currently selected color target
                selected_target = next((t for t in self.color_targets), None)
                if not selected_target:
                    return None
                
                # Create mask for the selected color
                mask = cv2.inRange(
                    hsv_frame, 
                    np.array(selected_target["hsv_lower"]), 
                    np.array(selected_target["hsv_upper"])
                )
                
                # Find contours in the mask
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # Process detection results
                if contours:
                    # Find the largest contour by area
                    largest_contour = max(contours, key=cv2.contourArea)
                    area = cv2.contourArea(largest_contour)
                    
                    # Skip if area is too small
                    if area < self.min_area:
                        return None
                    
                    # Get bounding rectangle and center point
                    x, y, w, h = cv2.boundingRect(largest_contour)
                    center_x = x + w // 2
                    center_y = y + h // 2
                    
                    # Calculate position as percentages of frame dimensions
                    height, width = frame.shape[:2]
                    x_percent = (center_x / width) * 100
                    y_percent = (center_y / height) * 100
                    
                    # Calculate confidence based on area relative to frame size
                    max_possible_area = width * height
                    confidence = min(100, (area / max_possible_area) * 100 * 10)  # Scale for better visualization
                    
                    # Update detection results
                    self.detection_results = {
                        "x_percent": round(x_percent, 1),
                        "y_percent": round(y_percent, 1),
                        "confidence": round(confidence, 1),
                        "area": int(area),
                        "timestamp": current_time
                    }
                    
                    # Draw detection visualization on frame if requested
                    visualization = frame.copy()
                    cv2.drawContours(visualization, [largest_contour], -1, (0, 255, 0), 2)
                    cv2.rectangle(visualization, (x, y), (x + w, y + h), (255, 0, 0), 2)
                    cv2.circle(visualization, (center_x, center_y), 5, (0, 0, 255), -1)
                    
                    # Add text with information
                    info_text = f"Position: {x_percent:.1f}%, {y_percent:.1f}%"
                    cv2.putText(visualization, info_text, (10, 30), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    
                    confidence_text = f"Confidence: {confidence:.1f}%"
                    cv2.putText(visualization, confidence_text, (10, 60), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    
                    return {
                        "visualization": visualization,
                        "mask": cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR),
                        "results": self.detection_results
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Error processing frame: {str(e)}")
            return None
    
    def get_detection_results(self):
        """Get the latest detection results"""
        with self._lock:
            return self.detection_results.copy()
    
    def save_settings(self, filepath="detection_settings.json"):
        """Save current settings to file"""
        try:
            # Create settings dictionary
            settings = {
                "fps_limit": self.fps_limit,
                "noise_reduction": self.noise_reduction,
                "min_area": self.min_area,
                "adaptive_mode": self.adaptive_mode,
                "color_targets": [
                    {
                        "id": t["id"],
                        "name": t["name"],
                        "hex_code": t["hex_code"],
                        "tolerance": t["tolerance"]
                    } for t in self.color_targets
                ]
            }
            
            # Save to file
            with open(filepath, 'w') as f:
                json.dump(settings, f, indent=4)
            
            logger.info(f"Settings saved to {filepath}")
            return True
        except Exception as e:
            logger.error(f"Error saving settings: {str(e)}")
            return False
    
    def load_settings(self, filepath="detection_settings.json"):
        """Load settings from file"""
        try:
            if not os.path.exists(filepath):
                logger.warning(f"Settings file {filepath} not found")
                return False
            
            # Load from file
            with open(filepath, 'r') as f:
                settings = json.load(f)
            
            # Apply settings
            if "fps_limit" in settings:
                self.set_fps_limit(settings["fps_limit"])
            
            if "noise_reduction" in settings:
                self.set_noise_reduction(settings["noise_reduction"])
            
            if "min_area" in settings:
                self.set_min_area(settings["min_area"])
            
            if "adaptive_mode" in settings:
                self.set_adaptive_mode(settings["adaptive_mode"])
            
            # Clear existing color targets and load new ones
            self.color_targets = []
            if "color_targets" in settings:
                for target in settings["color_targets"]:
                    target_id = self.add_color_target(target["name"], target["hex_code"])
                    if target_id and "tolerance" in target:
                        self.update_color_target(target_id, tolerance=target["tolerance"])
            
            logger.info(f"Settings loaded from {filepath}")
            return True
        except Exception as e:
            logger.error(f"Error loading settings: {str(e)}")
            return False


class DetectionService:
    """Service for managing video capture and detection"""
    
    def __init__(self):
        self.detector = ColorDetector()
        self.capture = None
        self.capture_thread = None
        self.running = False
        self.camera_index = 0
        self.frame_width = 640
        self.frame_height = 480
        self.latest_frame = None
        self.latest_results = None
        self._lock = threading.Lock()
        
        logger.info("DetectionService initialized")
    
    def start_camera(self, camera_index=0, width=640, height=480):
        """Start video capture from the specified camera"""
        if self.running:
            logger.warning("Camera already running")
            return False
        
        try:
            self.camera_index = camera_index
            self.frame_width = width
            self.frame_height = height
            
            # Open video capture
            self.capture = cv2.VideoCapture(camera_index)
            if not self.capture.isOpened():
                logger.error(f"Failed to open camera {camera_index}")
                return False
            
            # Set resolution
            self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            
            # Start capture thread
            self.running = True
            self.capture_thread = threading.Thread(target=self._capture_loop)
            self.capture_thread.daemon = True
            self.capture_thread.start()
            
            logger.info(f"Started camera {camera_index} at {width}x{height}")
            return True
        except Exception as e:
            logger.error(f"Error starting camera: {str(e)}")
            return False
    
    def stop_camera(self):
        """Stop video capture"""
        if not self.running:
            return False
        
        try:
            self.running = False
            if self.capture_thread:
                self.capture_thread.join(timeout=1.0)
            
            if self.capture:
                self.capture.release()
                self.capture = None
            
            logger.info("Camera stopped")
            return True
        except Exception as e:
            logger.error(f"Error stopping camera: {str(e)}")
            return False
    
    def _capture_loop(self):
        """Main capture and processing loop"""
        while self.running:
            try:
                # Capture frame
                ret, frame = self.capture.read()
                if not ret:
                    logger.warning("Failed to capture frame")
                    time.sleep(0.1)
                    continue
                
                # Store the latest frame
                with self._lock:
                    self.latest_frame = frame.copy()
                
                # Process frame for detection
                detection_result = self.detector.process_frame(frame)
                if detection_result:
                    with self._lock:
                        self.latest_results = detection_result
                
                # Small sleep to prevent CPU overuse
                time.sleep(0.001)
            except Exception as e:
                logger.error(f"Error in capture loop: {str(e)}")
                time.sleep(0.1)
    
    def get_latest_frame(self):
        """Get the latest captured frame"""
        with self._lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            return None
    
    def get_latest_visualization(self):
        """Get the latest detection visualization"""
        with self._lock:
            if self.latest_results and "visualization" in self.latest_results:
                return self.latest_results["visualization"].copy()
            return None
    
    def get_latest_results(self):
        """Get the latest detection results"""
        return self.detector.get_detection_results()
    
    def start_detection(self):
        """Start color detection"""
        return self.detector.start()
    
    def stop_detection(self):
        """Stop color detection"""
        return self.detector.stop()
    
    def update_settings(self, settings):
        """Update detector settings from a dictionary"""
        try:
            changes_made = False
            
            if "fps_limit" in settings:
                changes_made |= self.detector.set_fps_limit(settings["fps_limit"])
            
            if "noise_reduction" in settings:
                changes_made |= self.detector.set_noise_reduction(settings["noise_reduction"])
            
            if "min_area" in settings:
                changes_made |= self.detector.set_min_area(settings["min_area"])
            
            if "adaptive_mode" in settings:
                changes_made |= self.detector.set_adaptive_mode(settings["adaptive_mode"])
            
            if changes_made:
                logger.info("Detection settings updated")
            
            return changes_made
        except Exception as e:
            logger.error(f"Error updating settings: {str(e)}")
            return False
    
    def save_settings(self, filepath="detection_settings.json"):
        """Save current settings to file"""
        return self.detector.save_settings(filepath)
    
    def load_settings(self, filepath="detection_settings.json"):
        """Load settings from file"""
        return self.detector.load_settings(filepath)


# Example usage
if __name__ == "__main__":
    service = DetectionService()
    service.start_camera()
    service.start_detection()
    
    try:
        # Run for 30 seconds
        start_time = time.time()
        while time.time() - start_time < 30:
            results = service.get_latest_results()
            if results:
                print(f"Detection: {results['x_percent']}%, {results['y_percent']}%")
            time.sleep(0.1)
    finally:
        service.stop_detection()
        service.stop_camera()