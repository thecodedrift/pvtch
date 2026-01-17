import { useEffect } from 'react';
import { useDocumentVisibilityState } from 'rooks';

export const useNoTheme = () => {
  const isDocumentVisible = useDocumentVisibilityState();

  useEffect(() => {
    if (isDocumentVisible) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.remove('light');
      // document.body.style.backgroundColor = '#222222';
    }
  });
};
