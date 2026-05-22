/**
 * Optimized Image Component
 * Supports WebP, responsive images, lazy loading, and CDN
 */

import React, { useState, useEffect } from 'react';
import { getOptimizedImageUrl, generateSrcSet, generateSizes, supportsWebP } from '@/utils/imageOptimization';
import { LazyImage } from './LazyImage';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  quality?: number;
  fallback?: string;
  responsive?: boolean;
  srcSetWidths?: number[];
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  sizes,
  loading = 'lazy',
  quality = 80,
  fallback,
  responsive = false,
  srcSetWidths = [320, 640, 768, 1024, 1280, 1920],
}) => {
  const [optimizedSrc, setOptimizedSrc] = useState<string | null>(null);
  const [webPSupported, setWebPSupported] = useState<boolean | null>(null);
  const [srcSet, setSrcSet] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    // Check WebP support
    supportsWebP().then((supported) => {
      if (isMounted) setWebPSupported(supported);
    });

    // Get optimized URL
    if (src) {
      supportsWebP().then((webPSupported) => {
        if (!isMounted) return;
        
        getOptimizedImageUrl(src, {
          width,
          height,
          quality,
          format: webPSupported ? 'webp' : 'jpg',
        }).then((optimized) => {
          if (isMounted) setOptimizedSrc(optimized);
        });

        // Generate srcset if responsive
        if (responsive && src) {
          const generatedSrcSet = generateSrcSet(src, srcSetWidths);
          if (isMounted) setSrcSet(generatedSrcSet);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [src, width, height, quality, responsive, srcSetWidths]);

  // Generate sizes if not provided
  const imageSizes = sizes || (responsive ? generateSizes() : undefined);

  // Use LazyImage for lazy loading support
  if (loading === 'lazy') {
    return (
      <LazyImage
        src={optimizedSrc || src}
        alt={alt}
        className={className}
        fallback={fallback}
      />
    );
  }

  // Eager loading
  return (
    <img
      src={optimizedSrc || src || fallback}
      alt={alt}
      width={width}
      height={height}
      className={className}
      srcSet={srcSet || undefined}
      sizes={imageSizes}
      loading={loading}
      decoding="async"
      onError={(e) => {
        if (fallback && e.currentTarget.src !== fallback) {
          e.currentTarget.src = fallback;
        }
      }}
    />
  );
};
