import React, { useEffect, lazy, Suspense } from "react";
import { Route, Switch, Redirect } from "wouter";
import { HelmetProvider } from "react-helmet-async";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { GamificationProvider } from "@/contexts/GamificationContext";
import { GlobalSearchModal } from "@/components/search/GlobalSearchModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { io } from "socket.io-client";
import { ProtectedRoute, PublicRoute } from "@/components/ProtectedRoute";
import { clientConfig } from "@/lib/config";
import { registerServiceWorker } from "@/utils/serviceWorker";


const PageLoader = () => (
  <div
    className="fixed inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md z-[9999]"
    role="status"
    aria-live="polite"
    aria-label="Loading"
  >
    <div className="relative">
      <div className="absolute inset-0 bg-[#008060] rounded-full blur-xl opacity-20 animate-pulse"></div>
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
        <div
          className="absolute inset-0 border-4 border-[#008060] rounded-full animate-spin"
          style={{ borderTopColor: 'transparent', borderLeftColor: 'transparent', animationDuration: '0.8s' }}
        ></div>
        <span className="text-2xl sm:text-3xl font-bold text-[#008060] animate-pulse">T</span>
      </div>
    </div>
    <div className="mt-6 flex flex-col items-center gap-2">
      <p className="text-base sm:text-lg font-bold bg-gradient-to-r from-[#008060] to-[#006b51] bg-clip-text text-transparent">The Kalyani School</p>
      <p className="text-xs sm:text-sm font-medium text-gray-400 tracking-widest uppercase">Alumni Portal</p>
    </div>
  </div>
);



// Lazy load pages for code-splitting
// Public pages - critical, keep eager loaded for landing page
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SetupPasswordPage } from "@/pages/SetupPasswordPage";
import { ContactUsPage } from "@/pages/ContactUsPage";
import { StudentSignupPage } from "@/pages/StudentSignupPage";
import AlumniMapPage from "./pages/AlumniMapPage";
const LinkedInWelcomePage = lazy(() => import("@/pages/LinkedInWelcomePage").then(m => ({ default: m.LinkedInWelcomePage })));

