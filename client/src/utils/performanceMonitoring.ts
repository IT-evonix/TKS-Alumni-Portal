/**
 * Performance Monitoring Utilities
 * Web Vitals tracking, RUM, and performance budgets
 */

// Dynamic import for web-vitals to handle cases where it might not be installed
let webVitals: any = null;

async function loadWebVitals() {
  if (!webVitals) {
    try {
      webVitals = await import('web-vitals');
    } catch (error) {
      console.warn('[Performance] web-vitals not available:', error);
      return null;
    }
  }
  return webVitals;
}

interface Metric {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: string;
}

interface PerformanceMetrics {
  cls: number | null;
  fid: number | null;
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
  inp: number | null;
}

// Performance budget thresholds
const PERFORMANCE_BUDGETS = {
  fcp: 1800, // First Contentful Paint (ms)
  lcp: 2500, // Largest Contentful Paint (ms)
  fid: 100,  // First Input Delay (ms)
  cls: 0.1,  // Cumulative Layout Shift
  ttfb: 800, // Time to First Byte (ms)
  inp: 200,  // Interaction to Next Paint (ms)
};

// Store metrics
const metrics: PerformanceMetrics = {
  cls: null,
  fid: null,
  fcp: null,
  lcp: null,
  ttfb: null,
  inp: null,
};

/**
 * Send metric to analytics endpoint
 */
function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });

  // Send to analytics endpoint
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/web-vitals', body);
  } else {
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch((error) => {
      console.warn('Failed to send Web Vitals:', error);
    });
  }

  // Store locally (safely handle metric name mapping)
  const metricKey = metric.name.toLowerCase() as keyof PerformanceMetrics;
  if (metricKey in metrics) {
    (metrics as any)[metricKey] = metric.value;
  }

  // Check against budget
  checkPerformanceBudget(metric);
}

/**
 * Check if metric exceeds performance budget
 */
function checkPerformanceBudget(metric: Metric) {
  const budgetKey = metric.name.toLowerCase() as keyof typeof PERFORMANCE_BUDGETS;
  const budget = PERFORMANCE_BUDGETS[budgetKey];

  if (budget && metric.value > budget) {
    console.warn(`[Performance] ${metric.name} exceeds budget: ${metric.value}ms > ${budget}ms`);

    // Optionally send alert
    if (process.env.NODE_ENV === 'production') {
      // Send to monitoring service
      console.error(`[Performance Budget Exceeded] ${metric.name}: ${metric.value}ms`);
    }
  }
}

/**
 * Initialize Web Vitals tracking
 */
export async function initWebVitals() {
  try {
    const vitals = await loadWebVitals();
    if (!vitals) {
      console.warn('[Performance] Web Vitals not available');
      return;
    }

    const { onCLS, onFID, onFCP, onLCP, onTTFB, onINP } = vitals;

    onCLS(sendToAnalytics);
    onFID(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onINP(sendToAnalytics);

    console.log('[Performance] Web Vitals tracking initialized');
  } catch (error) {
    console.warn('[Performance] Web Vitals initialization failed:', error);
  }
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  return { ...metrics };
}

/**
 * Measure custom performance metric
 */
export function measurePerformance(name: string, fn: () => void | Promise<void>): Promise<number> {
  const start = performance.now();

  return Promise.resolve(fn()).then(() => {
    const duration = performance.now() - start;

    // Log to performance API
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    // Send to analytics
    if (duration > 1000) { // Only log slow operations
      console.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  });
}

/**
 * Start performance mark
 */
export function startMark(name: string) {
  performance.mark(`${name}-start`);
}

/**
 * End performance mark and measure
 */
export function endMark(name: string): number {
  const markName = `${name}-start`;
  const endMarkName = `${name}-end`;

  performance.mark(endMarkName);

  try {
    performance.measure(name, markName, endMarkName);
    const measure = performance.getEntriesByName(name)[0];
    return measure.duration;
  } catch (error) {
    console.warn(`[Performance] Failed to measure ${name}:`, error);
    return 0;
  }
}

/**
 * Get navigation timing
 */
export function getNavigationTiming() {
  if (!performance.getEntriesByType) return null;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return null;

  return {
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    request: navigation.responseStart - navigation.requestStart,
    response: navigation.responseEnd - navigation.responseStart,
    dom: navigation.domContentLoadedEventEnd - navigation.responseEnd,
    load: navigation.loadEventEnd - navigation.fetchStart,
    total: navigation.loadEventEnd - navigation.fetchStart,
  };
}

/**
 * Get resource timing
 */
export function getResourceTiming() {
  if (!performance.getEntriesByType) return [];

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  return resources.map((resource) => ({
    name: resource.name,
    duration: resource.duration,
    size: (resource as any).transferSize || 0,
    type: resource.initiatorType,
  }));
}

/**
 * Report performance summary
 */
export function reportPerformanceSummary() {
  const navigation = getNavigationTiming();
  const resources = getResourceTiming();
  const webVitals = getPerformanceMetrics();

  const summary = {
    navigation,
    resources: resources.slice(0, 10), // Top 10 resources
    webVitals,
    timestamp: new Date().toISOString(),
  };

  console.log('[Performance Summary]', summary);

  // Send to analytics
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/performance', JSON.stringify(summary));
  }

  return summary;
}
