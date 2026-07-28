
import React from 'react';

interface ShopIconProps {
  className?: string;
}

export const ShopIcon: React.FC<ShopIconProps> = ({ className }) => {
  return (
    <svg 
      id="Shop--Streamline-Atlas" 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="-0.5 -0.5 16 16" 
      height="16" 
      width="16"
      className={className}
      stroke="currentColor"
    >
      <desc>
        Shop Streamline Icon: https://streamlinehq.com
      </desc>
      <path d="M10.78125 0.9375H2.25L0.9375 4.21875a1.575 1.575 0 0 0 1.6375000000000002 1.4937500000000001 1.575 1.575 0 0 0 1.6437499999999998 -1.4937500000000001 1.575 1.575 0 0 0 1.6437499999999998 1.4937500000000001A1.575 1.575 0 0 0 7.5 4.21875a1.575 1.575 0 0 0 1.6375000000000002 1.4937500000000001 1.575 1.575 0 0 0 1.6437499999999998 -1.4937500000000001 1.575 1.575 0 0 0 1.6437499999999998 1.4937500000000001 1.575 1.575 0 0 0 1.6375000000000002 -1.4937500000000001L12.75 0.9375Z" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="m4.21875 4.518750000000001 0.09375 -0.5 0.5625 -3.08125" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="M10.78125 4.518750000000001 10.125 0.9375" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="m7.5 0.9375 0 3.5812500000000003" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="m12.86875 5.7125 0 8.35 -10.7375 0 0 -8.35" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="m0.34375 14.0625 14.3125 0" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="M5.1125 8.69375h4.7749999999999995v5.36875H5.1125Z" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="m2.13125 11.08125 2.9812499999999997 0" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
      <path d="m9.8875 11.08125 2.9812499999999997 0" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"></path>
    </svg>
  );
};
