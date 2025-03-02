import cv2
import numpy as np
import pyautogui
import tkinter as tk
from tkinter import ttk

class HSVCalibrator:
    def __init__(self):
        # Initialize GUI
        self.root = tk.Tk()
        self.root.title("HSV Color Calibration")
        self.root.geometry("800x600")
        
        # Screenshot and region selection variables
        self.screenshot = None
        self.region = None
        self.roi_start = None
        self.roi_end = None
        self.selecting_roi = False
        
        # HSV range variables
        self.h_low = tk.IntVar(value=0)
        self.s_low = tk.IntVar(value=0)
        self.v_low = tk.IntVar(value=0)
        self.h_high = tk.IntVar(value=179)
        self.s_high = tk.IntVar(value=255)
        self.v_high = tk.IntVar(value=255)
        
        # Create frames
        self.control_frame = ttk.Frame(self.root, padding="10")
        self.control_frame.pack(side=tk.LEFT, fill=tk.Y)
        
        self.image_frame = ttk.Frame(self.root)
        self.image_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # Create canvas for displaying images
        self.canvas = tk.Canvas(self.image_frame)
        self.canvas.pack(fill=tk.BOTH, expand=True)
        
        # Add canvas click handlers for ROI selection
        self.canvas.bind("<ButtonPress-1>", self.on_mouse_down)
        self.canvas.bind("<B1-Motion>", self.on_mouse_move)
        self.canvas.bind("<ButtonRelease-1>", self.on_mouse_up)
        
        # Create controls
        self.create_controls()
        
        # Take initial screenshot
        self.take_screenshot()
        
    def create_controls(self):
        """Create sliders and buttons for the control panel"""
        # Screenshot button
        ttk.Button(self.control_frame, text="Take Screenshot", 
                  command=self.take_screenshot).pack(fill=tk.X, pady=5)
        
        # ROI selection instructions
        ttk.Label(self.control_frame, 
                 text="Click and drag on the image to select ROI").pack(pady=5)
        
        # HSV slider frames
        hsv_frame = ttk.LabelFrame(self.control_frame, text="HSV Range")
        hsv_frame.pack(fill=tk.X, pady=10)
        
        # Hue sliders
        ttk.Label(hsv_frame, text="Hue").pack(anchor=tk.W)
        ttk.Scale(hsv_frame, from_=0, to=179, variable=self.h_low, 
                 command=lambda _: self.update_mask()).pack(fill=tk.X)
        ttk.Scale(hsv_frame, from_=0, to=179, variable=self.h_high, 
                 command=lambda _: self.update_mask()).pack(fill=tk.X)
        
        # Saturation sliders
        ttk.Label(hsv_frame, text="Saturation").pack(anchor=tk.W, pady=(10, 0))
        ttk.Scale(hsv_frame, from_=0, to=255, variable=self.s_low, 
                 command=lambda _: self.update_mask()).pack(fill=tk.X)
        ttk.Scale(hsv_frame, from_=0, to=255, variable=self.s_high, 
                 command=lambda _: self.update_mask()).pack(fill=tk.X)
        
        # Value sliders
        ttk.Label(hsv_frame, text="Value").pack(anchor=tk.W, pady=(10, 0))
        ttk.Scale(hsv_frame, from_=0, to=255, variable=self.v_low, 
                 command=lambda _: self.update_mask()).pack(fill=tk.X)
        ttk.Scale(hsv_frame, from_=0, to=255, variable=self.v_high, 
                 command=lambda _: self.update_mask()).pack(fill=tk.X)
        
        # Current values display
        self.value_label = ttk.Label(hsv_frame, text="")
        self.value_label.pack(pady=10)
        
        # Copy to clipboard button
        ttk.Button(self.control_frame, text="Copy HSV Values", 
                  command=self.copy_values).pack(fill=tk.X, pady=5)
    
    def take_screenshot(self):
        """Capture a screenshot and display it on the canvas"""
        # Take screenshot
        pil_screenshot = pyautogui.screenshot()
        self.screenshot = np.array(pil_screenshot)
        self.screenshot = cv2.cvtColor(self.screenshot, cv2.COLOR_RGB2BGR)
        
        # Reset ROI
        self.region = None
        
        # Display on canvas
        self.display_image(self.screenshot)
        
        # Reset mask
        self.update_mask()
    
    def on_mouse_down(self, event):
        """Handle mouse button press for ROI selection"""
        self.selecting_roi = True
        self.roi_start = (event.x, event.y)
        
    def on_mouse_move(self, event):
        """Handle mouse movement during ROI selection"""
        if self.selecting_roi and self.screenshot is not None:
            # Draw rectangle on a copy of the screenshot
            img_copy = self.screenshot.copy()
            cv2.rectangle(img_copy, self.roi_start, (event.x, event.y), (0, 255, 0), 2)
            self.display_image(img_copy)
    
    def on_mouse_up(self, event):
        """Handle mouse release to complete ROI selection"""
        if self.selecting_roi and self.screenshot is not None:
            self.selecting_roi = False
            self.roi_end = (event.x, event.y)
            
            # Calculate ROI coordinates
            x1, y1 = min(self.roi_start[0], self.roi_end[0]), min(self.roi_start[1], self.roi_end[1])
            x2, y2 = max(self.roi_start[0], self.roi_end[0]), max(self.roi_start[1], self.roi_end[1])
            
            # Convert canvas coordinates to image coordinates
            canvas_width = self.canvas.winfo_width()
            canvas_height = self.canvas.winfo_height()
            img_height, img_width = self.screenshot.shape[:2]
            
            # Scale factors
            scale_x = img_width / canvas_width
            scale_y = img_height / canvas_height
            
            # Apply scaling
            x1, y1 = int(x1 * scale_x), int(y1 * scale_y)
            x2, y2 = int(x2 * scale_x), int(y2 * scale_y)
            
            # Store ROI
            self.region = (x1, y1, x2 - x1, y2 - y1)
            
            # Update mask with new ROI
            self.update_mask()
    
    def display_image(self, img):
        """Display an OpenCV image on the canvas"""
        # Convert to RGB for tkinter
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Scale image to fit canvas
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()
        
        if canvas_width > 1 and canvas_height > 1:  # Ensure canvas has valid dimensions
            # Calculate scaling factor
            img_height, img_width = img_rgb.shape[:2]
            scale_x = canvas_width / img_width
            scale_y = canvas_height / img_height
            scale = min(scale_x, scale_y)
            
            # Apply scaling
            new_width = int(img_width * scale)
            new_height = int(img_height * scale)
            img_rgb = cv2.resize(img_rgb, (new_width, new_height))
        
        # Convert to PhotoImage
        from PIL import Image, ImageTk
        pil_img = Image.fromarray(img_rgb)
        self.tk_img = ImageTk.PhotoImage(image=pil_img)
        
        # Update canvas
        self.canvas.config(width=pil_img.width, height=pil_img.height)
        self.canvas.create_image(0, 0, anchor=tk.NW, image=self.tk_img)
    
    def update_mask(self):
        """Update the HSV mask based on current slider values"""
        if self.screenshot is None:
            return
            
        # Get HSV ranges
        hsv_lower = np.array([self.h_low.get(), self.s_low.get(), self.v_low.get()])
        hsv_upper = np.array([self.h_high.get(), self.s_high.get(), self.v_high.get()])
        
        # Update label
        self.value_label.config(
            text=f"Lower: [{hsv_lower[0]}, {hsv_lower[1]}, {hsv_lower[2]}]\n"
                 f"Upper: [{hsv_upper[0]}, {hsv_upper[1]}, {hsv_upper[2]}]"
        )
        
        # Apply ROI if selected
        if self.region:
            x, y, w, h = self.region
            roi = self.screenshot[y:y+h, x:x+w]
        else:
            roi = self.screenshot
        
        # Convert to HSV
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        
        # Create mask
        mask = cv2.inRange(hsv, hsv_lower, hsv_upper)
        
        # Apply mask to original image
        result = cv2.bitwise_and(roi, roi, mask=mask)
        
        # Display the masked result
        if self.region:
            # Create a composite image with ROI highlighted
            display = self.screenshot.copy()
            display[y:y+h, x:x+w] = result
            cv2.rectangle(display, (x, y), (x+w, y+h), (0, 255, 0), 2)
        else:
            display = result
            
        self.display_image(display)
    
    def copy_values(self):
        """Copy the current HSV ranges to clipboard"""
        hsv_lower = [self.h_low.get(), self.s_low.get(), self.v_low.get()]
        hsv_upper = [self.h_high.get(), self.s_high.get(), self.v_high.get()]
        
        text = f"Lower HSV: {hsv_lower}\nUpper HSV: {hsv_upper}"
        self.root.clipboard_clear()
        self.root.clipboard_append(text)
        
        # Flash the button text to indicate copy
        copy_button = self.control_frame.winfo_children()[-1]
        original_text = copy_button["text"]
        copy_button["text"] = "Copied!"
        self.root.after(1000, lambda: copy_button.config(text=original_text))
    
    def run(self):
        """Run the main application loop"""
        self.root.mainloop()

# Run the application
if __name__ == "__main__":
    calibrator = HSVCalibrator()
    calibrator.run()
