// src/lib/motion.ts
export const easeOut = [0.16, 1, 0.3, 1];
export const springSmooth = { type: 'spring', stiffness: 300, damping: 30 };
export const springSnappy = { type: 'spring', stiffness: 500, damping: 35 };

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: easeOut },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

export const modalContent = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
  transition: { duration: 0.25, ease: easeOut },
};
