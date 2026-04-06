type ToastProps = {
  message: string;
  type?: 'success' | 'error';
};

export const Toast = ({ message, type = 'success' }: ToastProps) => {
  return (
    <div className="toast-layer" role="status" aria-live="polite">
      <div className={`toast toast--${type}`}>{message}</div>
    </div>
  );
};
