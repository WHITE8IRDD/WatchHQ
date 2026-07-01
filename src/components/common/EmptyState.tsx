// src/components/common/EmptyState.tsx
import React from 'react';
import { IconContext } from '@phosphor-icons/react';

interface EmptyStateProps {
  icon: React.FC<any>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
        <Icon size={28} className="text-text-tertiary" />
      </div>
      <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
      <p className="text-text-secondary text-sm max-w-sm mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-accent-hover transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
