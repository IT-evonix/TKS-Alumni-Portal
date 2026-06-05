import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export const BackButton: React.FC<BackButtonProps> = ({ 
  onClick,
  className = '',
  variant = 'ghost',
  size = 'icon'
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Use browser history to go back to previous page
      window.history.back();
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`
        group relative
        w-10 h-10 sm:w-11 sm:h-11
        rounded-full
        bg-white/80 backdrop-blur-sm
        border border-gray-200/60
        shadow-md hover:shadow-lg
        transition-all duration-300
        hover:bg-white
        hover:border-[#008060]/40
        hover:scale-110
        active:scale-95
        overflow-hidden
        ${className}
      `}
      aria-label="Go back to previous page"
    >
      {/* Gradient background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#008060]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Animated arrow icon */}
      <ArrowLeft 
        className="
          relative z-10
          w-5 h-5 sm:w-5 sm:h-5
          text-gray-700
          group-hover:text-[#008060]
          transition-all duration-300
          group-hover:translate-x-[-2px]
        " 
      />
      
      {/* Shine effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
    </Button>
  );
};
