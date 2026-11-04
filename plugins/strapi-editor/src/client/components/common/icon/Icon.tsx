import React from 'react';

type Props = { name: 'settings' | 'check' | 'trash' };
export const Icon: React.FC<Props> = ({ name }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {name === 'check' ? (
      <path d="m5 12 4 4L19 6" />
    ) : name === 'trash' ? (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ) : (
      <>
        <path d="m9.5 3-.7 2.2-2 .9-2.1-.4-2.5 4.3 1.5 1.8v2.3l-1.5 1.6 2.5 4.4 2.2-.5 1.9 1 .7 2.1h5l.7-2.1 2-1 2.1.5 2.5-4.4-1.5-1.7v-2.2l1.5-1.8-2.5-4.3-2.2.4-1.9-.9L14.5 3z" />
        <circle cx="12" cy="12.5" r="3" />
      </>
    )}
  </svg>
);
