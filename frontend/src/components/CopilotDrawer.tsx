import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Bot, 
  Send, 
  Wrench, 
  CheckCircle2, 
  Loader2, 
  Trash2,
  ChevronRight,
  User
} from 'lucide-react';
import { ChatMessage } from '../types';
import { api } from '../services/api';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshTasks: () => void;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  onRefreshTasks,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello. I'm your **AI Task Copilot** powered by **Gemini 3.7 Flash** and **LangGraph**.\n\nI can create tasks, triage your backlog, break down complex projects, prioritize using the Eisenhower Matrix, or plan your daily schedule. What would you like to work on?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<Array<{ name: string; args?: Record<string, unknown>; output?: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTools]);

  const quickPrompts = [
    'Top urgent & important tasks',
    'Plan schedule for 4 hours today',
    'Break down highest priority task',
    'Audit low-priority backlog',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isStreaming) return;
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsStreaming(true);
    setActiveTools([]);

    // Prepare assistant streaming placeholder
    const assistantMsgId = `assistant_${Date.now()}`;
    let accumulatedContent = '';
    const currentTools: Array<{ name: string; args?: Record<string, unknown>; output?: string }> = [];

    await api.streamChat(query.trim(), threadId, {
      onInit: (tid) => {
        setThreadId(tid);
      },
      onToken: (token) => {
        accumulatedContent += token;
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMsgId);
          return [
            ...filtered,
            {
              id: assistantMsgId,
              role: 'assistant',
              content: accumulatedContent,
              tools_called: [...currentTools],
              timestamp: new Date().toISOString(),
            },
          ];
        });
      },
      onToolStart: (name, args) => {
        const newTool = { name, args };
        currentTools.push(newTool);
        setActiveTools([...currentTools]);
      },
      onToolEnd: (name, output) => {
        const found = currentTools.find((t) => t.name === name);
        if (found) {
          found.output = output;
        }
        setActiveTools([...currentTools]);
        // Refresh tasks in background if tool modified data
        onRefreshTasks();
      },
      onDone: (tid) => {
        setThreadId(tid);
        setIsStreaming(false);
        onRefreshTasks();
      },
      onError: (err) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Error: ${err}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsStreaming(false);
      },
    });
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'assistant',
        content: 'Chat history cleared. How can I assist you with your tasks?',
        timestamp: new Date().toISOString(),
      },
    ]);
    setThreadId(null);
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[450px] bg-[#09090b]/95 border-l border-zinc-800 backdrop-blur-xl shadow-2xl flex flex-col transition-all">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800 shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-100 tracking-tight">Task Copilot</h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                Gemini 3.7 Flash
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">langgraph tool calling agent</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition"
            title="Clear Chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs ${
                msg.role === 'user'
                  ? 'bg-zinc-200 text-zinc-900 font-bold'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              {msg.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            </div>

            <div
              className={`max-w-[85%] rounded-xl p-3 shadow-sm space-y-2 ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80 rounded-tr-none'
                  : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-200 rounded-tl-none'
              }`}
            >
              {/* Tool Execution Badges if present */}
              {msg.tools_called && msg.tools_called.length > 0 && (
                <div className="space-y-1.5 mb-2 border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                    <Wrench className="h-3 w-3" /> Tool Traces ({msg.tools_called.length})
                  </div>
                  {msg.tools_called.map((tool, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-950 border border-zinc-850 p-2 rounded-lg text-[10px] font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-zinc-300">
                        <span>⚡ {tool.name}()</span>
                        {tool.output ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                        )}
                      </div>
                      {tool.output && (
                        <div className="text-zinc-400 bg-zinc-900/90 p-1.5 rounded border border-zinc-800 max-h-24 overflow-y-auto whitespace-pre-wrap text-[10px]">
                          {tool.output}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {/* Real-time streaming tool indicators */}
        {isStreaming && activeTools.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
            <span>Executing tool: <strong className="font-mono text-zinc-100">{activeTools[activeTools.length - 1].name}</strong>...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-2.5 border-t border-zinc-800/80 bg-zinc-950/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={isStreaming}
              className="flex-shrink-0 flex items-center gap-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-md border border-zinc-800 transition text-xs disabled:opacity-50"
            >
              <span>{prompt}</span>
              <ChevronRight className="h-3 w-3 text-zinc-500" />
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask Copilot to organize, schedule, or prioritize..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isStreaming}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isStreaming || !inputText.trim()}
            className="p-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 transition disabled:opacity-40 shadow-sm"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </aside>
  );
};
