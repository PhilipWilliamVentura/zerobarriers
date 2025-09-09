import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Video, Plus, Users, Clock, Phone, LogOut, Camera, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check current authentication state
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          console.log('No authenticated user, redirecting to signin');
          navigate("/signin");
          return;
        }

        setUser(user);
      } catch (error) {
        console.error('Error checking user:', error);
        navigate("/signin");
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        navigate("/signin");
      } else if (session?.user) {
        setUser(session.user);
        setLoading(false);
      }
    });

    // Cleanup subscription
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        toast({
          title: "Error",
          description: "Failed to sign out. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Signed out successfully",
        description: "Come back soon!",
      });
      navigate("/");
    } catch (error) {
      console.error('Unexpected error during signout:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substr(2, 9);
    navigate(`/call/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      toast({
        title: "Room ID required",
        description: "Please enter a valid room ID to join.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/call/${roomId}`);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Video className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // This shouldn't render if user is null (they'd be redirected)
  if (!user) {
    return null;
  }

  // Get user display name - try different fields that Supabase might have
  const displayName = user.user_metadata?.name || 
                     user.user_metadata?.full_name || 
                     user.email?.split('@')[0] || 
                     'User';

  const displayEmail = user.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Video className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Zero Barriers</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">{displayName}</span>
              </div>
              
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Welcome back, {displayName}!</h1>
            <p className="text-lg text-muted-foreground">
              Start a new meeting or join an existing one
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="p-8 bg-gradient-surface border-0 shadow-medium hover:shadow-large transition-all">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Start New Meeting</CardTitle>
                <CardDescription>
                  Create a new video call room instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={handleCreateRoom}
                  className="w-full" 
                  variant="hero"
                  size="lg"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Start Meeting
                </Button>
              </CardContent>
            </Card>

            <Card className="p-8 bg-gradient-surface border-0 shadow-medium hover:shadow-large transition-all">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Join Meeting</CardTitle>
                <CardDescription>
                  Enter a room ID to join an existing call
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <Input
                  placeholder="Enter room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
                />
                <Button 
                  onClick={handleJoinRoom}
                  className="w-full" 
                  variant="outline"
                  size="lg"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Join Meeting
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Meetings */}
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Meetings
              </CardTitle>
              <CardDescription>
                Your recently joined video calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent meetings</p>
                <p className="text-sm">Your meeting history will appear here</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;