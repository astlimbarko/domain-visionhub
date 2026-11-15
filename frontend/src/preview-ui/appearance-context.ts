import { createContext } from 'react';

export const AppearanceContext = createContext<{
  mode: 'light' | 'dark';
  toggle: () => void;
} | null>(null);