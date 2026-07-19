import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, User, Sparkles, Navigation, Search, Route as RouteIcon, Trash2, Globe, ArrowRight, CornerDownLeft, RefreshCcw } from 'lucide-react';
import { Message } from '../types';

interface ChatPanelProps {
  messages: Message[];
  isPending: boolean;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
}

const PRESETS = [
  {
    title: 'Explore Paris Cafe Spots',
    text: 'Fly to Paris and show me highly-rated cafes on the map',
    icon: Search,
    color: 'text-orange-400 bg-orange-400/10 border-orange-500/20'
  },
  {
    title: 'Route in New York',
    text: 'Show directions from Central Park to Brooklyn Bridge by walking',
    icon: RouteIcon,
    color: 'text-blue-400 bg-blue-400/10 border-blue-500/20'
  },
  {
    title: 'Tokyo Sights',
    text: 'Center on Tokyo and show top-rated tourist attractions',
    icon: Navigation,
    color: 'text-purple-400 bg-purple-400/10 border-purple-500/20'
  }
];

export default function ChatPanel({
  messages,
  isPending,
  onSendMessage,
  onClearChat,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 text-sm leading-tight">Map Assistant</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Powered by Gemini 3.5 Flash</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="text-slate-400 hover:text-red-400 hover:bg-slate-800/60 p-2 rounded-xl transition-all border border-slate-800"
            title="Clear Chat History"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center py-6">
            <div className="p-4 rounded-full bg-slate-900 border border-slate-800 mb-5 shadow-inner">
              <Bot className="w-8 h-8 text-blue-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">Start Your Map Journey</h4>
            <p className="text-xs text-slate-500 text-center max-w-xs mt-1 leading-relaxed">
              Ask questions about places, ask me to search spots, center the map, or calculate directions!
            </p>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 gap-2.5 w-full max-w-sm mt-8">
              {PRESETS.map((preset, idx) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(preset.text)}
                    className={`text-left p-3 rounded-xl border transition-all text-xs flex items-start gap-3 hover:-translate-y-0.5 shadow-md hover:shadow-lg hover:border-slate-700 bg-slate-900/40 border-slate-800/80 group`}
                  >
                    <div className={`p-1.5 rounded-lg border ${preset.color} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="font-semibold text-slate-300 group-hover:text-white transition-colors">{preset.title}</p>
                      <p className="text-slate-500 truncate mt-0.5">{preset.text}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role !== 'user' && (
                    <div className="w-8 h-8 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center shrink-0">
                      <Bot className="w-4.5 h-4.5 text-blue-400" />
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed border ${
                    msg.role === 'user'
                      ? 'bg-blue-600 border-blue-500 text-white rounded-br-none shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900 border-slate-800/80 text-slate-200 rounded-bl-none'
                  }`}>
                    {/* Message Text */}
                    <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                    {/* Tool Calls Visualizer */}
                    {msg.functionCalls && msg.functionCalls.length > 0 && (
                      <div className="mt-3.5 border-t border-slate-800 pt-2.5 space-y-2">
                        {msg.functionCalls.map((fc, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] text-blue-400 font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg border border-blue-500/10">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              Calling <b className="text-indigo-400">{fc.name}</b>({JSON.stringify(fc.args)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Grounding Metadata Cards */}
                    {msg.groundingSources && msg.groundingSources.length > 0 && (
                      <div className="mt-3.5 border-t border-slate-800/60 pt-2.5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-2 font-semibold">
                          <Globe className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Google Search Sources:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.groundingSources.map((src, i) => (
                            <a
                              key={i}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] bg-slate-950/60 border border-slate-800/80 text-blue-400 px-2.5 py-1 rounded-full hover:bg-slate-800 hover:text-blue-300 transition-all max-w-[180px] truncate"
                              title={src.title}
                            >
                              <span>{src.title}</span>
                              <span className="text-[8px] opacity-60">↗</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg border border-blue-500/20 bg-blue-900/20 flex items-center justify-center shrink-0">
                      <User className="w-4.5 h-4.5 text-blue-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Pending State Loader */}
            {isPending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
              >
                <div className="w-8 h-8 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center shrink-0">
                  <Bot className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl rounded-bl-none p-3.5 max-w-[85%] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-slate-500 font-medium ml-1.5">Map Assistant is exploring...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/20 backdrop-blur-sm sticky bottom-0">
        <form onSubmit={handleSubmit} className="flex gap-2 relative items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isPending ? 'Please wait...' : 'Ask about locations, search spots or compute routes...'}
            disabled={isPending}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 disabled:opacity-50 pr-12 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isPending}
            className="absolute right-2 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-lg p-2 hover:from-blue-500 hover:to-indigo-400 disabled:opacity-40 transition-all flex items-center justify-center shadow-lg hover:shadow-indigo-500/20"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-2 font-medium">
          The map changes live when the assistant searches or computes routes!
        </p>
      </div>
    </div>
  );
}
