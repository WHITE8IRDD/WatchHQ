// src/components/common/Toast.tsx
import React, { useEffect, useState } from 'react';
import { create } from 'zustand';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  remove: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

// Shorthand
export const toast = {
  success: (message: string) => useToastStore.getState().add({ type: 'success', message }),
  error: (message: string) => useToastStore.getState().add({ type: 'error', message }),
  info: (message: string) => useToastStore.getState().add({ type: 'info', message }),
};

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colorMap = {
  success: 'border-success/30 bg-success/5',
  error: 'border-error/30 bg-error/5',
  info: 'border-accent/30 bg-accent/5',
};

const iconColorMap = {
  success: 'text-success',
  error: 'text-error',
  info: 'text-accent',
};

const ToastItem: React.FC<{ item: ToastItem; onRemove: () => void }> = ({ item, onRemove }) => {
  const Icon = iconMap[item.type];

  useEffect(() => {
    const timer = setTimeout(onRemove, item.duration || 4000);
    return () => clearTimeout(timer);
  }, [onRemove, item.duration]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorMap[item.type]} 
                  backdrop-blur-xl shadow-lg animate-slide-in-right min-w-[300px] max-w-[450px]`}
    >
      <Icon size={18} className={`flex-shrink-0 ${iconColorMap[item.type]}`} />
      <p className="text-sm text-white flex-1">{item.message}</p>
      <button
        onClick={onRemove}
        className="text-textSecondary hover:text-white transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, remove } = useToastStore();

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onRemove={() => remove(t.id)} />
      ))}
    </div>
  );
};
