
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { LinkedInSyncModal } from "./LinkedInSyncModal";

interface LinkedInIntegrationProps {
  hasPendingChanges?: boolean;
  onSaveRequested?: () => void;
}

export const LinkedInIntegration: React.FC<LinkedInIntegrationProps> = ({
  hasPendingChanges = false,
  onSaveRequested
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkLinkedInStatus();

    // Handle OAuth callback status
    const params = new URLSearchParams(window.location.search);
    const linkedinStatus = params.get('linkedin');
    const reason = params.get('reason');
    const code = params.get('code');

    if (linkedinStatus === 'connected') {
      toast({
        title: "✓ LinkedIn Connected!",
        description: "Your profile has been successfully connected.",
      });
      window.history.replaceState({}, '', '/profile');
      checkLinkedInStatus();
      // Auto-trigger mismatch check on successful connection
      checkMismatches();
    } else if (linkedinStatus === 'error') {
      let errorMessage = "Failed to connect LinkedIn";

      switch (reason) {
        case 'table_missing':
          errorMessage = "Database configuration error. Please contact support to run the SQL migration.";
          break;
        case 'token_exchange_failed':
          errorMessage = "Failed to exchange authorization code. Please try again.";
          break;
        case 'db_save_failed':
          errorMessage = `Failed to save LinkedIn data${code ? ` (Error: ${code})` : ''}. Please try again.`;
          break;
        case 'missing_params':
          errorMessage = "Invalid callback parameters. Please try again.";
          break;
        case 'invalid_state':
          errorMessage = "Security validation failed. Please try again.";
          break;
        case 'no_access_token':
          errorMessage = "Failed to obtain access token. Please try again.";
          break;
        default:
          errorMessage = `Connection failed: ${reason || 'Unknown error'}`;
      }

      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/profile');
    }
  }, [toast]);

  const checkLinkedInStatus = async () => {
    try {
      // console.log('[LinkedIn] Checking status...');
      const userId = user?.id || localStorage.getItem('userId');
      // console.log('[LinkedIn] User ID:', userId);

      const response = await fetch('/api/profile/linkedin/status', {
        headers: { 'user-id': userId || '' }
      });


      // console.log('[LinkedIn] Status response:', response.status);

      if (response.ok) {
        const data = await response.json();
        // console.log('[LinkedIn] Status data:', data);
        setIsConnected(data.connected);
      } else {
        console.error('[LinkedIn] Status check failed:', response.statusText);
      }
    } catch (error) {
      console.error('[LinkedIn] Error checking status:', error);
    }
  };

  const handleConnect = async () => {
    // Check for pending changes before connecting
    if (hasPendingChanges) {
      const shouldProceed = window.confirm(
        'You have unsaved changes to your profile. Please save your changes before connecting LinkedIn to avoid losing your updates. Would you like to continue anyway?'
      );

      if (!shouldProceed) {
        // User wants to save first - trigger save action
        if (onSaveRequested) {
          onSaveRequested();
        } else {
          toast({
            title: "Save Changes First",
            description: "Please save your profile changes before connecting LinkedIn.",
            variant: "destructive",
          });
        }
        return;
      }
    }

    try {
      // console.log('[LinkedIn] Initiating connection...');
      const userId = user?.id || localStorage.getItem('userId');
      // console.log('[LinkedIn] User ID:', userId);

      const response = await fetch('/api/auth/linkedin', {
        headers: { 'user-id': userId || '' }
      });

      // console.log('[LinkedIn] Connect response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[LinkedIn] Connect failed:', errorData);
        toast({
          title: "Connection Failed",
          description: errorData.details || errorData.error || "Failed to connect LinkedIn",
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();
      // console.log('[LinkedIn] Auth URL received, redirecting...');
      // console.log('[LinkedIn] Auth URL length:', data.authUrl?.length);

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error) {
      console.error('[LinkedIn] Connect error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect LinkedIn",
        variant: "destructive",
      });
    }
  };



  const [showSyncModal, setShowSyncModal] = useState(false);
  const [mismatches, setMismatches] = useState<any[]>([]);

  const checkMismatches = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/profile/linkedin/compare', {
        headers: { 'user-id': userId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.hasMismatches) {
          setMismatches(data.mismatches);
          setShowSyncModal(true);
        } else {
          toast({
            title: "Already In Sync",
            description: "Your profile matches your LinkedIn data.",
          });
        }
      } else {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Your LinkedIn connection has expired. Please reconnect your account.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('[LinkedIn] Error checking mismatches:', error);
    }
  };

  const handleSync = async () => {
    // Check for pending changes before refreshing
    if (hasPendingChanges) {
      const shouldProceed = window.confirm(
        'You have unsaved changes to your profile. Refreshing LinkedIn data may overwrite your unsaved changes. Please save your changes first, or continue to refresh anyway?'
      );

      if (!shouldProceed) {
        // User wants to save first - trigger save action
        if (onSaveRequested) {
          onSaveRequested();
        } else {
          toast({
            title: "Save Changes First",
            description: "Please save your profile changes before refreshing LinkedIn data.",
            variant: "destructive",
          });
        }
        return;
      }
    }

    setLoading(true);
    await checkMismatches();
    setLoading(false);
  };

  const confirmSync = async (selectedFields: string[]) => {
    if (selectedFields.length === 0) {
      setShowSyncModal(false);
      return;
    }

    setLoading(true);
    try {
      const userId = user?.id || localStorage.getItem('userId');

      // Map frontend fields back to backend sync groups
      const syncFields = [];
      if (selectedFields.includes('profile_picture')) syncFields.push('profile_photo');
      if (selectedFields.includes('first_name') || selectedFields.includes('last_name') || selectedFields.includes('email')) {
        syncFields.push('basic_info');
      }

      const response = await fetch('/api/profile/linkedin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          syncFields,
          requestedFields: selectedFields,
          forceOverwrite: true
        })
      });

      if (response.ok) {
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully synced with LinkedIn.",
        });
        window.dispatchEvent(new Event('profileUpdated'));
        setShowSyncModal(false);
      } else {
        if (response.status === 401) {
          toast({
            title: "Session Expired",
            description: "Your LinkedIn connection has expired. Please reconnect your account.",
            variant: "destructive",
          });
          setShowSyncModal(false);
        } else {
          const errorData = await response.json();
          toast({
            title: "Sync Failed",
            description: errorData.error || "Failed to update profile",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sync LinkedIn data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/profile/linkedin', {
        method: 'DELETE',
        headers: { 'user-id': userId || '' }
      });

      if (response.ok) {
        setIsConnected(false);
        toast({
          title: "Success",
          description: "LinkedIn disconnected successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect LinkedIn",
        variant: "destructive",
      });
    }
  };

  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) {
      checkLinkedInStatus().then(() => {
        // Get last sync time from integration
        const userId = user?.id || localStorage.getItem('userId');
        fetch('/api/profile/linkedin/status', {
          headers: { 'user-id': userId || '' }
        }).then(res => res.json()).then(data => {
          if (data.integration?.last_sync_at) {
            setLastSyncTime(data.integration.last_sync_at);
          }
        });
      });
    }
  }, [isConnected]);

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0">
              in
            </div>
            <div className="min-w-0 flex-1">
              <Label className="text-base sm:text-lg font-semibold block mb-1">
                {isConnected ? 'LinkedIn Connected' : 'Connect LinkedIn Account'}
              </Label>
              <p className="text-xs sm:text-sm text-gray-600 break-words">
                {isConnected
                  ? lastSyncTime
                    ? `Last synced: ${new Date(lastSyncTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
                    : 'Manage your LinkedIn sync'
                  : 'Auto-sync your professional profile data'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            {!isConnected ? (
              <Button 
                onClick={handleConnect} 
                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px] sm:min-h-[auto] text-sm sm:text-base px-4 sm:px-6"
              >
                Connect LinkedIn
              </Button>
            ) : (
              <Button 
                onClick={handleDisconnect} 
                variant="outline" 
                className="border-red-500 text-red-500 hover:bg-red-50 w-full sm:w-auto min-h-[44px] sm:min-h-[auto] text-sm sm:text-base px-4 sm:px-6"
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </div>

      {isConnected && (
        <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-4">
          <div>
            <Label className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 block">Synced Data</Label>
            <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">Data imported from your LinkedIn profile</p>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-green-50 border border-green-200 rounded">
                <div className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0">✓</div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-medium text-green-800 block mb-0.5 sm:mb-1">Profile Photo</span>
                  <p className="text-[10px] sm:text-xs text-green-600 break-words">Your LinkedIn profile picture</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-green-50 border border-green-200 rounded">
                <div className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs shrink-0">✓</div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-medium text-green-800 block mb-0.5 sm:mb-1">Basic Information</span>
                  <p className="text-[10px] sm:text-xs text-green-600 break-words">Name and email address</p>
                </div>
              </div>
              <div className="p-2.5 sm:p-3 bg-amber-50 border border-amber-200 rounded mt-3 sm:mt-4">
                <p className="text-[10px] sm:text-xs text-amber-700 leading-relaxed">
                  <strong>Note:</strong> We can automatically sync your basic profile information (name, email, and profile photo) from LinkedIn.
                  For a complete profile, please add your work experience, education, and skills manually in the sections below.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <Button
              onClick={handleSync}
              disabled={loading}
              variant="outline"
              className="w-full min-h-[44px] sm:min-h-[auto] text-sm sm:text-base"
              data-testid="button-resync-linkedin"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-xs sm:text-sm">Refreshing...</span>
                </span>
              ) : (
                <span className="text-xs sm:text-sm sm:text-base">Refresh LinkedIn Data</span>
              )}
            </Button>
            <p className="text-[10px] sm:text-xs text-center text-gray-500 mt-2 px-2">
              Updates your profile photo and basic info from LinkedIn
            </p>
          </div>
        </div>
      )}

      <LinkedInSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        mismatches={mismatches}
        onConfirm={confirmSync}
        isLoading={loading}
      />
    </>
  );
};
