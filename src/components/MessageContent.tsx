import type React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const lang = /language-(\w+)/.exec(className || '')?.[1] || '';
  const text = String(children).replace(/\n$/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // Inline code
  if (!className && !String(children).includes('\n')) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-black/40 text-orange-200 text-[0.9em] font-mono">
        {children}
      </code>
    );
  }

  return (
    <div className="relative my-2 rounded-lg border border-orange-500/20 bg-black/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 text-[10px] uppercase tracking-wide text-orange-300/70 border-b border-orange-500/10">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className="text-orange-300 hover:text-orange-100 normal-case"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-orange-50 font-mono">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function MessageContent({ text, isUser }: { text: string; isUser?: boolean }) {
  if (isUser) {
    return <div className="text-sm leading-relaxed whitespace-pre-wrap text-left">{text}</div>;
  }

  return (
    <div className="text-sm leading-relaxed text-left prose-chatty">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-orange-300 underline hover:text-orange-200 break-all"
              >
                {children}
              </a>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h3 className="font-semibold text-base mb-1 text-orange-200">{children}</h3>;
          },
          h2({ children }) {
            return <h3 className="font-semibold text-sm mb-1 text-orange-200">{children}</h3>;
          },
          h3({ children }) {
            return <h4 className="font-semibold text-sm mb-1 text-orange-200">{children}</h4>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-orange-400/40 pl-3 my-2 text-orange-100/80">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
