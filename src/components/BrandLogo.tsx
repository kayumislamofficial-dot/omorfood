import { motion } from 'motion/react';

export function OmorFoodMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ওমর ফুড লোগো"
    >
      <rect width="64" height="64" rx="16" fill="#1D4ED8" />
      <rect x="4" y="4" width="56" height="56" rx="13" stroke="#93C5FD" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M19 25.5C19 23.567 20.567 22 22.5 22H41.5C43.433 22 45 23.567 45 25.5L43.2 42.5C42.99 44.48 41.32 46 39.33 46H24.67C22.68 46 21.01 44.48 20.8 42.5L19 25.5Z"
        fill="#FFFFFF"
      />
      <path
        d="M25.5 22V19.5C25.5 15.91 28.41 13 32 13C35.59 13 38.5 15.91 38.5 19.5V22"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="34" r="5.5" fill="#1D4ED8" />
      <path
        d="M32 29.8V38.2M27.8 34H36.2"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SplashLoadingScreen({ subtitle = 'সিস্টেম লোড হচ্ছে...' }: { subtitle?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex flex-col items-center justify-center px-6 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="p-3 rounded-3xl bg-white/10 border border-white/20 shadow-2xl mb-5"
        >
          <OmorFoodMark className="w-20 h-20" />
        </motion.div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          ওমর ফুড
        </h1>
        <p className="text-sm text-blue-100 mt-1.5 font-medium">
          কালিবাড়ী, ঠাকুরগাঁও · স্মার্ট স্টোর ও হিসাব সিস্টেম
        </p>

        <div className="mt-7 w-44 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="w-1/2 h-full bg-white rounded-full"
          />
        </div>
        <p className="text-xs text-blue-100/90 mt-3">{subtitle}</p>
      </motion.div>
    </div>
  );
}
