// src/hooks/useUserProfile.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface UserProfile {
  id: string;
  full_name: string;
  hearing_status: 'hearing' | 'deaf' | 'hard_of_hearing';
  email: string;
}

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('No authenticated user');
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, hearing_status')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        setProfile({
          id: user.id,
          full_name: profileData.full_name || user.email?.split('@')[0] || 'User',
          hearing_status: profileData.hearing_status || 'hearing',
          email: user.email || ''
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch profile');
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { profile, loading, error };
};