import React, { useState, useEffect } from 'react';
import MapContainer from './components/MapContainer';
import ChatPanel from './components/ChatPanel';
import { LatLng, MapPlace, MapRoute, Message } from './types';
import { Compass, Info, Github, HelpCircle, MapPin, Sparkles } from 'lucide-react';

const LOCAL_STORAGE_CHAT_KEY = 'map_chatbot_messages_v1';
const uuid = () => Math.random().toString(36).substring(2, 15);

// Default coordinates centered on Manhattan, New York
const DEFAULT_CENTER: LatLng = { lat: 40.7580, lng: -73.9855 };
const DEFAULT_ZOOM = 12;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPending, setIsPending] = useState(false);

  // Map state
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM);
  const [placesQuery, setPlacesQuery] = useState<{ query: string; category?: string } | null>(null);
  const [routeQuery, setRouteQuery] = useState<{ origin: string; destination: string; travelMode: string } | null>(null);
  const [focusQuery, setFocusQuery] = useState<string | null>(null);

  // Tool sync states
  const [waitingForTool, setWaitingForTool] = useState<string | null>(null);

  // Load chat history on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_CHAT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Map timestamps back to Date objects
        const loadedMessages = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(loadedMessages);
      } catch (e) {
        console.error('Failed to load chat history', e);
      }
    }
  }, []);

  // Save chat history on change
  const saveChatHistory = (updated: Message[]) => {
    setMessages(updated);
    localStorage.setItem(LOCAL_STORAGE_CHAT_KEY, JSON.stringify(updated));
  };

  // 1. Send conversation history to Express backend
  const callChatApi = async (updatedHistory: Message[]) => {
    setIsPending(true);

    try {
      // Map history to standard Gemini API structure
      const apiPayload = updatedHistory.map(msg => {
        if (msg.functionResponse) {
          return {
            role: 'user',
            parts: [{
              functionResponse: {
                name: msg.functionResponse.name,
                response: msg.functionResponse.response,
              }
            }]
          };
        }

        if (msg.functionCalls && msg.functionCalls.length > 0) {
          return {
            role: 'model',
            parts: [
              ...(msg.text ? [{ text: msg.text }] : []),
              ...msg.functionCalls.map(fc => ({
                functionCall: {
                  name: fc.name,
                  args: fc.args,
                }
              }))
            ]
          };
        }

        return {
          role: msg.role,
          parts: [{ text: msg.text }],
        };
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: apiPayload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error occurred');
      }

      const data = await response.json();

      // Handle server-side tool invocations or standard text responses
      if (data.functionCalls && data.functionCalls.length > 0) {
        const modelMsg: Message = {
          id: uuid(),
          role: 'model',
          text: data.text || 'Adjusting map settings...',
          timestamp: new Date(),
          functionCalls: data.functionCalls,
        };

        const nextHistory = [...updatedHistory, modelMsg];
        saveChatHistory(nextHistory);

        // Process each function call in order
        for (const fc of data.functionCalls) {
          if (fc.name === 'focus_on_location') {
            setFocusQuery(fc.args.address);
            // focus_on_location succeeds immediately on client-side state set, trigger tool response
            const responseMsg: Message = {
              id: uuid(),
              role: 'user',
              text: `System: Focused map on ${fc.args.address}`,
              timestamp: new Date(),
              functionResponse: {
                name: 'focus_on_location',
                response: { status: 'success', address: fc.args.address }
              }
            };
            setTimeout(() => {
              const withToolResponse = [...nextHistory, responseMsg];
              saveChatHistory(withToolResponse);
              callChatApi(withToolResponse);
            }, 800);
          } else if (fc.name === 'clear_map_markers') {
            setPlacesQuery(null);
            setRouteQuery(null);
            setFocusQuery(null);
            const responseMsg: Message = {
              id: uuid(),
              role: 'user',
              text: 'System: Cleared map markers',
              timestamp: new Date(),
              functionResponse: {
                name: 'clear_map_markers',
                response: { status: 'success' }
              }
            };
            setTimeout(() => {
              const withToolResponse = [...nextHistory, responseMsg];
              saveChatHistory(withToolResponse);
              callChatApi(withToolResponse);
            }, 600);
          } else if (fc.name === 'show_places_on_map') {
            setPlacesQuery({ query: fc.args.query, category: fc.args.category });
            setWaitingForTool('show_places_on_map');
          } else if (fc.name === 'get_directions') {
            setRouteQuery({ origin: fc.args.origin, destination: fc.args.destination, travelMode: fc.args.travelMode });
            setWaitingForTool('get_directions');
          }
        }
      } else {
        // Standard text response
        const modelMsg: Message = {
          id: uuid(),
          role: 'model',
          text: data.text,
          timestamp: new Date(),
          groundingSources: data.groundingMetadata || [],
        };
        saveChatHistory([...updatedHistory, modelMsg]);
        setIsPending(false);
      }

    } catch (err: any) {
      console.error('Chat API Error:', err);
      const errorMsg: Message = {
        id: uuid(),
        role: 'model',
        text: `⚠️ **Error:** ${err.message || 'Failed to get response. Please try again.'}`,
        timestamp: new Date(),
      };
      saveChatHistory([...updatedHistory, errorMsg]);
      setIsPending(false);
    }
  };

  // User trigger to send a text message
  const handleSendMessage = (text: string) => {
    const userMsg: Message = {
      id: uuid(),
      role: 'user',
      text,
      timestamp: new Date(),
    };

    const nextHistory = [...messages, userMsg];
    saveChatHistory(nextHistory);
    callChatApi(nextHistory);
  };

  // 2. Capture places search results back from MapContainer
  const handlePlacesFound = (places: MapPlace[]) => {
    if (waitingForTool === 'show_places_on_map') {
      setWaitingForTool(null);

      const topPlaces = places.slice(0, 5).map(p => ({
        name: p.name,
        address: p.formattedAddress,
        rating: p.rating,
        types: p.types,
      }));

      const toolResponseMsg: Message = {
        id: uuid(),
        role: 'user',
        text: `System: Found ${places.length} matching places nearby.`,
        timestamp: new Date(),
        functionResponse: {
          name: 'show_places_on_map',
          response: {
            status: 'success',
            placesCount: places.length,
            topResults: topPlaces
          }
        }
      };

      const nextHistory = [...messages, toolResponseMsg];
      saveChatHistory(nextHistory);
      callChatApi(nextHistory);
    }
  };

  // 3. Capture directions routing results back from MapContainer
  const handleRouteComputed = (route: MapRoute | null) => {
    if (waitingForTool === 'get_directions') {
      setWaitingForTool(null);

      const toolResponseMsg: Message = {
        id: uuid(),
        role: 'user',
        text: route ? `System: Computed active route details.` : `System: Failed to resolve route.`,
        timestamp: new Date(),
        functionResponse: {
          name: 'get_directions',
          response: route
            ? {
                status: 'success',
                distance: route.distance,
                duration: route.duration,
                travelMode: route.travelMode
              }
            : {
                status: 'error',
                message: 'No routes found. Ensure the origin and destination addresses are correct.'
              }
        }
      };

      const nextHistory = [...messages, toolResponseMsg];
      saveChatHistory(nextHistory);
      callChatApi(nextHistory);
    }
  };

  const handleClearAll = () => {
    setPlacesQuery(null);
    setRouteQuery(null);
    setFocusQuery(null);
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem(LOCAL_STORAGE_CHAT_KEY);
    handleClearAll();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Upper Navigation Header */}
      <header className="px-6 py-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl text-white shadow-lg shadow-blue-500/15">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
              Interactive Map Chatbot
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 animate-pulse" />
                Live
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Real-time Places search, Directions, and Google Grounding</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-slate-400 bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Ask me to find places or show directions!</span>
        </div>
      </header>

      {/* Main Responsive Grid split */}
      <main className="flex-1 overflow-hidden p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Interactive Map Side (7/12) */}
        <section className="lg:col-span-7 h-[42vh] lg:h-full relative">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            placesQuery={placesQuery}
            routeQuery={routeQuery}
            focusQuery={focusQuery}
            onPlacesFound={handlePlacesFound}
            onRouteComputed={handleRouteComputed}
            onClearAll={handleClearAll}
          />
        </section>

        {/* Right Floating Chat Assistant Panel (5/12) */}
        <section className="lg:col-span-5 h-[48vh] lg:h-full flex flex-col">
          <ChatPanel
            messages={messages}
            isPending={isPending}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
          />
        </section>
      </main>
    </div>
  );
}