// User pages - lazy loaded
const FeedPage = lazy(() => import("@/pages/FeedPage").then(m => ({ default: m.FeedPage })));
const JobPortalPage = lazy(() => import("@/pages/JobPortalPage").then(m => ({ default: m.JobPortalPage })));
const EventsPage = lazy(() =>
  import("@/pages/EventsPage")
    .then(m => ({ default: m.EventsPage }))
    .catch(err => {
      console.error("Failed to load EventsPage:", err);
      throw err;
    })
);
const ConnectionsPage = lazy(() => import("@/pages/ConnectionsPage").then(m => ({ default: m.ConnectionsPage })));
const InboxPage = lazy(() => import("@/pages/InboxPage").then(m => ({ default: m.InboxPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const NotificationHistoryPage = lazy(() => import("@/pages/NotificationHistoryPage").then(m => ({ default: m.NotificationHistoryPage })));
const UserProfilePage = lazy(() => import("@/pages/UserProfilePage").then(m => ({ default: m.UserProfilePage })));
const PublicProfilePage = lazy(() => import("@/pages/PublicProfilePage").then(m => ({ default: m.PublicProfilePage })));
const MentorshipPage = lazy(() => import("@/pages/MentorshipPage").then(m => ({ default: m.MentorshipPage })));

// Forum pages - lazy loaded
const ForumsPage = lazy(() => import("@/pages/ForumsPage").then(m => ({ default: m.ForumsPage })));
const ForumThreadPage = lazy(() => import("@/pages/ForumThreadPage").then(m => ({ default: m.ForumThreadPage })));
const ForumNewThreadPage = lazy(() => import("@/pages/ForumNewThreadPage").then(m => ({ default: m.ForumNewThreadPage })));
const ForumCategoryPage = lazy(() => import("@/pages/ForumCategoryPage").then(m => ({ default: m.ForumCategoryPage })));

// Blog pages - lazy loaded
const BlogsPage = lazy(() => import("@/pages/BlogsPage").then(m => ({ default: m.BlogsPage })));
const BlogDetailPage = lazy(() => import("@/pages/BlogDetailPage").then(m => ({ default: m.BlogDetailPage })));
const AdminBlogsPage = lazy(() => import("@/pages/AdminBlogsPage").then(m => ({ default: m.AdminBlogsPage })));
const TravelChaptersDirectoryPage = lazy(() => import("@/pages/TravelChaptersDirectoryPage").then(m => ({ default: m.default })));
const TravelChapterPage = lazy(() => import("@/pages/TravelChapterPage").then(m => ({ default: m.default })));
const PodcastPage = lazy(() => import("@/pages/PodcastPage").then(m => ({ default: m.PodcastPage })));
const AdminPodcastsPage = lazy(() => import("@/pages/AdminPodcastsPage").then(m => ({ default: m.AdminPodcastsPage })));
const AdminNewslettersPage = lazy(() =>
  import("@/pages/AdminNewslettersPage")
    .then(m => ({ default: m.AdminNewslettersPage }))
    .catch(err => { console.error("Failed to load AdminNewslettersPage:", err); throw err; })
);
const AdminNewsletterComposerPage = lazy(() =>
  import("@/pages/AdminNewsletterComposerPage")
    .then(m => ({ default: m.AdminNewsletterComposerPage }))
    .catch(err => { console.error("Failed to load AdminNewsletterComposerPage:", err); throw err; })
);
const NewslettersPage = lazy(() =>
  import("@/pages/NewslettersPage")
    .then(m => ({ default: m.NewslettersPage }))
    .catch(err => { console.error("Failed to load NewslettersPage:", err); throw err; })
);

// Admin pages - lazy loaded (rarely accessed by most users)
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AdminEventsPage = lazy(() => import("./pages/AdminEventsPage").then(m => ({ default: m.AdminEventsPage })));
const AdminMessagesPage = lazy(() => import("@/pages/AdminMessagesPage").then(m => ({ default: m.AdminMessagesPage })));
const AdminImportPage = lazy(() => import("./pages/AdminImportPage").then(m => ({ default: m.default })));
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage").then(m => ({ default: m.AdminLoginPage })));
const AdminUserEditPage = lazy(() => import("./pages/AdminUserEditPage").then(m => ({ default: m.AdminUserEditPage })));
const AdminFeedPage = lazy(() => import("./pages/AdminFeedPage").then(m => ({ default: m.AdminFeedPage })));
const AdminJobsPage = lazy(() => import("@/pages/AdminJobsPage").then(m => ({ default: m.AdminJobsPage })));
const AdminBulkEmailPage = lazy(() => import("./pages/AdminBulkEmailPage").then(m => ({ default: m.default })));
const AdminInboxPage = lazy(() => import("@/pages/AdminInboxPage").then(m => ({ default: m.AdminInboxPage })));
const AdminGamificationPage = lazy(() => import("@/pages/AdminGamificationPage").then(m => ({ default: m.AdminGamificationPage })));
const AdminLocationExportPage = lazy(() => import("./pages/AdminLocationExportPage").then(m => ({ default: m.default })));
const AdminTravelChaptersPage = lazy(() => import("@/pages/AdminTravelChaptersPage").then(m => ({ default: m.default })));

// Other pages - lazy loaded
const SharedPostPage = lazy(() => import("./pages/SharedPostPage").then(m => ({ default: m.SharedPostPage })));
const NotFound = lazy(() => import("@/pages/not-found").then(m => ({ default: m.default })));

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ErrorBoundary>
        <Switch>
          {/* Public Routes - Authenticated users are redirected to portal */}
          <Route path="/" component={LandingPage} />
          <PublicRoute path="/login" component={LoginPage} />
          <PublicRoute path="/signup" component={SignupPage} />
          <PublicRoute path="/student-signup" component={StudentSignupPage} />
          <PublicRoute path="/forgot-password" component={ForgotPasswordPage} />
          <PublicRoute path="/reset-password" component={ResetPasswordPage} />
          <PublicRoute path="/setup-password" component={SetupPasswordPage} />
          <PublicRoute path="/contact" component={ContactUsPage} />
          <PublicRoute path="/linkedin-welcome" component={LinkedInWelcomePage} />
          <PublicRoute path="/admin/login" component={AdminLoginPage} />
          
          <Route path="/admin" component={() => <Redirect to="/admin/dashboard" />} />
          <ProtectedRoute path="/admin/signup-requests" component={AdminDashboard} adminOnly />
          <Route path="/post/:postId" component={SharedPostPage} />


          {/* Protected User Routes */}
          <ProtectedRoute path="/feed" component={FeedPage} />
          <ProtectedRoute path="/job-portal" component={JobPortalPage} />
          <ProtectedRoute path="/events" component={EventsPage} />
          <ProtectedRoute path="/connections" component={ConnectionsPage} />
          <ProtectedRoute path="/alumni-map" component={AlumniMapPage} />
          <ProtectedRoute path="/inbox" component={InboxPage} />
          <ProtectedRoute path="/settings" component={SettingsPage} />
          <ProtectedRoute path="/notifications/history" component={NotificationHistoryPage} />
          <ProtectedRoute path="/profile" component={UserProfilePage} />
          <ProtectedRoute path="/profile/:userId" component={PublicProfilePage} />
          <ProtectedRoute path="/mentorship" component={MentorshipPage} />
          <ProtectedRoute path="/forums" component={ForumsPage} />
          <ProtectedRoute path="/forums/new" component={ForumNewThreadPage} />
          <ProtectedRoute path="/forums/thread/:id" component={ForumThreadPage} />
          <ProtectedRoute path="/forums/category/:slug" component={ForumCategoryPage} />
          <ProtectedRoute path="/blogs" component={BlogsPage} />
          <ProtectedRoute path="/blogs/:slug" component={BlogDetailPage} />
          <ProtectedRoute path="/travel-chapters" component={TravelChaptersDirectoryPage} />
          <ProtectedRoute path="/podcast" component={PodcastPage} />
          <ProtectedRoute path="/podcasts/:slug" component={PodcastPage} />
          <ProtectedRoute path="/newsletters" component={NewslettersPage} />
          <ProtectedRoute path="/newsletters/:slug" component={NewslettersPage} />
          <ProtectedRoute path="/travel-chapters/:id" component={TravelChapterPage} />

          {/* Protected Admin Routes */}
          <ProtectedRoute path="/admin/dashboard" component={AdminDashboard} adminOnly />
          <ProtectedRoute path="/admin/analytics" component={AdminDashboard} adminOnly />
          <ProtectedRoute path="/admin/bulk-email" component={AdminBulkEmailPage} adminOnly />
          <ProtectedRoute path="/admin/users" component={AdminDashboard} adminOnly />
          <ProtectedRoute path="/admin/feed" component={AdminFeedPage} adminOnly />
          <ProtectedRoute path="/admin/events" component={AdminEventsPage} adminOnly />
          <ProtectedRoute path="/admin/messages" component={AdminMessagesPage} adminOnly />
          <ProtectedRoute path="/admin/jobs" component={AdminJobsPage} adminOnly />
          <ProtectedRoute path="/admin/users/:userId/edit" component={AdminUserEditPage} adminOnly />
          <ProtectedRoute path="/admin/import" component={AdminImportPage} adminOnly />
          <ProtectedRoute path="/admin/inbox" component={AdminInboxPage} adminOnly />
          <ProtectedRoute path="/admin/gamification" component={AdminGamificationPage} adminOnly />
          <ProtectedRoute path="/admin/location-export" component={AdminLocationExportPage} adminOnly />
          <ProtectedRoute path="/admin/blogs" component={AdminBlogsPage} adminOnly />
          <ProtectedRoute path="/admin/podcasts" component={AdminPodcastsPage} adminOnly />
          <ProtectedRoute path="/admin/travel-chapters" component={AdminTravelChaptersPage} adminOnly />
          <ProtectedRoute path="/admin/newsletters/new" component={AdminNewsletterComposerPage} adminOnly />
          <ProtectedRoute path="/admin/newsletters/:id/edit" component={AdminNewsletterComposerPage} adminOnly />
          <ProtectedRoute path="/admin/newsletters" component={AdminNewslettersPage} adminOnly />

          {/* Fallback to 404 */}
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </Suspense>
  );
}


function App() {
  // Register service worker for push notifications - only in production
  useEffect(() => {
    if (import.meta.env.PROD) {
      registerServiceWorker();
    } else {
      // FORCE UNREGISTER in development to fix "sw.js" issues
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          let unregisterPromise = Promise.resolve(false);

          if (registrations.length > 0) {
            unregisterPromise = Promise.all(registrations.map(r => r.unregister())).then(() => true);
            console.log('🚧 Unregistered development service workers');
          }

          unregisterPromise.then((wasUnregistered) => {
            if (wasUnregistered) {
              console.log('🔄 Reloading to apply Service Worker removal...');
              window.location.reload();
            }
          });
        });
      }
    }
  }, []);

  useEffect(() => {
    // Check for either user session or admin session
    let userId = localStorage.getItem('userId');

    // If no regular user ID, check for admin user
    if (!userId) {
      const adminUserStr = localStorage.getItem('adminUser');
      if (adminUserStr) {
        try {
          const adminUser = JSON.parse(adminUserStr);
          userId = adminUser.id;
        } catch {
          // Silently fail - admin user parsing error is not critical
          console.error('Failed to parse admin user from storage');
        }
      }
    }

    if (userId) {
      // Connect to the server using centralized config
      const serverUrl = clientConfig.apiUrl;

      // console.log('Connecting Socket.IO to:', serverUrl);

      const socket = io(serverUrl, {
        auth: {
          token: userId
        },
        transports: ['polling', 'websocket'], // Try polling first, then websocket
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        path: '/socket.io/' // Explicitly set the path
      });


      socket.on('connect', () => {
        // console.log('Socket.IO connected');
        socket.emit('authenticate', userId);
      });

      socket.on('notification', (data) => {
        // console.log('Received notification:', data);
        // Trigger notification count refresh
        window.dispatchEvent(new CustomEvent('new-notification', { detail: data }));
      });

      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
      });

      socket.on('disconnect', () => {
        // console.log('Socket.IO disconnected');
      });

      return () => {
        socket.disconnect();
      };
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <AuthProvider>
            <SearchProvider>
              <NotificationProvider>
                <GamificationProvider>
                  <TooltipProvider>
                    <Router />
                    <GlobalSearchModal />
                    <Toaster />
                  </TooltipProvider>
                </GamificationProvider>
              </NotificationProvider>
            </SearchProvider>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
