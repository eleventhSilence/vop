import { isAxiosError } from 'axios';

export const extractApiError = (error: unknown) => {
  if (isAxiosError(error)) {
    const detail = error.response?.data;

    if (typeof detail === 'string') {
      return detail;
    }

    if (detail && typeof detail === 'object') {
      if ('detail' in detail && typeof detail.detail === 'string') {
        return detail.detail;
      }

      const firstEntry = Object.entries(detail)[0];
      if (firstEntry) {
        const [, value] = firstEntry;
        if (Array.isArray(value)) {
          return String(value[0]);
        }
        return String(value);
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Произошла неизвестная ошибка.';
};
