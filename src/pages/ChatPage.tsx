import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Send, Bot, User } from "lucide-react";

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

const ChatPage = () => {
  const { sessionId } = useParams();
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (!error && data) {
        setSessionData(data);
        console.log('Session data loaded:', data);
        
        const hasContent = data.value && data.value.trim().length > 0;
        const welcomeMessage = hasContent 
          ? `Hello! I'm here to help you understand your session from ${new Date(data.ts).toLocaleString()}. Ask me anything about the content!`
          : `Hello! I found your session from ${new Date(data.ts).toLocaleString()}, but it appears to be empty. You can still ask me about the session details I have available.`;
        
        setMessages([{
          id: '1',
          type: 'bot',
          content: welcomeMessage,
          timestamp: new Date()
        }]);
      }
      setLoading(false);
    };

    fetchSession();
  }, [sessionId]);

  const generateResponse = (question: string, context: string): string => {
    console.log('Generating response for:', question);
    console.log('Context:', context);
    
    // Handle empty content
    if (!context || context.trim().length === 0) {
      return `This session appears to be empty. It was created on ${new Date(sessionData.ts).toLocaleString()} with ID ${sessionData.id}.`;
    }

    const contextLower = context.toLowerCase();
    const questionLower = question.toLowerCase();
    
    // Direct questions about what was said
    if (questionLower.includes('what') && (questionLower.includes('say') || questionLower.includes('said') || questionLower.includes('content'))) {
      return `In this session, you said: "${context}"`;
    }

    // Questions about repetition
    if (questionLower.includes('repeat')) {
      const words = context.toLowerCase().split(/\s+/);
      const repeatedWords = words.filter((word, index) => words.indexOf(word) !== index);
      
      if (repeatedWords.length > 0) {
        const uniqueRepeated = [...new Set(repeatedWords)];
        return `Yes, you repeated some words in this session. You said: "${context}". The repeated words were: ${uniqueRepeated.join(', ')}.`;
      } else {
        return `Looking at your session content: "${context}" - I don't see any obvious repetitions.`;
      }
    }

    // Questions about translation
    if (questionLower.includes('translat')) {
      if (contextLower.includes('translat')) {
        return `Yes, you mentioned translation! You said: "${context}". It seems you were discussing understanding or translating something.`;
      } else {
        return `You asked about translation, but looking at your session content: "${context}" - I don't see the word "translation" specifically mentioned.`;
      }
    }

    // Questions about understanding
    if (questionLower.includes('understand')) {
      if (contextLower.includes('understand')) {
        return `Yes, you mentioned "understand"! Your exact words were: "${context}".`;
      } else {
        return `You asked about understanding, but in your session: "${context}" - the word "understand" doesn't appear.`;
      }
    }

    // Summary requests
    if (questionLower.includes('summary') || questionLower.includes('summarize')) {
      return `Here's your session summary: You said "${context}". This appears to be a brief statement about understanding and translating.`;
    }

    // Session metadata questions
    if (questionLower.includes('when') || questionLower.includes('time')) {
      return `This session was created on ${new Date(sessionData.ts).toLocaleString()}. You said: "${context}".`;
    }

    // Default response - show the content
    return `Your session content is: "${context}". What would you like to know about it?`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing || !sessionData) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsProcessing(true);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const response = generateResponse(currentInput, sessionData.value || '');
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: "Sorry, I encountered an error while processing your question. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <p className="text-center p-8">Loading chat context...</p>;
  }

  if (!sessionData) {
    return <p className="text-center p-8 text-red-500">Session not found</p>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white p-4 border-b shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">
          Chat About Session from {new Date(sessionData.ts).toLocaleString()}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Ask questions about your session content
        </p>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Debug Information */}
        {sessionData && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Debug Info:</strong> Session ID: {sessionData.id}
                </p>
                <p className="text-sm text-yellow-700">
                  <strong>Timestamp:</strong> {new Date(sessionData.ts).toLocaleString()}
                </p>
                <p className="text-sm text-yellow-700">
                  <strong>Content Preview:</strong> {sessionData.value ? 
                    `"${sessionData.value.substring(0, 100)}${sessionData.value.length > 100 ? '...' : ''}"`
                    : 'No content available'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.type === 'bot' && (
                <div className="bg-blue-500 rounded-full p-2 text-white">
                  <Bot size={16} />
                </div>
              )}
              
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-800 border'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>

              {message.type === 'user' && (
                <div className="bg-gray-500 rounded-full p-2 text-white">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex items-start space-x-3">
              <div className="bg-blue-500 rounded-full p-2 text-white">
                <Bot size={16} />
              </div>
              <div className="bg-white border rounded-lg px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="bg-white border-t p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about your session..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-1"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;