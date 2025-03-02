import numpy as np
import math
import random
import time
import pyautogui

class HumanMovementSimulator:
    def __init__(self):
        """Initialize human movement simulator with default parameters."""
        # Bezier curve control parameters
        self.control_points = 3  # Number of control points for Bezier curve
        
        # Velocity profile parameters
        self.min_velocity = 0    # Minimum velocity (pixels/ms)
        self.max_velocity = 3    # Maximum velocity (pixels/ms)
        self.accel_factor = 0.5  # Acceleration factor
        self.decel_factor = 0.5  # Deceleration factor
        
        # Noise parameters
        self.path_noise = 0.2    # Path noise factor (0-1)
        self.time_noise = 0.2    # Timing noise factor (0-1)
        
        # Overshoot parameters
        self.overshoot_prob = 0.1  # Probability of overshooting
        self.overshoot_factor = 0.2  # Distance factor for overshooting
        
        # Micro-correction parameters
        self.micro_correction_prob = 0.3  # Probability of micro-correction at end
        self.micro_correction_dist = 5.0  # Maximum distance for micro-correction
        self.micro_correction_steps = 3   # Steps for micro-correction
        
        pyautogui.PAUSE = 0      # No pause between PyAutoGUI commands
        pyautogui.FAILSAFE = True  # Enable fail-safe (move to corner to abort)
    
    def set_velocity_profile(self, min_vel, max_vel, accel=None, decel=None):
        """
        Set velocity profile parameters.
        
        Args:
            min_vel: Minimum velocity (pixels/ms)
            max_vel: Maximum velocity (pixels/ms)
            accel: Acceleration factor (0-1)
            decel: Deceleration factor (0-1)
        """
        self.min_velocity = max(0, min_vel)
        self.max_velocity = max(self.min_velocity, max_vel)
        
        if accel is not None:
            self.accel_factor = max(0, min(1, accel))
            
        if decel is not None:
            self.decel_factor = max(0, min(1, decel))
    
    def set_noise_factors(self, path_noise, time_noise):
        """
        Set path and timing noise factors.
        
        Args:
            path_noise: Path noise factor (0-1)
            time_noise: Timing noise factor (0-1)
        """
        self.path_noise = max(0, min(1, path_noise))
        self.time_noise = max(0, min(1, time_noise))
    
    def set_overshoot_params(self, probability, factor):
        """
        Set overshoot parameters.
        
        Args:
            probability: Probability of overshooting (0-1)
            factor: Distance factor for overshooting (0-1)
        """
        self.overshoot_prob = max(0, min(1, probability))
        self.overshoot_factor = max(0, min(1, factor))
    
    def set_micro_correction_params(self, probability, distance, steps):
        """
        Set micro-correction parameters.
        
        Args:
            probability: Probability of micro-correction at end (0-1)
            distance: Maximum distance for micro-correction
            steps: Steps for micro-correction
        """
        self.micro_correction_prob = max(0, min(1, probability))
        self.micro_correction_dist = max(0, distance)
        self.micro_correction_steps = max(1, steps)
    
    def _sigmoid(self, x):
        """Sigmoid function for smooth acceleration/deceleration."""
        return 1 / (1 + math.exp(-x))
    
    def _generate_bezier_control_points(self, start, end):
        """
        Generate control points for a Bezier curve between start and end.
        
        Args:
            start: (x, y) start coordinates
            end: (x, y) end coordinates
            
        Returns:
            List of control points including start and end
        """
        # Extract coordinates
        start_x, start_y = start
        end_x, end_y = end
        
        # Calculate vector between points
        vec_x = end_x - start_x
        vec_y = end_y - start_y
        
        # Calculate distance
        distance = math.sqrt(vec_x**2 + vec_y**2)
        
        # Create control points
        points = [start]
        
        # Add intermediate control points
        for i in range(1, self.control_points):
            # Position along the line (not uniformly distributed)
            t = i / (self.control_points + 1)
            
            # Apply sigmoid distribution to get non-uniform spacing
            adjusted_t = self._sigmoid(6 * (t - 0.5)) * 0.8 + 0.1
            
            # Calculate position
            x = start_x + vec_x * adjusted_t
            y = start_y + vec_y * adjusted_t
            
            # Add random offset perpendicular to line
            perpendicular_x = -vec_y / distance
            perpendicular_y = vec_x / distance
            
            # Random offset, higher in the middle
            offset_factor = self.path_noise * math.sin(math.pi * adjusted_t) * distance * 0.2
            offset = random.uniform(-offset_factor, offset_factor)
            
            x += perpendicular_x * offset
            y += perpendicular_y * offset
            
            # Add to control points
            points.append((x, y))
        
        # Add end point
        points.append(end)
        
        return points
    
    def _calculate_bezier_point(self, t, control_points):
        """
        Calculate a point along a Bezier curve.
        
        Args:
            t: Parameter (0-1) along the curve
            control_points: List of control points
            
        Returns:
            (x, y) coordinates of point on curve
        """
        n = len(control_points) - 1
        point_x = 0
        point_y = 0
        
        for i, (x, y) in enumerate(control_points):
            # Bernstein polynomial coefficient
            coef = math.comb(n, i) * (t**i) * ((1 - t)**(n - i))
            point_x += x * coef
            point_y += y * coef
        
        return point_x, point_y
    
    def _calculate_velocity_at_t(self, t):
        """
        Calculate velocity at position t along the path.
        
        Args:
            t: Parameter (0-1) along the path
            
        Returns:
            Velocity factor (0-1)
        """
        # Velocity profile with acceleration and deceleration phases
        accel_phase = self.accel_factor
        decel_phase = 1 - self.decel_factor
        
        if t < accel_phase:
            # Acceleration phase
            v_factor = self._sigmoid(10 * (t / accel_phase) - 5) * 0.5 + 0.5
        elif t > decel_phase:
            # Deceleration phase
            v_factor = self._sigmoid(10 * (1 - (t - decel_phase) / (1 - decel_phase)) - 5) * 0.5 + 0.5
        else:
            # Constant velocity phase
            v_factor = 1.0
        
        # Scale velocity between min and max
        velocity = self.min_velocity + (self.max_velocity - self.min_velocity) * v_factor
        
        # Add random variation
        noise = random.uniform(-self.time_noise, self.time_noise) * velocity * 0.2
        velocity = max(self.min_velocity, velocity + noise)
        
        return velocity
    
    def _generate_timestamp_intervals(self, control_points, num_steps):
        """
        Generate timestamps for each step, accounting for velocity changes.
        
        Args:
            control_points: List of control points
            num_steps: Number of steps along the path
            
        Returns:
            List of timestamps for each step
        """
        # Calculate total path distance (approximation)
        total_distance = 0
        for i in range(1, len(control_points)):
            x1, y1 = control_points[i-1]
            x2, y2 = control_points[i]
            segment_dist = math.sqrt((x2-x1)**2 + (y2-y1)**2)
            total_distance += segment_dist
        
        # Generate intervals based on velocity profile
        intervals = []
        for i in range(num_steps):
            t = i / (num_steps - 1)
            velocity = self._calculate_velocity_at_t(t)
            
            # Convert velocity (pixels/ms) to time interval (ms)
            step_distance = total_distance / num_steps
            interval_ms = step_distance / velocity if velocity > 0 else 10
            
            # Add noise to interval
            noise = random.uniform(-self.time_noise, self.time_noise) * interval_ms * 0.3
            interval_ms = max(1, interval_ms + noise)
            
            intervals.append(interval_ms / 1000)  # Convert to seconds
        
        return intervals
    
    def move_mouse(self, end_x, end_y, steps=50):
        """
        Move the mouse to the target position using human-like movement.
        
        Args:
            end_x, end_y: Target coordinates
            steps: Number of steps for the movement
        """
        # Get current mouse position
        start_x, start_y = pyautogui.position()
        
        # Apply possible overshoot
        target_x, target_y = end_x, end_y
        if random.random() < self.overshoot_prob:
            # Calculate overshoot vector
            vec_x = end_x - start_x
            vec_y = end_y - start_y
            distance = math.sqrt(vec_x**2 + vec_y**2)
            
            # Add overshoot
            overshoot_dist = distance * self.overshoot_factor * random.uniform(0.5, 1.0)
            overshoot_x = end_x + (vec_x / distance) * overshoot_dist
            overshoot_y = end_y + (vec_y / distance) * overshoot_dist
            
            # Set as target (we'll correct later)
            end_x, end_y = overshoot_x, overshoot_y
        
        # Generate Bezier control points
        control_points = self._generate_bezier_control_points((start_x, start_y), (end_x, end_y))
        
        # Generate time intervals
        intervals = self._generate_timestamp_intervals(control_points, steps)
        
        # Move along the path
        for i in range(steps):
            t = i / (steps - 1)
            
            # Calculate position on Bezier curve
            x, y = self._calculate_bezier_point(t, control_points)
            
            # Move mouse to this position
            pyautogui.moveTo(int(x), int(y))
            
            # Sleep for calculated interval
            time.sleep(intervals[i])
        
        # Apply micro-corrections if needed
        if random.random() < self.micro_correction_prob:
            # Get current position after main movement
            current_x, current_y = pyautogui.position()
            
            # Calculate distance to intended target
            dist_to_target = math.sqrt((current_x - target_x)**2 + (current_y - target_y)**2)
            
            # Apply micro-corrections if not close enough
            if dist_to_target > 1.0:
                # Generate smaller random movements toward target
                for _ in range(self.micro_correction_steps):
                    # Calculate vector to target
                    current_x, current_y = pyautogui.position()
                    to_target_x = target_x - current_x
                    to_target_y = target_y - current_y
                    
                    # Calculate distance
                    dist = math.sqrt(to_target_x**2 + to_target_y**2)
                    
                    # If we're close enough, finish with exact position
                    if dist < 2.0:
                        pyautogui.moveTo(target_x, target_y)
                        break
                    
                    # Otherwise, move a portion of the way with small random variation
                    move_factor = random.uniform(0.4, 0.8)
                    noise_factor = min(self.micro_correction_dist, dist * 0.2)
                    
                    next_x = current_x + to_target_x * move_factor + random.uniform(-noise_factor, noise_factor)
                    next_y = current_y + to_target_y * move_factor + random.uniform(-noise_factor, noise_factor)
                    
                    # Move and pause briefly
                    pyautogui.moveTo(int(next_x), int(next_y))
                    time.sleep(random.uniform(0.01, 0.05))
                
                # Final exact movement to target
                pyautogui.moveTo(target_x, target_y)
    
    def click(self, button='left'):
        """
        Perform a mouse click with realistic timing.
        
        Args:
            button: Mouse button to click ('left', 'right', 'middle')
        """
        # Random delay before pressing
        time.sleep(random.uniform(0.02, 0.06))
        
        # Press button
        pyautogui.mouseDown(button=button)
        
        # Random hold time
        time.sleep(random.uniform(0.03, 0.12))
        
        # Release button
        pyautogui.mouseUp(button=button)
        
        # Random delay after clicking
        time.sleep(random.uniform(0.01, 0.05))
    
    def double_click(self):
        """Perform a realistic double-click."""
        # First click
        self.click()
        
        # Random delay between clicks (typical double-click threshold is ~500ms)
        time.sleep(random.uniform(0.05, 0.15))
        
        # Second click
        self.click()
    
    def drag(self, end_x, end_y, button='left', steps=30):
        """
        Perform a drag operation from current position to target.
        
        Args:
            end_x, end_y: Target coordinates
            button: Mouse button to use for dragging
            steps: Number of steps for the movement
        """
        # Get current mouse position
        start_x, start_y = pyautogui.position()
        
        # Generate Bezier control points
        control_points = self._generate_bezier_control_points((start_x, start_y), (end_x, end_y))
        
        # Generate time intervals
        intervals = self._generate_timestamp_intervals(control_points, steps)
        
        # Press mouse button
        pyautogui.mouseDown(button=button)
        
        # Small delay after pressing (realistic human hesitation)
        time.sleep(random.uniform(0.05, 0.1))
        
        # Move along the path
        for i in range(steps):
            t = i / (steps - 1)
            
            # Calculate position on Bezier curve
            x, y = self._calculate_bezier_point(t, control_points)
            
            # Move mouse to this position
            pyautogui.moveTo(int(x), int(y))
            
            # Sleep for calculated interval (draggers typically move slower)
            time.sleep(intervals[i] * random.uniform(1.0, 1.5))
        
        # Short delay before releasing
        time.sleep(random.uniform(0.05, 0.1))
        
        # Release mouse button
        pyautogui.mouseUp(button=button)

