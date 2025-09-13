import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Plus, Users, Clock, LogOut, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          navigate("/signin");
          return;
        }

        setUser(user);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profileError) setProfile(profileData);
      } catch (error) {
        console.error('Error checking user:', error);
        navigate("/signin");
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
        navigate("/signin");
      } else if (session?.user) {
        setUser(session.user);
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => data && setProfile(data));
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({ title: "Signed out", description: "See you soon!" });
      navigate("/");
    } catch {
      toast({ title: "Error", description: "Could not sign out.", variant: "destructive" });
    }
  };

  const handleStartSession = () => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    navigate(`/session/${sessionId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Video className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) return null;

  const displayName = profile?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Video className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">Zero Barriers</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">{displayName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm text-muted-foreground">{displayName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome, {displayName}!</h1>
          <p className="text-lg text-muted-foreground">
            Start a new session to speak, and your words will be translated to sign language in real-time.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-center mb-12">
        <Card className="p-8 bg-gradient-surface border-0 shadow-medium hover:shadow-large transition-all w-full max-w-2xl">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Start New Session</CardTitle>
            <CardDescription>
              Speak freely and see your video transform into a sign language avatar
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button onClick={handleStartSession} className="w-full" variant="hero" size="lg">
              <Camera className="h-5 w-5 mr-2" />
              Start Session
            </Button>
          </CardContent>
        </Card>
      </div>


        {/* Recent Sessions */}
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Sessions
            </CardTitle>
            <CardDescription>
              Your recently used sign language sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent sessions</p>
              <p className="text-sm">Your session history will appear here</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
