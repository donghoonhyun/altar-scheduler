import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoBoxProps {
  title?: string;
  children: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

export const InfoBox: React.FC<InfoBoxProps> = ({ 
  title, 
  children, 
  icon: Icon = Info, 
  className 
}) => {
  return (
    <div className={cn("bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3", className)}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-500 flex-shrink-0">
        <Icon size={18} />
      </div>
      <div>
        {title && <h4 className="font-bold text-gray-800 mb-0.5 text-xs">{title}</h4>}
        <div className="text-[11px] text-gray-600 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};
