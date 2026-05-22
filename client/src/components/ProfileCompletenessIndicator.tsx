import React from 'react';

interface ProfileCompletenessProps {
  percentage: number;
  onClick?: () => void;
}

export const ProfileCompletenessIndicator: React.FC<ProfileCompletenessProps> = ({
  percentage,
  onClick
}) => {
  // Use consistent radius for calculations (based on viewBox center)
  const radius = 30; // Radius for viewBox 0 0 80 80 (center at 40,40)
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage === 100) return '#10b981'; // green
    if (percentage >= 70) return '#3b82f6'; // blue
    if (percentage >= 40) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  return (
    <div
      className="relative cursor-pointer hover:scale-105 transition-transform active:scale-95 hover:opacity-90 mx-auto sm:mx-0 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Profile ${percentage}% complete. Click to view details.`}
    >
      {/* Responsive SVG: scales with container */}
      <svg 
        className="transform -rotate-90 w-full h-full"
        viewBox="0 0 80 80"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background circle */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="6"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke={getColor()}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {/* Responsive text sizes: smaller on mobile */}
          <div 
            className="text-base sm:text-lg md:text-xl font-bold leading-tight" 
            style={{ color: getColor() }}
          >
            {percentage}%
          </div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 leading-tight mt-0.5">Complete</div>
        </div>
      </div>
    </div>
  );
};