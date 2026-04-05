export const LoadingState = ({ message = 'Загрузка...' }: { message?: string }) => (
  <div className="state-box">{message}</div>
);

export const ErrorState = ({ message }: { message: string }) => <div className="state-box state-box--error">{message}</div>;

export const EmptyState = ({ message }: { message: string }) => <div className="state-box">{message}</div>;

export const SuccessState = ({ message }: { message: string }) => <div className="state-box state-box--success">{message}</div>;
