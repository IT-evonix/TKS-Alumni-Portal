
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Users, Award, MessageSquare, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const MentorshipPage = (): JSX.Element => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMentor, setIsMentor] = useState(false);
  const [expertiseFilter, setExpertiseFilter] = useState('all');

  useEffect(() => {
    fetchMentors();
  }, [expertiseFilter]);

  const fetchMentors = async () => {
    try {
      const params = new URLSearchParams();
      if (expertiseFilter !== 'all') params.append('expertise', expertiseFilter);

      const response = await fetch(`/api/mentorship/mentors?${params.toString()}`, {
        headers: { 'user-id': user?.id || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setMentors(data.mentors || []);
      }
    } catch (error) {
      console.error('Error fetching mentors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMentorship = async (mentorId: string) => {
    try {
      const response = await fetch('/api/mentorship/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user?.id || ''
        },
        body: JSON.stringify({ mentorId })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Mentorship request sent!',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send request',
        variant: 'destructive'
      });
    }
  };

  const toggleMentorStatus = async () => {
    try {
      const response = await fetch('/api/mentorship/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user?.id || ''
        },
        body: JSON.stringify({ isMentor: !isMentor })
      });

      if (response.ok) {
        setIsMentor(!isMentor);
        toast({
          title: 'Success',
          description: isMentor ? 'Mentor status disabled' : 'You are now a mentor!',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update mentor status',
        variant: 'destructive'
      });
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {/* Mobile Back Button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden flex items-center gap-2 text-gray-600 hover:text-[#008060] mb-2 min-h-[44px]"
            onClick={() => window.history.back()}
            aria-label="Go back"
          >
            <span className="text-xl">←</span>
            <span>Back</span>
          </Button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Alumni Mentorship</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Connect with experienced alumni for guidance</p>
            </div>
            <Button
              onClick={toggleMentorStatus}
              variant={isMentor ? "destructive" : "brand"}
              className="w-full sm:w-auto min-h-[44px] text-sm sm:text-base"
            >
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{isMentor ? 'Disable Mentor Status' : 'Become a Mentor'}</span>
              <span className="sm:hidden">{isMentor ? 'Disable' : 'Become Mentor'}</span>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <Filter className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <Select value={expertiseFilter} onValueChange={setExpertiseFilter}>
                <SelectTrigger className="w-full sm:w-64 min-h-[44px]">
                  <SelectValue placeholder="Filter by expertise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {mentors.map((mentor) => (
              <Card key={mentor.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <Avatar className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                      <AvatarImage src={mentor.profile_picture} />
                      <AvatarFallback className="bg-[#008060] text-white text-sm sm:text-base">
                        {mentor.first_name?.[0]}{mentor.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">{mentor.first_name} {mentor.last_name}</CardTitle>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{mentor.current_position}</p>
                      <p className="text-xs text-gray-500 truncate">{mentor.current_company}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Expertise</p>
                    <div className="flex flex-wrap gap-1">
                      {mentor.expertise?.slice(0, 3).map((exp: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {exp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRequestMentorship(mentor.user_id)}
                    variant="brand"
                    className="w-full min-h-[44px] text-sm sm:text-base"
                    size="sm"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Request Mentorship
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
