/**
 * Performance Analytics Routes
 * Handles Web Vitals and performance monitoring data
 */

import { Express } from "express";

export function registerPerformanceAnalyticsRoutes(app: Express) {
  // Store Web Vitals metrics
  app.post("/api/analytics/web-vitals", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { name, value, rating } = req.body;

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Web Vitals]', { name, value, rating, userId: userId || 'anonymous' });
      }

      // Store in database if analytics table exists
      // For now, just log it
      // You can create an analytics table later if needed:
      /*
      await supabase
        .from('performance_analytics')
        .insert({
          user_id: userId || null,
          metric_name: name,
          metric_value: value,
          metric_id: id,
          delta,
          rating,
          navigation_type: navigationType,
          timestamp: new Date().toISOString(),
        });
      */

      res.json({ success: true });
    } catch (error) {
      console.error("Web Vitals analytics error:", error);
      // Don't fail the request if analytics fails
      res.json({ success: false });
    }
  });

  // Store performance summary
  app.post("/api/analytics/performance", async (req, res) => {
    try {
      const userId = req.headers["user-id"] as string;
      const { navigation, resources, webVitals } = req.body;

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Performance Summary]', {
          userId: userId || 'anonymous',
          navigation,
          resourceCount: resources?.length || 0,
          webVitals,
        });
      }

      // Store in database if needed
      // For now, just acknowledge

      res.json({ success: true });
    } catch (error) {
      console.error("Performance analytics error:", error);
      res.json({ success: false });
    }
  });
}