# Example usage
if __name__ == "__main__":
    # Create simulator with default parameters
    simulator = HumanMovementSimulator()
    
    # Customize parameters
    simulator.set_velocity_profile(min_vel=0.1, max_vel=2.0, accel=0.3, decel=0.7)
    simulator.set_noise_factors(path_noise=0.2, time_noise=0.2)
    simulator.set_overshoot_params(probability=0.2, factor=0.1)
    simulator.set_micro_correction_params(probability=0.7, distance=3.0, steps=2)
    
    try:
        print("Demonstrating human-like mouse movement...")
        print("Press Ctrl+C to exit")
        
        # Move to a few points on the screen
        screen_width, screen_height = pyautogui.size()
        points = [
            (screen_width // 4, screen_height // 4),
            (screen_width * 3 // 4, screen_height // 4),
            (screen_width * 3 // 4, screen_height * 3 // 4),
            (screen_width // 4, screen_height * 3 // 4),
            (screen_width // 2, screen_height // 2)
        ]
        
        for x, y in points:
            # Move to point
            print(f"Moving to ({x}, {y})")
            simulator.move_mouse(x, y)
            
            # Perform click
            simulator.click()
            
            # Wait before next movement
            time.sleep(1.0)
            
        print("Demo complete!")
        
    except KeyboardInterrupt:
        print("Exiting...")
