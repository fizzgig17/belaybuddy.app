import { createContext, useContext } from 'react';

/** True inside sheets that should fit without scrolling: text, fields, buttons and cards get tighter. */
export const CompactContext = createContext(false);
export const useCompact = () => useContext(CompactContext);
