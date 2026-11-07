"use client";

import { useMemo } from "react";

interface ThemeInjectorProps {
  primaryColor?: string;
  accentColor?: string;
  sidebarBg?: string;
  borderRadius?: string;
}

/**
 * Safely computes whether white or black text provides optimal WCAG contrast against a hex color.
 */
function getContrastColor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#FFFFFF";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // ITU-R BT.709 luma formula
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.6 ? "#0F172A" : "#FFFFFF";
}

export function ThemeInjector({
  primaryColor,
  accentColor,
  sidebarBg,
  borderRadius,
}: ThemeInjectorProps) {
  const css = useMemo(() => {
    const rules: string[] = [];

    if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      const fg = getContrastColor(primaryColor);
      rules.push(`--primary: ${primaryColor};`);
      rules.push(`--primary-foreground: ${fg};`);
      rules.push(`--ring: ${primaryColor};`);
      rules.push(`--brand-500: ${primaryColor};`);
    }

    if (accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
      rules.push(`--brand-lime: ${accentColor};`);
      rules.push(`--accent: ${accentColor};`);
    }

    if (sidebarBg && /^#[0-9A-Fa-f]{6}$/.test(sidebarBg)) {
      rules.push(`--sidebar: ${sidebarBg};`);
    }

    if (borderRadius && /^[0-9]+px$/.test(borderRadius)) {
      rules.push(`--radius: ${borderRadius};`);
      rules.push(`--radius-md: ${borderRadius};`);
    }

    if (rules.length === 0) return "";

    return `
      :root {
        ${rules.join("\n        ")}
      }
      .dark {
        ${primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? `--primary: ${primaryColor}; --primary-foreground: ${getContrastColor(primaryColor)};` : ""}
      }
    `;
  }, [primaryColor, accentColor, sidebarBg, borderRadius]);

  if (!css) return null;

  return (
    <style
      id="custom-dashboard-theme"
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
