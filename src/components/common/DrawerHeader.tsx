import React from 'react';
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerHeaderProps {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  className?: string;
  showClose?: boolean;
  children?: React.ReactNode;
}

import { DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * DrawerHeader
 * Standardized header for Drawers and specific Dialogs
 */
export default function DrawerHeader({
  title,
  subtitle,
  onClose,
  className,
  showClose = true,
  children,
}: DrawerHeaderProps) {
  return (
    <div className={cn(
      "relative h-20 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 shadow flex items-center shrink-0 w-full overflow-hidden",
      className
    )}>
      {/* Background Ornaments */}
      <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10px] left-[10%] w-24 h-24 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
      
      <div className="px-6 flex flex-col justify-center gap-0.5 z-10 w-full pr-20">
        {children ? (
          children
        ) : (
          <>
            <DialogTitle className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-gamja">
              {title}
            </DialogTitle>
            {subtitle && (
              <DialogDescription className="text-[11px] text-slate-100/80 font-medium tracking-tight font-gamja">
                {subtitle}
              </DialogDescription>
            )}
          </>
        )}
      </div>

      {showClose && onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 group z-20"
        >
          <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
}
