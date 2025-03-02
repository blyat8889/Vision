import numpy as np
import cv2
import pyautogui
import time

class BackgroundSubtractor:
    def __init__(self, history=100, threshold=16, detect_shadows=True):
        """
        Initialize background subtractor with advanced filtering.
        
        Args:
            history: Number of frames to keep in history for background model
            threshold: Threshold for foreground detection
            detect_shadows: Whether to detect and mark shadows
        """
        # Create background subtractor
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history,
            varThreshold=threshold,
            detectShadows=detect_shadows
        )
        
        # Initialize parameters
        self.learning_rate = 0.01  # Background adaptation rate
        self.min_area = 100        # Minimum contour area to consider
        self.kernel_size = 5       # Morphological operation kernel size
        self.roi = None            # Region of interest
        
    def set_roi(self, x, y, width, height):
        """Set region of interest for processing."""
        self.roi = (x, y, width, height)
        
    def set_learning_rate(self, rate):
        """Set background model learning rate (0-1)."""
        self.learning_rate = max(0, min(1, rate))
        
    def set_min_area(self, area):
        """Set minimum contour area to filter out noise."""
        self.min_area = area
        
    def set_kernel_size(self, size):
        """Set morphological operation kernel size."""
        if size % 2 == 0:  # Ensure odd size for kernel
            size += 1
        self.kernel_size = size
        
    def capture_screen(self):
        """Capture screen or specified region."""
        if self.roi:
            screenshot = pyautogui.screenshot(region=self.roi)
        else:
            screenshot = pyautogui.screenshot()
            
        # Convert to OpenCV format
        frame = np.array(screenshot)
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        return frame
        
    def apply_subtraction(self, frame):
        """
        Apply background subtraction to frame.
        
        Args:
            frame: OpenCV BGR image
            
        Returns:
            Original frame
            Foreground mask
            Contours found in foreground
        """
        # Apply background subtractor
        fg_mask = self.bg_subtractor.apply(frame, learningRate=self.learning_rate)
        
        # Filter out shadows (typically 127 in MOG2)
        _, binary_mask = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)
        
        # Apply noise filtering
        binary_mask = self.filter_noise(binary_mask)
        
        # Find contours
        contours = self.find_contours(binary_mask)
        
        # Filter contours by size
        filtered_contours = [cnt for cnt in contours if cv2.contourArea(cnt) > self.min_area]
        
        return frame, binary_mask, filtered_contours
    
    def filter_noise(self, mask):
        """
        Apply morphological operations to reduce noise.
        
        Args:
            mask: Binary mask from background subtraction
            
        Returns:
            Filtered mask
        """
        kernel = np.ones((self.kernel_size, self.kernel_size), np.uint8)
        
        # Apply opening to remove small noise
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Apply closing to fill small holes
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        
        return mask
    
    def find_contours(self, mask):
        """Find contours in binary mask."""
        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        return contours
    
    def get_contour_info(self, contour):
        """
        Extract useful information from a contour.
        
        Returns:
            Dictionary with center, area, bounding rect, etc.
        """
        if contour is None or len(contour) == 0:
            return None
            
        # Calculate moments and center
        M = cv2.moments(contour)
        if M["m00"] == 0:
            return None
            
        center_x = int(M["m10"] / M["m00"])
        center_y = int(M["m01"] / M["m00"])
        
        # If ROI is active, adjust coordinates relative to screen
        if self.roi:
            roi_x, roi_y, _, _ = self.roi
            center_x += roi_x
            center_y += roi_y
        
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)
        
        # Calculate area
        area = cv2.contourArea(contour)
        
        return {
            "center": (center_x, center_y),
            "area": area,
            "bounding_rect": (x, y, w, h),
            "contour": contour
        }
    
    def detect_motion(self, min_frames=3):
        """
        Detect sustained motion over multiple frames.
        
        Args:
            min_frames: Minimum number of consecutive frames with motion
            
        Returns:
            List of motion objects with trajectory information
        """
        motion_history = []
        frame_count = 0
        motion_detected = 0
        
        while frame_count < min_frames + 5:  # Capture extra frames for analysis
            frame = self.capture_screen()
            _, mask, contours = self.apply_subtraction(frame)
            
            frame_objects = []
            for contour in contours:
                info = self.get_contour_info(contour)
                if info:
                    frame_objects.append(info)
            
            if frame_objects:
                motion_detected += 1
            else:
                motion_detected = max(0, motion_detected - 1)  # Decay counter if no motion
            
            motion_history.append(frame_objects)
            frame_count += 1
            
            # Sleep briefly to capture temporal information
            time.sleep(0.05)
        
        # Check if we have consistent motion
        if motion_detected >= min_frames:
            # Analyze trajectory of detected objects
            trajectories = self.analyze_trajectories(motion_history)
            return trajectories
        
        return []
    
    def analyze_trajectories(self, motion_history):
        """
        Analyze object trajectories across multiple frames.
        
        Args:
            motion_history: List of frame objects
            
        Returns:
            List of trajectory objects
        """
        # Dictionary to store trajectories by object ID
        trajectories = {}
        
        for frame_idx, frame_objects in enumerate(motion_history):
            # Skip empty frames
            if not frame_objects:
                continue
                
            # Match objects to existing trajectories or create new ones
            unmatched_trajectories = list(trajectories.keys())
            
            for obj in frame_objects:
                matched = False
                
                # Try to match with existing trajectories
                for traj_id in unmatched_trajectories[:]:
                    traj = trajectories[traj_id]
                    last_pos = traj["positions"][-1]
                    
                    # Calculate distance to last known position
                    dist = np.sqrt((obj["center"][0] - last_pos[0])**2 + 
                                  (obj["center"][1] - last_pos[1])**2)
                    
                    # If close enough, consider it the same object
                    if dist < 50:  # Threshold distance for same object
                        # Add to trajectory
                        traj["positions"].append(obj["center"])
                        traj["frame_idxs"].append(frame_idx)
                        traj["areas"].append(obj["area"])
                        
                        # Update bounding rect
                        traj["bounding_rects"].append(obj["bounding_rect"])
                        
                        # Remove from unmatched list
                        unmatched_trajectories.remove(traj_id)
                        matched = True
                        break
                
                # If no match found, create new trajectory
                if not matched:
                    new_id = len(trajectories)
                    trajectories[new_id] = {
                        "positions": [obj["center"]],
                        "frame_idxs": [frame_idx],
                        "areas": [obj["area"]],
                        "bounding_rects": [obj["bounding_rect"]]
                    }
        
        # Convert to list and calculate velocity and direction
        result = []
        for traj_id, traj in trajectories.items():
            # Need at least 2 points for velocity
            if len(traj["positions"]) >= 2:
                # Calculate average velocity
                velocity_vectors = []
                for i in range(1, len(traj["positions"])):
                    p1 = traj["positions"][i-1]
                    p2 = traj["positions"][i]
                    dt = traj["frame_idxs"][i] - traj["frame_idxs"][i-1]
                    
                    # Skip if frames are not consecutive
                    if dt == 0:
                        continue
                        
                    # Calculate velocity vector
                    vx = (p2[0] - p1[0]) / dt
                    vy = (p2[1] - p1[1]) / dt
                    velocity_vectors.append((vx, vy))
                
                if velocity_vectors:
                    # Calculate average velocity
                    avg_vx = sum(v[0] for v in velocity_vectors) / len(velocity_vectors)
                    avg_vy = sum(v[1] for v in velocity_vectors) / len(velocity_vectors)
                    
                    # Calculate speed and direction
                    speed = np.sqrt(avg_vx**2 + avg_vy**2)
                    direction = np.arctan2(avg_vy, avg_vx) * 180 / np.pi  # in degrees
                    
                    # Add to result
                    result.append({
                        "id": traj_id,
                        "positions": traj["positions"],
                        "velocity": (avg_vx, avg_vy),
                        "speed": speed,
                        "direction": direction,
                        "frame_count": len(traj["positions"]),
                        "areas": traj["areas"],
                        "bounding_rects": traj["bounding_rects"]
                    })
        
        return result

    def visualize_results(self, frame, contours, trajectories=None):
        """
        Visualize detection results.
        
        Args:
            frame: Original frame
            contours: Detected contours
            trajectories: Optional trajectory information
            
        Returns:
            Visualization frame
        """
        # Create a copy for visualization
        vis_frame = frame.copy()
        
        # Draw contours
        cv2.drawContours(vis_frame, contours, -1, (0, 255, 0), 2)
        
        # Draw trajectories if available
        if trajectories:
            for traj in trajectories:
                # Draw trajectory line
                points = np.array(traj["positions"], dtype=np.int32)
                cv2.polylines(vis_frame, [points.reshape((-1, 1, 2))], False, (0, 0, 255), 2)
                
                # Draw current position
                current_pos = traj["positions"][-1]
                cv2.circle(vis_frame, current_pos, 5, (255, 0, 0), -1)
                
                # Draw direction vector
                if "velocity" in traj:
                    vx, vy = traj["velocity"]
                    # Scale vector for visibility
                    scale = 10
                    end_x = int(current_pos[0] + vx * scale)
                    end_y = int(current_pos[1] + vy * scale)
                    cv2.arrowedLine(vis_frame, current_pos, (end_x, end_y), (255, 0, 255), 2)
        
        return vis_frame

