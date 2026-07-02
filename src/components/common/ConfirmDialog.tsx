// src/components/common/ConfirmDialog.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WarningCircle } from '@phosphor-icons/react';
import { modalOverlay, modalContent } from '../../lib/motion';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        {...modalOverlay}
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <motion.div
          className="w-full max-w-md bg-bg-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
          {...modalContent}
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${variant === 'danger' ? 'bg-state-error/10' : 'bg-white/10'}`}>
                <WarningCircle size={20} weight="fill" className={variant === 'danger' ? 'text-state-error' : 'text-white'} />
              </div>
              <h3 className="font-display font-semibold text-lg">{title}</h3>
            </div>
            <p className="text-text-secondary text-sm">{message}</p>
          </div>
          <div className="flex gap-3 p-6 pt-0">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-white hover:bg-white/5 transition-colors text-sm">
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                variant === 'danger' ? 'bg-state-error text-white hover:bg-state-error/80' : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
