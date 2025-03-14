import { useState, useEffect } from 'react';

/**
 * Custom hook để tạo giá trị debounced
 * @param value Giá trị cần debounce
 * @param delay Thời gian delay tính bằng milliseconds
 * @returns Giá trị đã được debounce
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Tạo một timeout để update debouncedValue sau khoảng thời gian delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function để clear timeout nếu value thay đổi
    // Điều này đảm bảo chúng ta không bị memory leak
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]); // Chỉ re-run effect nếu value hoặc delay thay đổi

  return debouncedValue;
}

export default useDebounce; 