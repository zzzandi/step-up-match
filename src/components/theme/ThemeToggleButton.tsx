import {
  Moon,
  Sun,
} from "lucide-react";

import {
  useAppTheme,
} from "@/services/themeService";

interface ThemeToggleButtonProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggleButton({
  compact = false,
  className = "",
}: ThemeToggleButtonProps) {
  const {
    theme,
    toggleTheme,
  } = useAppTheme();
  const isLightTheme =
    theme === "light";
  const label =
    isLightTheme
      ? "라이트모드"
      : "다크모드";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`${label} 전환`}
      title={`${label} 전환`}
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        rounded-xl
        bg-slate-800
        px-3
        py-2
        text-sm
        font-bold
        text-white
        shadow-lg
        shadow-black/10
        transition
        hover:bg-slate-700
        ${className}
      `}
    >
      {isLightTheme ? (
        <Sun size={16} />
      ) : (
        <Moon size={16} />
      )}
      {!compact && <span>{label}</span>}
    </button>
  );
}