# Example usage
if __name__ == "__main__":
    # Create background subtractor
    subtractor = BackgroundSubtractor(history=50, threshold=24, detect_shadows=True)
    
    # Optional: Set region of interest
    # subtractor.set_roi(100, 100, 800, 600)
    
    # Customize parameters
    subtractor.set_learning_rate(0.01)
    subtractor.set_min_area(200)
    subtractor.set_kernel_size(5)
    
    try:
        while True:
            # Capture and process frame
            frame = subtractor.capture_screen()
            _, mask, contours = subtractor.apply_subtraction(frame)
            
            # Create visualization
            vis_frame = subtractor.visualize_results(frame, contours)
            
            # Display results
            cv2.imshow("Original", frame)
            cv2.imshow("Foreground Mask", mask)
            cv2.imshow("Detection", vis_frame)
            
            # Periodically check for motion trajectories (less frequently)
            if cv2.waitKey(100) & 0xFF == ord('t'):
                print("Detecting motion trajectories...")
                trajectories = subtractor.detect_motion(min_frames=3)
                
                if trajectories:
                    print(f"Found {len(trajectories)} motion trajectory(ies):")
                    for t in trajectories:
                        print(f"ID: {t['id']}, Frames: {t['frame_count']}, Speed: {t['speed']:.2f}")
                        print(f"Direction: {t['direction']:.2f} degrees")
                        print("---")
                else:
                    print("No significant motion detected.")
                    
            # Exit on 'q' key
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
    except KeyboardInterrupt:
        pass
        
    cv2.destroyAllWindows()
