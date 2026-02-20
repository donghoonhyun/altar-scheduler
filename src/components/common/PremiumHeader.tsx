import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PremiumHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onBack?: () => void;
  backUrl?: string;
  className?: string;
}

/**
 * PremiumHeader
 * Standardized page header as used in SuperAdmin pages.
 */
export default function PremiumHeader({
  title,
  subtitle,
  icon,
  onBack,
  backUrl,
  className,
}: PremiumHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backUrl) {
      navigate(backUrl);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn(
      "relative h-20 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] dark:from-blue-900 dark:via-blue-950 dark:to-slate-900 rounded-b-[32px] shadow-lg overflow-hidden shrink-0",
      className
    )}>
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      <div className="absolute top-4 left-4 flex items-start gap-3 w-full pr-8">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleBack} 
          className="text-white hover:bg-white/20 mt-1 shrink-0 h-8 w-8 transition-colors z-10"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="space-y-0 text-left z-10 w-full overflow-hidden">
          {subtitle && (
            <div className="text-sm font-medium text-white/90 tracking-tight font-gamja mb-0.5 truncate">
              {subtitle}
            </div>
          )}
          <h1 className="text-2xl font-bold text-white tracking-tight font-gamja flex items-center gap-2 truncate">
            {icon && (
              <span className="text-white opacity-80 shrink-0">
                {icon}
              </span>
            )}
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}
