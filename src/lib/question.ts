import type { Option } from '../types';

export function generateOptions(count: number): Option[] {
  return Array.from({ length: count }, (_, i) => ({
    key: String.fromCharCode(65 + i),
    text: '',
  }));
}
