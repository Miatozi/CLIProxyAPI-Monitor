"use client";

import { useState, useEffect, useRef, useMemo, startTransition } from "react";
import { X } from "lucide-react";

interface ComboBoxProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  darkMode?: boolean;
  className?: string;
  onSelectOption?: (val: string) => void;
  onClear?: () => void;
}

export function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  darkMode = true,
  className,
  onSelectOption,
  onClear
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!hasTyped) return options;
    return options.filter((opt) => opt.toLowerCase().includes(value.toLowerCase()));
  }, [hasTyped, options, value]);

  const baseInput = `${className ?? ""} rounded-lg border px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none ${
    darkMode ? "border-slate-700 bg-slate-800 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
  }`;

  const closeDropdown = () => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsVisible(false);
      setIsClosing(false);
      setSelectedIndex(-1);
    }, 100);
  };

  const selectOption = (opt: string) => {
    onChange(opt);
    setHasTyped(false);
    closeDropdown();
    inputRef.current?.blur();
    onSelectOption?.(opt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        setHasTyped(false);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filtered.length) {
          selectOption(filtered[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        startTransition(() => {
          setIsVisible(true);
          setIsClosing(false);
        });
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setHasTyped(true);
          onChange(e.target.value);
        }}
        onFocus={() => {
          setOpen(true);
          setHasTyped(false);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${baseInput} pr-8`}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="combobox-options"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            onChange("");
            setHasTyped(false);
            onClear?.();
          }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition ${
            darkMode ? "text-slate-400 hover:bg-slate-700 hover:text-slate-200" : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          }`}
          title="清除"
          aria-label="清除输入"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {isVisible && filtered.length ? (
        <div
          id="combobox-options"
          role="listbox"
          className={`absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border shadow-lg scrollbar-slim ${
            darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
          } ${isClosing ? "animate-dropdown-out" : "animate-dropdown-in"}`}
        >
          {filtered.map((opt, idx) => (
            <button
              type="button"
              key={opt}
              role="option"
              aria-selected={idx === selectedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`block w-full px-3 py-2 text-left text-sm transition ${
                idx === selectedIndex
                  ? darkMode
                    ? "bg-slate-700 text-white"
                    : "bg-slate-200 text-slate-900"
                  : darkMode
                  ? "text-slate-200 hover:bg-slate-800"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
