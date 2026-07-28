
import React from 'react';

interface DashboardIconProps {
  className?: string;
  active?: boolean;
}

export const DashboardIcon: React.FC<DashboardIconProps> = ({ className, active }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 14 14" 
      className={className}
      height="14" 
      width="14"
    >
      <g id="dashboard-3--app-application-dashboard-home-layout-vertical">
        {/* Fill layers */}
        <path 
          id="Vector" 
          className={active ? "fill-brand-500/20" : "fill-slate-100 dark:fill-slate-800"}
          d="M13 6.5H9c-0.27614 0 -0.5 0.22386 -0.5 0.5v6c0 0.2761 0.22386 0.5 0.5 0.5h4c0.2761 0 0.5 -0.2239 0.5 -0.5V7c0 -0.27614 -0.2239 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
        <path 
          id="Vector_2" 
          className={active ? "fill-brand-500/20" : "fill-slate-100 dark:fill-slate-800"}
          d="M13 0.5H9c-0.27614 0 -0.5 0.223858 -0.5 0.5v2.01c0 0.27614 0.22386 0.5 0.5 0.5h4c0.2761 0 0.5 -0.22386 0.5 -0.5V1c0 -0.276142 -0.2239 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
        <path 
          id="Vector_3" 
          className={active ? "fill-brand-100 dark:fill-brand-500/40" : "fill-slate-200 dark:fill-slate-700"}
          d="M5 0.5H1C0.723858 0.5 0.5 0.723858 0.5 1v6c0 0.27614 0.223858 0.5 0.5 0.5h4c0.27614 0 0.5 -0.22386 0.5 -0.5V1c0 -0.276142 -0.22386 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
        <path 
          id="Vector_4" 
          className={active ? "fill-brand-100 dark:fill-brand-500/40" : "fill-slate-200 dark:fill-slate-700"}
          d="M5 10.49H1c-0.276142 0 -0.5 0.2239 -0.5 0.5V13c0 0.2761 0.223858 0.5 0.5 0.5h4c0.27614 0 0.5 -0.2239 0.5 -0.5v-2.01c0 -0.2761 -0.22386 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
        
        {/* Stroke layers */}
        <path 
          id="Vector_5" 
          className={active ? "stroke-brand-500" : "stroke-slate-400"}
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M13 6.5H9c-0.27614 0 -0.5 0.22386 -0.5 0.5v6c0 0.2761 0.22386 0.5 0.5 0.5h4c0.2761 0 0.5 -0.2239 0.5 -0.5V7c0 -0.27614 -0.2239 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
        <path 
          id="Vector_6" 
          className={active ? "stroke-brand-500" : "stroke-slate-400"}
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M13 0.5H9c-0.27614 0 -0.5 0.223858 -0.5 0.5v2.01c0 0.27614 0.22386 0.5 0.5 0.5h4c0.2761 0 0.5 -0.22386 0.5 -0.5V1c0 -0.276142 -0.2239 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
        <path 
          id="Vector_7" 
          className={active ? "stroke-brand-500" : "stroke-slate-400"}
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M5 0.5H1C0.723858 0.5 0.5 0.723858 0.5 1v6c0 0.27614 0.223858 0.5 0.5 0.5h4c0.27614 0 0.5 -0.22386 0.5 -0.5V1c0 -0.276142 -0.22386 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
        <path 
          id="Vector_8" 
          className={active ? "stroke-brand-500" : "stroke-slate-400"}
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M5 10.49H1c-0.276142 0 -0.5 0.2238 -0.5 0.5V13c0 0.2761 0.223858 0.5 0.5 0.5h4c0.27614 0 0.5 -0.2239 0.5 -0.5v-2.01c0 -0.2762 -0.22386 -0.5 -0.5 -0.5Z" 
          strokeWidth="1"
        />
      </g>
    </svg>
  );
};
