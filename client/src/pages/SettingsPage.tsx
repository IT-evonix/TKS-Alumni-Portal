import React, { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AccountSecurity } from "@/components/settings/AccountSecurity";
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";
import { validateName, validateEmail, validateYear, validateTextLength } from "@/utils/validation";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";

export const SettingsPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();


  const [privacySettings, setPrivacySettings] = useState({
    showEmail: false,
    showPhone: false,
    showLocation: true,
    showCompany: true,
  });

  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Fetch current privacy settings
  React.useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const userId = user?.id || localStorage.getItem('userId');
        if (!userId) return;

        const response = await fetch('/api/auth/me', {
          headers: { 'user-id': userId }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.alumni) {
            setPrivacySettings({
              showEmail: data.alumni.show_email ?? false,
              showPhone: data.alumni.show_phone ?? false,
              showLocation: data.alumni.show_location ?? true,
              showCompany: data.alumni.show_company ?? true,
            });
          }
        }
      } catch (error) {
        logError(error, 'SettingsPage.fetchPrivacy');
      }
    };
    fetchPrivacy();
  }, [user]);



  const handleSavePrivacy = async () => {
    setIsSavingPrivacy(true);
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/profile/privacy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          showEmail: privacySettings.showEmail,
          showPhone: privacySettings.showPhone,
          showLocation: privacySettings.showLocation,
          showCompany: privacySettings.showCompany,
        })
      });

      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "Your privacy preferences have been updated.",
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      logError(error, 'SettingsPage.handleSavePrivacy');
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } finally {
      setIsSavingPrivacy(false);
    }
  };





  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <AppLayout currentPage="feed">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-3 sm:p-4 lg:p-6">
          <div className="max-w-4xl mx-auto">
            {/* Mobile Back Button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden flex items-center gap-2 text-gray-600 hover:text-[#008060] mb-3 sm:mb-4 min-h-[44px] min-w-[44px]"
              onClick={() => window.history.back()}
              aria-label="Go back"
            >
              <span className="text-xl">←</span>
              <span className="sm:inline">Back</span>
            </Button>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage your account and preferences</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
          {/* Notification Settings */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg sm:text-xl">Notification Preferences</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <NotificationPreferences />
            </CardContent>
          </Card>



          {/* Account Security */}
          <AccountSecurity />



          {/* Privacy & Security Settings */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Privacy & Security</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="show-email" className="cursor-pointer text-sm sm:text-base">Show Email</Label>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Display email address on your profile</p>
                  </div>
                  <Switch
                    id="show-email"
                    checked={privacySettings.showEmail}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showEmail: checked })}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="show-phone" className="cursor-pointer text-sm sm:text-base">Show Phone</Label>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Display phone number on your profile</p>
                  </div>
                  <Switch
                    id="show-phone"
                    checked={privacySettings.showPhone}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showPhone: checked })}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="show-location" className="cursor-pointer text-sm sm:text-base">Show Location</Label>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Display your current location</p>
                  </div>
                  <Switch
                    id="show-location"
                    checked={privacySettings.showLocation}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showLocation: checked })}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-2 rounded-lg hover:bg-gray-50 transition-colors gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="show-company" className="cursor-pointer text-sm sm:text-base">Show Company</Label>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Display your current company</p>
                  </div>
                  <Switch
                    id="show-company"
                    checked={privacySettings.showCompany}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showCompany: checked })}
                    className="flex-shrink-0"
                  />
                </div>

                <Button
                  variant="brand"
                  className="w-full sm:w-auto mt-2 min-h-[44px] text-sm sm:text-base"
                  onClick={handleSavePrivacy}
                  disabled={isSavingPrivacy}
                >
                  {isSavingPrivacy ? "Saving..." : "Save Privacy Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="border-red-100 bg-red-50/30">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-base sm:text-lg">Session Management</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">Sign out of your current session</p>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="destructive"
                  className="w-full sm:w-auto min-h-[44px] text-sm sm:text-base"
                >
                  Log Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};