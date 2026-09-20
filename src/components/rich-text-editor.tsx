"use client";

import { useEffect, useRef } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

export function RichTextEditor({ name, initialValue }: { name: string; initialValue: string }) {
  const editor = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const html = sanitizeRichText(initialValue);
    if (editor.current && editor.current.innerHTML !== html) editor.current.innerHTML = html;
    if (hidden.current) hidden.current.value = html;
  }, [initialValue]);

  function updateValue() {
    if (hidden.current && editor.current) hidden.current.value = editor.current.innerHTML;
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html") || event.clipboardData.getData("text/plain");
    document.execCommand("insertHTML", false, sanitizeRichText(html));
    updateValue();
  }

  function format(command: string, value?: string) {
    editor.current?.focus();
    document.execCommand(command, false, value);
    updateValue();
  }

  function link() {
    const href = window.prompt("Enter an http(s) or mailto link");
    if (href) format("createLink", href?.trim());
  }

  return <>
    <div role="toolbar" aria-label="Page body formatting" className="mb-2 flex flex-wrap gap-1">
      {([["formatBlock", "h2", "Heading 2"], ["formatBlock", "h3", "Heading 3"], ["formatBlock", "p", "Paragraph"], ["insertUnorderedList", undefined, "Bulleted list"], ["insertOrderedList", undefined, "Numbered list"], ["bold", undefined, "Bold"], ["italic", undefined, "Italic"]] as const).map(([command, value, label]) =>
        <button key={label} type="button" className="rounded border border-deep-navy/20 px-2 py-1 text-xs font-semibold text-deep-navy hover:bg-soft-blue-grey" onMouseDown={(event) => event.preventDefault()} onClick={() => format(command, value)}>{label}</button>
      )}
      <button type="button" className="rounded border border-deep-navy/20 px-2 py-1 text-xs font-semibold text-deep-navy hover:bg-soft-blue-grey" onMouseDown={(event) => event.preventDefault()} onClick={link}>Link</button>
    </div>
    <div
      ref={editor}
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label="Formatted page body"
      onInput={updateValue}
      onPaste={handlePaste}
      className="min-h-56 rounded border border-deep-navy/20 bg-white p-3 leading-7 outline-none focus:border-swcu-blue focus:ring-2 focus:ring-swcu-blue/20"
      suppressContentEditableWarning
    />
    <input ref={hidden} type="hidden" name={name} />
  </>;
}