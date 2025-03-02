import cv2
import numpy as np
import time
import threading
import pyautogui
import random
from collections import deque

# Import our previously defined classes
# In a real implementation, you would import these from their modules
# Here we'll assume they are already imported:
#
# from screen_analyzer import ScreenAnalyzer 
# from mouse_adjuster import MouseAdjuster
# from human_movement import HumanMovementSimulator

class VisionMouseController:
    def __init__(self, detection_interval=0.02, movement_interval=0.05):
        """
        Initialize the vision-based mouse controller.
        
        Args:
            detection_interval: Time interval between target detections (seconds)
            movement_interval: Time interval between mouse movements (seconds)
        """
        # Initialize components
        self.screen_analyzer = ScreenAnalyzer(target_fps=int(1/detection_interval))
        self.mouse_adjuster = MouseAdjuster(smoothing_factor=0.7, buffer_size=10)
        self.human_simulator = HumanMovementSimulator()
        
        # Set default HSV filter (can be calibrated later)
        self.screen_analyzer.set_hsv_filter([80, 100, 100], [100, 255, 255])
        
        # Configure movement parameters
        self.movement_interval = movement_interval
        self.mouse_adjuster.set_filter_type("adaptive")
        self.mouse_adjuster.set_humanize(True, factor=0.15, max_deviation=3.0)
        
        # Target tracking state
        self.target_positions = deque(maxlen=30)  # Store recent positions
        self.current_target = None
        self.target_lock = False
        self.target_lost_count = 0
        self.max_lost_frames = 30  # Maximum frames before considering target lost
        
        # Movement parameters
        self.movement_type = "smoothed"  # "smoothed", "human", or "hybrid"
        self.precision_radius = 20       # Pixel radius for precision mode
        self.movement_scale = 1.0        # Scaling factor for movement (1.0 = direct mapping)
        self.movement_offset = (0, 0)    # (x, y) offset for movement
        
        # Optional prediction parameters
        self.prediction_enabled = False
        self.prediction_frames = 5       # How many frames to predict ahead
        
        # Operation flags
        self.running = False
        self.detection_thread = None
        self.movement_thread = None
        
        # Debug visualization
        self.debug_mode = False
        self.debug_window = None
    
    def set_hsv_filter(self, lower, upper):
        """Set HSV color filter range."""
        self.screen_analyzer.set_hsv_filter(lower, upper)
    
    def set_roi(self, x, y, width, height):
        """Set region of interest for screen analysis."""
        self.screen_analyzer.set_roi(x, y, width, height)
    
    def set_movement_type(self, movement_type):
        """
        Set the type of mouse movement.
        
        Args:
            movement_type: One of "smoothed", "human", or "hybrid"
        """
        valid_types = ["smoothed", "human", "hybrid"]
        if movement_type in valid_types:
            self.movement_type = movement_type
        else:
            raise ValueError(f"Invalid movement type. Must be one of: {valid_types}")
    
    def set_movement_parameters(self, scale=None, offset=None, precision_radius=None):
        """
        Set movement mapping parameters.
        
        Args:
            scale: Scaling factor for movement (1.0 = direct mapping)
            offset: (x, y) offset for movement
            precision_radius: Pixel radius for precision mode
        """
        if scale is not None:
            self.movement_scale = max(0.1, min(10.0, scale))
            
        if offset is not None:
            self.movement_offset = offset
            
        if precision_radius is not None:
            self.precision_radius = max(1, precision_radius)
    
    def enable_prediction(self, enabled=True, frames=5):
        """
        Enable/disable motion prediction.
        
        Args:
            enabled: Boolean to enable/disable prediction
            frames: How many frames to predict ahead
        """
        self.prediction_enabled = enabled
        self.prediction_frames = max(1, frames)
    
    def set_debug_mode(self, enabled=True):
        """Enable/disable debug visualization."""
        self.debug_mode = enabled
        
        if enabled and not self.debug_window:
            cv2.namedWindow("Debug View", cv2.WINDOW_NORMAL)
            self.debug_window = "Debug View"
        elif not enabled and self.debug_window:
            cv2.destroyWindow("Debug View")
            self.debug_window = None
    
    def _detection_loop(self):
        """Background thread for continuous target detection."""
        while self.running:
            try:
                # Process a frame
                frame, result, center = self.screen_analyzer.process_frame()
                
                # Store the detected center
                if center:
                    self.target_positions.append(center)
                    self.current_target = center
                    self.target_lock = True
                    self.target_lost_count = 0
                else:
                    self.target_lost_count += 1
                    
                    # Check if target is lost
                    if self.target_lost_count > self.max_lost_frames:
                        self.target_lock = False
                
                # Show debug view if enabled
                if self.debug_mode and self.debug_window:
                    # Create visualization
                    debug_frame = frame.copy()
                    
                    # Draw target indicator
                    if self.current_target:
                        x, y = self.current_target
                        cv2.circle(debug_frame, (int(x), int(y)), 10, (0, 255, 0), 2)
                        
                        # Draw trajectory
                        if len(self.target_positions) > 1:
                            points = np.array(list(self.target_positions), dtype=np.int32)
                            cv2.polylines(debug_frame, [points.reshape((-1, 1, 2))], False, (0, 0, 255), 2)
                    
                    # Show mouse position
                    mouse_x, mouse_y = pyautogui.position()
                    cv2.circle(debug_frame, (mouse_x, mouse_y), 5, (255, 0, 0), -1)
                    
                    # Show debug info as text
                    text = f"Target: {'Locked' if self.target_lock else 'Lost'}"
                    cv2.putText(debug_frame, text, (10, 30), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    
                    # Show the frame
                    cv2.imshow(self.debug_window, debug_frame)
                    cv2.waitKey(1)
                
            except Exception as e:
                print(f"Error in detection loop: {e}")
                time.sleep(0.1)
    
    def _predict_target(self):
        """
        Predict target position based on recent movement.
        
        Returns:
            Predicted (x, y) or None if prediction not possible
        """
        if not self.prediction_enabled or len(self.target_positions) < 3:
            return self.current_target
            
        # Calculate velocity from recent positions
        recent_positions = list(self.target_positions)
        velocity_vectors = []
        
        for i in range(1, len(recent_positions)):
            p1 = recent_positions[i-1]
            p2 = recent_positions[i]
            
            # Calculate velocity vector
            vx = p2[0] - p1[0]
            vy = p2[1] - p1[1]
            
            velocity_vectors.append((vx, vy))
        
        # Use last few velocity vectors for prediction
        recent_velocity = velocity_vectors[-3:]
        
        # Calculate average velocity
        avg_vx = sum(v[0] for v in recent_velocity) / len(recent_velocity)
        avg_vy = sum(v[1] for v in recent_velocity) / len(recent_velocity)
        
        # Predict future position
        current_x, current_y = self.current_target
        predicted_x = current_x + avg_vx * self.prediction_frames
        predicted_y = current_y + avg_vy * self.prediction_frames
        
        return (predicted_x, predicted_y)
    
    def _map_target_to_mouse(self, target_x, target_y):
        """
        Map target coordinates to mouse coordinates with scaling and offset.
        
        Args:
            target_x, target_y: Target coordinates
            
        Returns:
            Mapped (x, y) coordinates for mouse
        """
        # Apply scale
        scaled_x = target_x * self.movement_scale
        scaled_y = target_y * self.movement_scale
        
        # Apply offset
        mapped_x = scaled_x + self.movement_offset[0]
        mapped_y = scaled_y + self.movement_offset[1]
        
        return mapped_x, mapped_y
    
    def _precision_mapping(self, target_x, target_y, mouse_x, mouse_y):
        """
        Apply precision mapping when close to target.
        
        Args:
            target_x, target_y: Target coordinates
            mouse_x, mouse_y: Current mouse coordinates
            
        Returns:
            New mapped (x, y) coordinates for mouse
        """
        # Calculate distance between mouse and target
        distance = math.sqrt((target_x - mouse_x)**2 + (target_y - mouse_y)**2)
        
        if distance <= self.precision_radius:
            # Inside precision radius, apply more precise mapping
            # Reduce the scale as we get closer to the target
            reduction_factor = distance / self.precision_radius
            adjusted_scale = max(0.1, reduction_factor) * self.movement_scale
            
            # Calculate precise movement
            delta_x = (target_x - mouse_x) * adjusted_scale
            delta_y = (target_y - mouse_y) * adjusted_scale
            
            # Apply to current position
            mapped_x = mouse_x + delta_x
            mapped_y = mouse_y + delta_y
        else:
            # Outside precision radius, use normal mapping
            mapped_x, mapped_y = self._map_target_to_mouse(target_x, target_y)
        
        return mapped_x, mapped_y
    
    def _movement_loop(self):
        """Background thread for continuous mouse movement."""
        while self.running:
            try:
                # Check if we have a valid target
                if self.target_lock and self.current_target:
                    # Get current target or predicted position
                    target_pos = self._predict_target() if self.prediction_enabled else self.current_target
                    
                    if target_pos:
                        target_x, target_y = target_pos
                        
                        # Get current mouse position
                        mouse_x, mouse_y = pyautogui.position()
                        
                        # Apply precision mapping
                        mapped_x, mapped_y = self._precision_mapping(target_x, target_y, mouse_x, mouse_y)
                        
                        # Move mouse based on selected method
                        if self.movement_type == "smoothed":
                            # Apply smoothing
                            smoothed_x, smoothed_y = self.mouse_adjuster.apply_smoothing(mapped_x, mapped_y)
                            
                            # Apply humanization
                            final_x, final_y = self.mouse_adjuster.apply_humanization(smoothed_x, smoothed_y)
                            
                            # Move mouse directly
                            pyautogui.moveTo(int(final_x), int(final_y))
                            
                        elif self.movement_type == "human":
                            # Calculate distance
                            distance = math.sqrt((mapped_x - mouse_x)**2 + (mapped_y - mouse_y)**2)
                            
                            # Only move if distance is significant
                            if distance > 5:
                                # Use human-like movement
                                self.human_simulator.move_mouse(int(mapped_x), int(mapped_y))
                                
                        elif self.movement_type == "hybrid":
                            # Calculate distance
                            distance = math.sqrt((mapped_x - mouse_x)**2 + (mapped_y - mouse_y)**2)
                            
                            if distance > 50:
                                # For large movements, use human-like movement
                                steps = min(50, max(10, int(distance / 10)))  # Scale steps with distance
                                self.human_simulator.move_mouse(int(mapped_x), int(mapped_y), steps=steps)
                            else:
                                # For small adjustments, use smoothed movement
                                smoothed_x, smoothed_y = self.mouse_adjuster.apply_smoothing(mapped_x, mapped_y)
                                final_x, final_y = self.mouse_adjuster.apply_humanization(smoothed_x, smoothed_y)
                                pyautogui.moveTo(int(final_x), int(final_y))
                
                # Sleep for movement interval
                time.sleep(self.movement_interval)
                
            except Exception as e:
                print(f"Error in movement loop: {e}")
                time.sleep(0.1)
    
    def start(self):
        """Start the vision-based mouse controller."""
        if self.running:
            return
            
        self.running = True
        
        # Start detection thread
        self.detection_thread = threading.Thread(target=self._detection_loop)
        self.detection_thread.daemon = True
        self.detection_thread.start()
        
        # Start movement thread
        self.movement_thread = threading.Thread(target=self._movement_loop)
        self.movement_thread.daemon = True
        self.movement_thread.start()
        
        print("Vision-based mouse controller started")
    
    def stop(self):
        """Stop the vision-based mouse controller."""
        self.running = False
        
        if self.detection_thread:
            self.detection_thread.join(timeout=1.0)
            self.detection_thread = None
            
        if self.movement_thread:
            self.movement_thread.join(timeout=1.0)
            self.movement_thread = None
            
        if self.debug_window:
            cv2.destroyAllWindows()
            self.debug_window = None
            
        print("Vision-based mouse controller stopped")

# Example usage
if __name__ == "__main__":
    try:
        # Create controller
        controller = VisionMouseController()
        
        # Configure HSV filter (example for a green object)
        controller.set_hsv_filter([40, 100, 100], [80, 255, 255])
        
        # Set movement parameters
        controller.set_movement_type("hybrid")
        controller.set_movement_parameters(scale=1.0, precision_radius=15)
        
        # Enable debug mode
        controller.set_debug_mode(True)
        
        # Start controller
        controller.start()
        
        # Run for 60 seconds
        print("Running for 60 seconds... Press Ctrl+C to stop")
        time.sleep(60)
        
    except KeyboardInterrupt:
        print("Interrupted by user")
        
    finally:
        # Stop controller
        controller.stop()
        print("Demo complete")
