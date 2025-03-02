import numpy as np
import cv2
import pyautogui
import time

class ScreenAnalyzer:
    def __init__(self, region=None, target_fps=30):
        """
        Initialize the screen analyzer.
        
        Args:
            region (tuple): Region of screen to capture (left, top, width, height).
                           If None, captures entire screen.
            target_fps (int): Target frames per second for analysis.
        """
        self.region = region
        self.target_fps = target_fps
        self.frame_time = 1.0 / target_fps
        self.last_frame_time = 0
        
        # Initialize HSV filter parameters with defaults
        self.hsv_lower = np.array([0, 0, 0])
        self.hsv_upper = np.array([179, 255, 255])
        
        # Initialize ROI for processing
        self.roi = None
        
    def capture_screen(self):
        """Capture the screen region defined in initialization."""
        if self.region:
            screenshot = pyautogui.screenshot(region=self.region)
        else:
            screenshot = pyautogui.screenshot()
            
        # Convert PIL image to OpenCV format (RGB to BGR)
        frame = np.array(screenshot)
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        return frame
    
    def set_hsv_filter(self, lower, upper):
        """
        Set HSV color filter range.
        
        Args:
            lower (list): Lower bound of HSV values [H, S, V]
            upper (list): Upper bound of HSV values [H, S, V]
        """
        self.hsv_lower = np.array(lower)
        self.hsv_upper = np.array(upper)
    
    def set_roi(self, x, y, width, height):
        """Set region of interest within the captured frame."""
        self.roi = (x, y, width, height)
    
    def detect_color(self, frame):
        """
        Detect areas matching the HSV color filter.
        
        Args:
            frame: OpenCV image in BGR format
            
        Returns:
            mask: Binary mask of detected areas
            result: Original frame with detected areas highlighted
        """
        # Apply ROI if specified
        if self.roi:
            x, y, w, h = self.roi
            roi_frame = frame[y:y+h, x:x+w]
        else:
            roi_frame = frame
            
        # Convert to HSV color space
        hsv = cv2.cvtColor(roi_frame, cv2.COLOR_BGR2HSV)
        
        # Create mask for specified HSV range
        mask = cv2.inRange(hsv, self.hsv_lower, self.hsv_upper)
        
        # Apply noise reduction
        mask = self.reduce_noise(mask)
        
        # Create visual result
        result = cv2.bitwise_and(roi_frame, roi_frame, mask=mask)
        
        return mask, result
    
    def reduce_noise(self, mask, kernel_size=5):
        """
        Apply morphological operations to reduce noise.
        
        Args:
            mask: Binary mask image
            kernel_size: Size of kernel for morphological operations
            
        Returns:
            Processed binary mask
        """
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        
        # Apply opening to remove small noise
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Apply closing to fill small holes
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        
        return mask
    
    def find_contours(self, mask):
        """
        Find contours in the binary mask.
        
        Args:
            mask: Binary mask image
            
        Returns:
            List of contours found
            Hierarchy information
        """
        contours, hierarchy = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        return contours, hierarchy
    
    def find_largest_contour(self, contours):
        """
        Find the largest contour by area.
        
        Args:
            contours: List of contours
            
        Returns:
            Largest contour or None if no contours found
        """
        if not contours:
            return None
            
        return max(contours, key=cv2.contourArea)
    
    def get_contour_center(self, contour):
        """
        Calculate the center point of a contour.
        
        Args:
            contour: OpenCV contour
            
        Returns:
            (x, y) center coordinates or None if contour is None
        """
        if contour is None:
            return None
            
        M = cv2.moments(contour)
        if M["m00"] == 0:
            return None
            
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        
        # If ROI is active, adjust coordinates relative to full frame
        if self.roi:
            roi_x, roi_y, _, _ = self.roi
            cx += roi_x
            cy += roi_y
            
        return (cx, cy)
    
    def auto_adjust_hsv(self, frame, initial_mask, learning_rate=0.1):
        """
        Automatically adjust HSV range based on lighting conditions.
        
        Args:
            frame: Current frame in BGR format
            initial_mask: Current binary mask
            learning_rate: Rate of adjustment (0-1)
            
        Returns:
            Updated mask
        """
        # Find pixels that are just outside current threshold
        # This is a simplified implementation - production would use more sophisticated approach
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Expand current range slightly
        temp_lower = self.hsv_lower.copy()
        temp_upper = self.hsv_upper.copy()
        
        # Adjust H, S, V ranges slightly to test broader range
        temp_lower[0] = max(0, temp_lower[0] - 5)
        temp_lower[1] = max(0, temp_lower[1] - 10)
        temp_lower[2] = max(0, temp_lower[2] - 10)
        
        temp_upper[0] = min(179, temp_upper[0] + 5)
        temp_upper[1] = min(255, temp_upper[1] + 10)
        temp_upper[2] = min(255, temp_upper[2] + 10)
        
        # Create expanded mask
        expanded_mask = cv2.inRange(hsv, temp_lower, temp_upper)
        
        # Find pixels in expanded mask but not in initial mask
        new_pixels = cv2.bitwise_and(expanded_mask, cv2.bitwise_not(initial_mask))
        
        # If significant new pixels found, adjust HSV range
        if cv2.countNonZero(new_pixels) > 100:
            # Sample HSV values of new pixels
            new_hsv_pixels = hsv[new_pixels > 0]
            
            if len(new_hsv_pixels) > 0:
                # Calculate min and max HSV values in new pixels
                min_h = np.min(new_hsv_pixels[:, 0])
                min_s = np.min(new_hsv_pixels[:, 1])
                min_v = np.min(new_hsv_pixels[:, 2])
                
                max_h = np.max(new_hsv_pixels[:, 0])
                max_s = np.max(new_hsv_pixels[:, 1])
                max_v = np.max(new_hsv_pixels[:, 2])
                
                # Adjust current range with learning rate
                self.hsv_lower[0] = max(0, int(self.hsv_lower[0] * (1 - learning_rate) + min_h * learning_rate))
                self.hsv_lower[1] = max(0, int(self.hsv_lower[1] * (1 - learning_rate) + min_s * learning_rate))
                self.hsv_lower[2] = max(0, int(self.hsv_lower[2] * (1 - learning_rate) + min_v * learning_rate))
                
                self.hsv_upper[0] = min(179, int(self.hsv_upper[0] * (1 - learning_rate) + max_h * learning_rate))
                self.hsv_upper[1] = min(255, int(self.hsv_upper[1] * (1 - learning_rate) + max_s * learning_rate))
                self.hsv_upper[2] = min(255, int(self.hsv_upper[2] * (1 - learning_rate) + max_v * learning_rate))
                
        # Return mask with new HSV range
        return cv2.inRange(hsv, self.hsv_lower, self.hsv_upper)
    
    def process_frame(self):
        """
        Capture and process a single frame.
        
        Returns:
            frame: Original captured frame
            result: Visualization with detected areas highlighted
            center: (x, y) coordinates of largest detected contour center, or None
        """
        # Handle frame timing for consistent FPS
        current_time = time.time()
        elapsed = current_time - self.last_frame_time
        
        if elapsed < self.frame_time:
            time.sleep(self.frame_time - elapsed)
        
        self.last_frame_time = time.time()
        
        # Capture and process frame
        frame = self.capture_screen()
        mask, result = self.detect_color(frame)
        
        # Find the largest contour
        contours, _ = self.find_contours(mask)
        largest_contour = self.find_largest_contour(contours)
        center = self.get_contour_center(largest_contour)
        
        # Adaptive HSV adjustments (enable for changing lighting conditions)
        # mask = self.auto_adjust_hsv(frame, mask)
        
        return frame, result, center

# Example usage
if __name__ == "__main__":
    # Example for a target detection (e.g., red objects)
    analyzer = ScreenAnalyzer(region=(0, 0, 800, 600), target_fps=30)
    
    # Set HSV range for red objects (example)
    analyzer.set_hsv_filter([0, 100, 100], [10, 255, 255])
    
    # Optional: Set region of interest within the captured area
    analyzer.set_roi(100, 100, 400, 300)
    
    # Demonstration loop
    try:
        while True:
            frame, result, center = analyzer.process_frame()
            
            if center:
                print(f"Detected center: {center}")
                
                # Draw circle at center in result
                if analyzer.roi:
                    roi_x, roi_y, _, _ = analyzer.roi
                    rel_center = (center[0] - roi_x, center[1] - roi_y)
                    cv2.circle(result, rel_center, 5, (0, 255, 0), -1)
                else:
                    cv2.circle(result, center, 5, (0, 255, 0), -1)
            
            # Show result (for debugging and visualization)
            cv2.imshow("Detection Result", result)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    except KeyboardInterrupt:
        pass
        
    cv2.destroyAllWindows()