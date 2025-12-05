"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface EditablePromptProps {
  prompt: any;
  onChange: (prompt: any) => void;
}

function EditableField({
  label,
  value,
  onChange,
  path,
}: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  path: string;
}) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
          {label}
        </div>
        <div className="pl-4 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-3">
          {Object.entries(value).map(([key, val]) => (
            <EditableField
              key={key}
              label={key}
              value={val}
              onChange={(newVal) => {
                onChange({ ...value, [key]: newVal });
              }}
              path={`${path}.${key}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
          {label}
        </div>
        <div className="pl-4 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-2">
          {value.map((item, index) => (
            <EditableField
              key={index}
              label={`${label}[${index}]`}
              value={item}
              onChange={(newVal) => {
                const newArray = [...value];
                newArray[index] = newVal;
                onChange(newArray);
              }}
              path={`${path}[${index}]`}
            />
          ))}
        </div>
      </div>
    );
  }

  const isString = typeof value === "string";
  const isNumber = typeof value === "number";
  const isBoolean = typeof value === "boolean";

  return (
    <div className="space-y-1.5">
      <label className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {isBoolean ? (
        <select
          value={value ? "true" : "false"}
          onChange={(e) => onChange(e.target.value === "true")}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : isNumber ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
        />
      ) : (
        <textarea
          value={isString ? value : JSON.stringify(value)}
          onChange={(e) => {
            // Try to parse as JSON if it looks like JSON, otherwise use as string
            let newValue: any = e.target.value;
            try {
              if (e.target.value.trim().startsWith("{") || e.target.value.trim().startsWith("[")) {
                newValue = JSON.parse(e.target.value);
              }
            } catch {
              // Keep as string if parsing fails
            }
            onChange(newValue);
          }}
          rows={isString && value.length > 50 ? 3 : 1}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 resize-y min-h-[2.5rem]"
        />
      )}
    </div>
  );
}

export function EditablePrompt({ prompt, onChange }: EditablePromptProps) {
  const [localPrompt, setLocalPrompt] = useState(prompt);

  useEffect(() => {
    setLocalPrompt(prompt);
  }, [prompt]);

  const handleChange = (newPrompt: any) => {
    setLocalPrompt(newPrompt);
    onChange(newPrompt);
  };

  return (
    <div className="space-y-4">
      {Object.entries(localPrompt).map(([key, value]) => (
        <EditableField
          key={key}
          label={key}
          value={value}
          onChange={(newVal) => {
            handleChange({ ...localPrompt, [key]: newVal });
          }}
          path={key}
        />
      ))}
    </div>
  );
}

