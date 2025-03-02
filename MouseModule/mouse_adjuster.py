import numpy as np
import time
import pyautogui
import threading
from collections import deque
import math
import random

class MouseAdjuster:
    def __init__(self, smoothing_factor=0.5, buffer_size=10):
        """
        Initialize mouse input adjuster with customizable smoothing.
        
        Args:
            smoothing_factor: Factor for exponential smoothing (0-1)
                              0 = no smoothing, 1 = maximum smoothing
            buffer_size: Size of buffer for moving average and other algorithms
        """
        # Smoothing parameters
        self.smoothing_factor = smoothing_factor
        self.buffer_size = buffer_size
        
        # Input buffers for different algorithms
        self.position_buffer = deque(maxlen=buffer_size)
        self.last_position = None
        self.last_smooth_position = None
        
        # Filtering parameters
        self.filter_type = "exponential"  # Default filter type
        self.accel_threshold = 10.0       # Acceleration threshold for adaptive filtering
        self.jitter_threshold = 3.0       # Threshold for jitter detection
        
        # Human-like movement parameters
        self.humanize = False             # Whether to add human-like randomization
        self.humanize_factor = 0.1        # Factor for humanization (0-1)
        self.max_deviation = 5.0          # Maximum deviation for humanization
        
        # Thread control
        self.running = False
        self.thread = None
        
        # For acceleration calculation
        self.velocity_buffer = deque(maxlen=buffer_size)
    
    def set_smoothing_factor(self, factor):
        """Set exponential smoothing factor (0-1)."""
        self.smoothing_factor = max(0, min(1, factor))
    
    def set_filter_type(self, filter_type):
        """
        Set filtering algorithm type.
        
        Args:
            filter_type: One of "none", "exponential", "moving_avg", 
                        "gaussian", "kalman", "adaptive"
        """
        valid_types = ["none", "exponential", "moving_avg", "gaussian", "kalman", "adaptive"]
        if filter_type in valid_types:
            self.filter_type = filter_type
        else:
            raise ValueError(f"Invalid filter type. Must be one of: {valid_types}")
    
    def set_humanize(self, enable, factor=None, max_deviation=None):
        """
        Enable/disable human-like movement randomization.
        
        Args:
            enable: Boolean to enable/disable
            factor: Optional factor for randomization (0-1)
            max_deviation: Optional maximum pixel deviation
        """
        self.humanize = enable
        
        if factor is not None:
            self.humanize_factor = max(0, min(1, factor))
            
        if max_deviation is not None:
            self.max_deviation = max(0, max_deviation)
    
    def get_current_mouse_pos(self):
        """Get current mouse position."""
        return pyautogui.position()
    
    def move_mouse(self, x, y):
        """Move mouse to absolute position."""
        pyautogui.moveTo(x, y)
    
    def move_mouse_relative(self, dx, dy):
        """Move mouse by relative offset."""
        pyautogui.moveRel(dx, dy)
    
    def apply_smoothing(self, target_x, target_y):
        """
        Apply selected smoothing algorithm to target position.
        
        Args:
            target_x, target_y: Target coordinates
            
        Returns:
            Smoothed (x, y) coordinates
        """
        current_pos = self.get_current_mouse_pos()
        current_x, current_y = current_pos
        
        # Store current position in buffer
        self.position_buffer.append((current_x, current_y))
        
        if self.filter_type == "none":
            return target_x, target_y
            
        elif self.filter_type == "exponential":
            # Exponential smoothing
            if self.last_smooth_position is None:
                smoothed_x, smoothed_y = current_x, current_y
            else:
                last_x, last_y = self.last_smooth_position
                smoothed_x = self.smoothing_factor * last_x + (1 - self.smoothing_factor) * target_x
                smoothed_y = self.smoothing_factor * last_y + (1 - self.smoothing_factor) * target_y
                
            self.last_smooth_position = (smoothed_x, smoothed_y)
            return smoothed_x, smoothed_y
            
        elif self.filter_type == "moving_avg":
            # Simple moving average
            if len(self.position_buffer) < 2:
                return target_x, target_y
                
            # Add target position to end of path
            path = list(self.position_buffer) + [(target_x, target_y)]
            
            # Calculate moving average
            avg_x = sum(p[0] for p in path) / len(path)
            avg_y = sum(p[1] for p in path) / len(path)
            
            return avg_x, avg_y
            
        elif self.filter_type == "gaussian":
            # Gaussian smoothing - weighted average with higher weight for central points
            if len(self.position_buffer) < 3:
                return target_x, target_y
                
            # Create path including target
            path = list(self.position_buffer) + [(target_x, target_y)]
            
            # Create Gaussian weights
            sigma = len(path) / 3.0
            weights = [math.exp(-(i - len(path) + 1)**2 / (2 * sigma**2)) 
                      for i in range(len(path))]
            
            # Normalize weights
            weight_sum = sum(weights)
            weights = [w / weight_sum for w in weights]
            
            # Apply weighted average
            avg_x = sum(p[0] * w for p, w in zip(path, weights))
            avg_y = sum(p[1] * w for p, w in zip(path, weights))
            
            return avg_x, avg_y
            
        elif self.filter_type == "kalman":
            # Simple 1D Kalman filter implementation
            # This is a simplified version - a real implementation would be more complex
            
            if self.last_position is None or self.last_smooth_position is None:
                self.last_position = (current_x, current_y)
                self.last_smooth_position = (current_x, current_y)
                return target_x, target_y
            
            # Prediction step
            predicted_x = self.last_smooth_position[0]
            predicted_y = self.last_smooth_position[1]
            
            # Measurement noise (can be tuned)
            R = 0.1
            
            # Process noise (can be tuned)
            Q = 0.01
            
            # Kalman gain
            K = Q / (Q + R)
            
            # Update step
            new_x = predicted_x + K * (target_x - predicted_x)
            new_y = predicted_y + K * (target_y - predicted_y)
            
            self.last_position = (current_x, current_y)
            self.last_smooth_position = (new_x, new_y)
            
            return new_x, new_y
            
        elif self.filter_type == "adaptive":
            # Adaptive filtering based on movement speed
            if len(self.position_buffer) < 2:
                return target_x, target_y
            
            # Calculate current velocity
            last_pos = self.position_buffer[-1]
            velocity_x = current_x - last_pos[0]
            velocity_y = current_y - last_pos[1]
            
            self.velocity_buffer.append((velocity_x, velocity_y))
            
            # Calculate acceleration if we have enough points
            if len(self.velocity_buffer) >= 2:
                last_velocity = self.velocity_buffer[-2]
                accel_x = velocity_x - last_velocity[0]
                accel_y = velocity_y - last_velocity[1]
                
                # Calculate acceleration magnitude
                accel_magnitude = math.sqrt(accel_x**2 + accel_y**2)
                
                # Adjust smoothing factor based on acceleration
                adaptive_factor = self.smoothing_factor
                if accel_magnitude > self.accel_threshold:
                    # Reduce smoothing for fast movements
                    adaptive_factor = max(0.1, self.smoothing_factor - 0.2)
                elif accel_magnitude < self.jitter_threshold:
                    # Increase smoothing for slow/jittery movements
                    adaptive_factor = min(0.9, self.smoothing_factor + 0.2)
                
                # Apply exponential smoothing with adaptive factor
                if self.last_smooth_position is None:
                    smoothed_x, smoothed_y = current_x, current_y
                else:
                    last_x, last_y = self.last_smooth_position
                    smoothed_x = adaptive_factor * last_x + (1 - adaptive_factor) * target_x
                    smoothed_y = adaptive_factor * last_y + (1 - adaptive_factor) * target_y
                    
                self.last_smooth_position = (smoothed_x, smoothed_y)
                return smoothed_x, smoothed_y
            
            # Fall back to regular exponential smoothing if not enough data
            return self.apply_smoothing(target_x, target_y)
        
        # Default case
        return target_x, target_y
    
    def apply_humanization(self, x, y):
        """
        Add human-like randomization to mouse movement.
        
        Args:
            x, y: Input coordinates
            
        Returns:
            Humanized (x, y) coordinates
        """
        if not self.humanize:
            return x, y
        
        # Calculate maximum deviation based on humanize factor
        deviation = self.max_deviation * self.humanize_factor
        
        # Add random deviation with diminishing effect as we get closer to target
        dx = random.uniform(-deviation, deviation)
        dy = random.uniform(-deviation, deviation)
        
        # Apply deviation
        humanized_x = x + dx
        humanized_y = y + dy
        
        return humanized_x, humanized_y
    
    def move_to_target(self, target_x, target_y, steps=10, interval=0.01):
        """
        Move mouse to target position with smoothing and humanization.
        
        Args:
            target_x, target_y: Target coordinates
            steps: Number of intermediate steps
            interval: Time between steps
        """
        current_pos = self.get_current_mouse_pos()
        current_x, current_y = current_pos
        
        # Calculate path
        dx = (target_x - current_x) / steps
        dy = (target_y - current_y) / steps
        
        for i in range(steps):
            # Calculate intermediate position
            intermediate_x = current_x + dx * (i + 1)
            intermediate_y = current_y + dy * (i + 1)
            
            # Apply smoothing
            smoothed_x, smoothed_y = self.apply_smoothing(intermediate_x, intermediate_y)
            
            # Apply humanization
            if i < steps - 1:  # Don't humanize the final position
                smoothed_x, smoothed_y = self.apply_humanization(smoothed_x, smoothed_y)
            
            # Move mouse
            self.move_mouse(int(smoothed_x), int(smoothed_y))
            
            # Sleep
            time.sleep(interval)
    
    def start_continuous_adjustment(self, target_getter, interval=0.01):
        """
        Start continuous mouse position adjustment in a separate thread.
        
        Args:
            target_getter: Function that returns (target_x, target_y) tuple
            interval: Time between adjustments
        """
        if self.running:
            return
            
        self.running = True
        
        def adjustment_loop():
            while self.running:
                try:
                    # Get target position
                    target = target_getter()
                    
                    if target:
                        target_x, target_y = target
                        
                        # Apply smoothing
                        smoothed_x, smoothed_y = self.apply_smoothing(target_x, target_y)
                        
                        # Apply humanization
                        humanized_x, humanized_y = self.apply_humanization(smoothed_x, smoothed_y)
                        
                        # Move mouse
                        self.move_mouse(int(humanized_x), int(humanized_y))
                    
                    time.sleep(interval)
                    
                except Exception as e:
                    print(f"Error in adjustment loop: {e}")
                    time.sleep(interval)
        
        # Start thread
        self.thread = threading.Thread(target=adjustment_loop)
        self.thread.daemon = True
        self.thread.start()
    
    def stop_continuous_adjustment(self):
        """Stop continuous adjustment thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
            self.thread = None

# Example usage
if __name__ == "__main__":
    # Create mouse adjuster with moderate smoothing
    adjuster = MouseAdjuster(smoothing_factor=0.7, buffer_size=10)
    
    # Set filter type (try different ones)
    adjuster.set_filter_type("exponential")
    
    # Enable human-like movement
    adjuster.set_humanize(True, factor=0.2, max_deviation=3.0)
    
    try:
        print("Move your mouse around to see the effect of smoothing")
        print("Press Ctrl+C to exit")
        
        # Example of manual mouse movement
        while True:
            # Get current position
            current_x, current_y = adjuster.get_current_mouse_pos()
            
            # Simulate a target position (for demo, just offset from current)
            target_x = current_x + 50
            target_y = current_y + 50
            
            # Smooth movement to target
            adjuster.move_to_target(target_x, target_y, steps=20, interval=0.02)
            
            # Wait a bit before next movement
            time.sleep(1.0)
            
    except KeyboardInterrupt:
        print("Exiting...")
