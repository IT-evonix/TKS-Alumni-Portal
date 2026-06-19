import React from 'react';

interface PageHeadingProps {
  firstWord: string;
  secondWord?: string;
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
        {secondWord ? <>{firstWord} <span className="text-[#008060]">{secondWord}</span></> : <span className="text-[#008060]">{firstWord}</span>}
      </h1>
    </div>
  );
};
