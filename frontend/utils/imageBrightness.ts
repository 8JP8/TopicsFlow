/**
 * Utility functions for analyzing image brightness to determine text color
 */

/**
 * Analyze image brightness and return whether text should be light or dark
 * @param imageUrl - URL or base64 data URL of the image
 * @returns Promise<boolean> - true if image is dark (use light text), false if light (use dark text)
 */
export async function analyzeImageBrightness(imageUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          // Fallback: assume dark if we can't analyze
          resolve(true);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        // Sample pixels from the image (sample every 10th pixel for performance)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let totalBrightness = 0;
        let pixelCount = 0;
        
        // Sample pixels (every 10th pixel for performance)
        for (let i = 0; i < data.length; i += 40) { // 40 = 4 bytes per pixel * 10
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calculate brightness using relative luminance formula
          // Y = 0.299*R + 0.587*G + 0.114*B
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          totalBrightness += brightness;
          pixelCount++;
        }
        
        const averageBrightness = totalBrightness / pixelCount;
        
        // If average brightness is less than 0.5, image is dark (use light text)
        // If average brightness is >= 0.5, image is light (use dark text)
        resolve(averageBrightness < 0.5);
      } catch (error) {
        console.error('Error analyzing image brightness:', error);
        // Fallback: assume dark
        resolve(true);
      }
    };
    
    img.onerror = () => {
      // On error, assume dark background (use light text)
      resolve(true);
    };
    
    // Set src after setting up handlers
    img.src = imageUrl;
  });
}

/**
 * Get text color class based on image brightness
 * @param isDark - true if image is dark, false if light
 * @param isLightMode - true if app is in light mode
 * @returns string - CSS classes for text color
 */
export function getTextColorClass(isDark: boolean, isLightMode: boolean): string {
  if (isDark) {
    // Dark image: use light text
    return 'text-white';
  } else {
    // Light image: use dark text
    return isLightMode ? 'text-gray-900' : 'text-gray-100';
  }
}

