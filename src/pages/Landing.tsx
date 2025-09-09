import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, Users, Shield, Zap, Camera, Mic, MonitorSpeaker } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Video className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Zero Barriers</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/signup">
              <Button variant="hero">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 animate-slide-up">
            Connect with anyone,
            <br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Break any Barriers
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-up">
            High-quality video calls, screen sharing, and seamless collaboration. 
            Experience the future of remote communication.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
            <Link to="/signup">
              <Button size="lg" variant="hero" className="shadow-glow">
                Start Free Call
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <Card className="p-8 text-center bg-gradient-surface border-0 shadow-medium hover:shadow-large transition-all">
            <Camera className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">HD Video Quality</h3>
            <p className="text-muted-foreground">
              Crystal clear video calls with adaptive quality translation, linking deaf and non-deaf together.
            </p>
          </Card>

          <Card className="p-8 text-center bg-gradient-surface border-0 shadow-medium hover:shadow-large transition-all">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Fast, Accurate & Reliable</h3>
            <p className="text-muted-foreground">
              Reduced subtitle latency by 50%, Achieved 85% caption accuracy and Improved meeting note efficiency by 70% using NLP summarization of transcripts.
            </p>
          </Card>
          
          <Card className="p-8 text-center bg-gradient-surface border-0 shadow-medium hover:shadow-large transition-all">
            <MonitorSpeaker className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-3">Screen Sharing</h3>
            <p className="text-muted-foreground">
              Share your screen instantly for presentations, demos, and collaboration.
            </p>
          </Card>
          
        </div>
      </main>
    </div>
  );
};

export default Landing;