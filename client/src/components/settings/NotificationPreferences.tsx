import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToPushNotifications,
  requestPushPermission,
  showLocalNotification,
} from "@/services/push-notification-service";
import { Smartphone, AlertCircle } from "lucide-react";

export const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    checkPushPermission();
  }, []);

  const checkPushPermission = () => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  };

  const handlePushSubscribe = async () => {
    if (!user?.id) return;

    const permission = await requestPushPermission();
    setPushPermission(permission);

    if (permission === 'granted') {
      const subscription = await subscribeToPushNotifications(user.id);
      if (subscription) {
        toast({
          title: "Push Notifications Enabled",
          description: "You'll now receive push notifications",
        });
      }
    } else {
      toast({
        title: "Permission Denied",
        description: "Please enable notifications in your browser settings",
        variant: "destructive",
      });
    }
  };

  const handleTestNotification = () => {
    showLocalNotification('Test Notification', {
      body: 'This is a test notification to verify push notifications are working!',
      icon: '/tks_logo.png',
      badge: '/tks_logo.png',
      tag: 'test',
      data: { url: '/feed' },
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push Notifications Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#008060] flex-shrink-0" />
                <span className="truncate">Browser Push Notifications</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Receive notifications even when the app is closed
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
              {pushPermission === 'granted' ? (
                <>
                  <Button
                    onClick={handleTestNotification}
                    variant="outline"
                    size="sm"
                    className="h-10 text-sm sm:text-base px-4 font-medium border-gray-200 hover:bg-gray-50 hover:text-[#008060] transition-all"
                  >
                    Test Notification
                  </Button>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Enabled
                  </span>
                </>
              ) : (
                <Button
                  onClick={handlePushSubscribe}
                  className="bg-[#008060] hover:bg-[#007055] h-10 text-sm sm:text-base px-6 font-medium shadow-sm hover:shadow-md transition-all"
                  size="sm"
                >
                  Enable Push Notifications
                </Button>
              )}
            </div>
          </div>

        {pushPermission === 'denied' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-yellow-800">
              <p className="font-medium">Notifications are blocked</p>
              <p className="mt-1">Please enable notifications in your browser settings to receive push notifications.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
