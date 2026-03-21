import React from 'react';
import { ConversionSettings } from '../types';

interface Props {
  settings: ConversionSettings;
  onChange: (s: ConversionSettings) => void;
}

// This component is kept for potential future use but all settings
// are now displayed directly in app.tsx as always-visible controls
export const ConversionSettingsPanel: React.FC<Props> = ({ settings, onChange }) => {
  return null; // All settings now inline in app.tsx
};
