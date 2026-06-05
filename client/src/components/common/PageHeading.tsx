import React from 'react';

interface PageHeadingProps {
  firstWord: string;
  secondWord: string;
  className?: string;
}

export const PageHeading: React.FC<PageHeadingProps> = ({ 
  firstWord, 
  secondWord, 
  className = "" 
}) => {
  return (
    <div className={`relative w-full sm:w-auto mb-4 sm:mb-6 ${className}`}>
      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">
        {firstWord} <span className="text-[#008060]">{secondWord}</span>
      </h1>
      <div className="absolute -bottom-1 left-0 w-10 sm:w-12 h-0.5 sm:h-1 bg-gradient-to-r from-[#008060] to-transparent rounded-full" />
    </div>
  );
};
