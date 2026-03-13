// ---------------------------------------------------------------------------
// SafeClaw — Chat input
// ---------------------------------------------------------------------------

import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, disabled, isGenerating = false, onStop }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2 p-4">
      <textarea
        ref={textareaRef}
        className="textarea textarea-bordered flex-1 chat-textarea text-base leading-snug"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      {isGenerating ? (
        <button
          className="btn btn-error btn-circle"
          onClick={onStop}
          aria-label="Stop generation"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      ) : (
        <button
          className="btn btn-primary btn-circle"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
