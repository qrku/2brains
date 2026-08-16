'use client';

import { useEffect, useState } from 'react';

const PREVIEW_WIDTH_KEY = 'space_editor_preview_width';
const DEFAULT_PREVIEW_WIDTH = 70;

/** Ширина текста в визуальном режиме — сохраняется в localStorage между сессиями. */
export function usePreviewWidth() {
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(PREVIEW_WIDTH_KEY));
      if (saved) setPreviewWidth(saved);
    } catch {}
  }, []);

  const handlePreviewWidthChange = (val: number) => {
    setPreviewWidth(val);
    try {
      localStorage.setItem(PREVIEW_WIDTH_KEY, String(val));
    } catch {}
  };

  return { previewWidth, handlePreviewWidthChange };
}
