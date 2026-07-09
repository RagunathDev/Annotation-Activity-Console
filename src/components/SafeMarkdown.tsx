import React, { useMemo } from "react";
import DOMPurify from "dompurify";

interface SafeMarkdownProps {
  content: string;
}

/**
 * A highly secure and lightweight markdown parser for the streamed summary content.
 * It converts standard markdown blocks (headers, bullets, bold, italics, inline code, pre/code blocks)
 * into semantic HTML, and then sanitizes the final output using DOMPurify to safely render untrusted content.
 */
export function SafeMarkdown({ content }: SafeMarkdownProps) {
  const renderedHtml = useMemo(() => {
    if (!content) return "";

    let html = "";
    const lines = content.split("\n");
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inList = false;

    for (let line of lines) {
      // 1. Code Block Handling
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          // Closing code block
          const codeText = codeContent.join("\n");
          html += `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg my-3 overflow-x-auto font-mono text-xs"><code class="block whitespace-pre">${escapeHtml(
            codeText
          )}</code></pre>`;
          codeContent = [];
          inCodeBlock = false;
        } else {
          // Opening code block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // 2. List Handling
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        if (!inList) {
          html += '<ul class="list-disc list-inside ml-4 my-2 text-gray-700 space-y-1">';
          inList = true;
        }
        const itemText = parseInlineMarkdown(line.trim().slice(2));
        html += `<li>${itemText}</li>`;
        continue;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
      }

      // 3. Header Handling
      if (line.startsWith("###### ")) {
        html += `<h6 class="text-sm font-semibold text-gray-900 mt-4 mb-2">${parseInlineMarkdown(line.slice(7))}</h6>`;
      } else if (line.startsWith("##### ")) {
        html += `<h5 class="text-base font-semibold text-gray-900 mt-4 mb-2">${parseInlineMarkdown(line.slice(6))}</h5>`;
      } else if (line.startsWith("#### ")) {
        html += `<h4 class="text-lg font-semibold text-gray-900 mt-4 mb-2">${parseInlineMarkdown(line.slice(5))}</h4>`;
      } else if (line.startsWith("### ")) {
        html += `<h3 class="text-xl font-bold text-gray-900 mt-4 mb-2">${parseInlineMarkdown(line.slice(4))}</h3>`;
      } else if (line.startsWith("## ")) {
        html += `<h2 class="text-2xl font-bold text-gray-900 mt-5 mb-3 border-b pb-1 border-gray-100">${parseInlineMarkdown(line.slice(3))}</h2>`;
      } else if (line.startsWith("# ")) {
        html += `<h1 class="text-3xl font-extrabold text-gray-900 mt-6 mb-4">${parseInlineMarkdown(line.slice(2))}</h1>`;
      } else {
        // 4. Paragraph Handling
        const trimmed = line.trim();
        if (trimmed) {
          // If the line contains raw HTML tags, we let them pass through so DOMPurify can clean them
          html += `<p class="my-2 text-gray-700 leading-relaxed">${parseInlineMarkdown(line)}</p>`;
        }
      }
    }

    if (inList) {
      html += "</ul>";
    }

    // Sanitize the compiled HTML safely using DOMPurify
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "code", "pre", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "img"
      ],
      ALLOWED_ATTR: ["href", "target", "class", "style", "src", "alt"],
    });
  }, [content]);

  return (
    <div
      id="safe-markdown-content"
      className="prose prose-blue max-w-none break-words"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

// Escapes special HTML tags to prevent execution in code blocks
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Utility to parse standard inline styles like bold, italics, and inline code
function parseInlineMarkdown(text: string): string {
  let formatted = text;
  
  // Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
  
  // Italics: _text_
  formatted = formatted.replace(/_(.*?)_/g, '<em class="italic text-gray-800">$1</em>');
  
  // Inline code: `code`
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-gray-100 text-red-600 px-1 py-0.5 rounded font-mono text-xs">$1</code>');
  
  return formatted;
}
