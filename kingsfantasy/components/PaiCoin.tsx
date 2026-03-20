import React from 'react';

type PaiCoinSize = 'xs' | 'sm' | 'md' | 'lg';

const DIMS: Record<PaiCoinSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const PaiCoin: React.FC<{ size?: PaiCoinSize }> = ({ size = 'sm' }) => (
  <img
    src="https://i.imgur.com/4odZyzF.png"
    className={`${DIMS[size]} object-contain invert-[0.1] sepia-[1] saturate-[5] hue-rotate-[210deg]`}
    alt="Moeda PAI"
  />
);

export default PaiCoin;
