/**
 * Image Optimization Utilities
 * WebP support, responsive images, and CDN integration
 */

/**
 * Check if browser supports WebP
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

/**
 * Get optimized image URL
 * Returns WebP if supported, otherwise original format
 */
export async function getOptimizedImageUrl(
  originalUrl: string | null | undefined,
  options?: {
    format?: 'webp' | 'jpg' | 'png';
    width?: number;
    height?: number;
    quality?: number;
  }
): Promise<string | null> {
  if (!originalUrl) return null;

  const { format, width, height, quality = 80 } = options || {};
  
  // If URL is from CDN or already optimized, return as-is
  if (originalUrl.includes('cdn.') || originalUrl.includes('optimized')) {
    return originalUrl;
  }

  // Check WebP support
  const webPSupported = await supportsWebP();
  const targetFormat = format || (webPSupported ? 'webp' : 'jpg');

  // If no optimization needed, return original
  if (!width && !height && targetFormat === 'jpg') {
    return originalUrl;
  }

  // Build optimized URL (assuming image optimization service)
  // In production, this would use a CDN or image optimization service
  const params = new URLSearchParams();
  if (width) params.append('w', width.toString());
  if (height) params.append('h', height.toString());
  if (quality) params.append('q', quality.toString());
  params.append('f', targetFormat);

  // For now, return original (implement CDN integration as needed)
  return originalUrl;
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  baseUrl: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1920]
): string {
  return widths
    .map((width) => `${baseUrl}?w=${width} ${width}w`)
    .join(', ');
}

/**
 * Generate responsive image sizes attribute
 */
export function generateSizes(breakpoints: { [key: string]: string } = {}): string {
  const defaultSizes = {
    '(max-width: 640px)': '100vw',
    '(max-width: 1024px)': '50vw',
    'default': '33vw',
  };

  const sizes = { ...defaultSizes, ...breakpoints };
  
  return Object.entries(sizes)
    .map(([query, size]) => {
      if (query === 'default') {
        return size;
      }
      return `${query} ${size}`;
    })
    .join(', ');
}

/**
 * Optimized Image Component Props
 */
export interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  quality?: number;
  fallback?: string;
}

/**
 * Get image dimensions from URL or metadata
 */
export async function getImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Preload image
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Generate blur placeholder for image
 */
export function generateBlurPlaceholder(width: number = 20, height: number = 20): string {
  // Generate a tiny base64 placeholder
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas.toDataURL();
}
