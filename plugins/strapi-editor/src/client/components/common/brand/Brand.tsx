import React from 'react';
import logo from '../../../../../assets/icon.svg';

type Props = { compact?: boolean };
export const Brand: React.FC<Props> = ({ compact = false }) => (
  <div className={`brand${compact ? ' compact' : ''}`} aria-label="pargoo Strapi (Apple Silicon)">
    <img className="brand-icon" src={logo} alt="" />
    <span>{compact ? 'pargoo' : 'pargoo Strapi (Apple Silicon)'}</span>
  </div>
);
