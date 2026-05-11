type RatingStarsProps = {
  rating: number | null | undefined;
  ariaLabel?: string;
  className?: string;
};

const normalizeRating = (rating: number | null | undefined): number | null => {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) {
    return null;
  }

  const safeRating = Math.min(5, Math.max(0, Math.trunc(numericRating)));
  return safeRating < 1 ? null : safeRating;
};

export const RatingStars = ({ rating, ariaLabel = 'Оценка', className }: RatingStarsProps) => {
  const safeRating = normalizeRating(rating);

  if (safeRating === null) {
    return <span>—</span>;
  }

  return (
    <span className={className ?? 'public-participant-review-stars'} aria-label={`${ariaLabel} ${safeRating} из 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={`star-${index + 1}`}
          className={index < safeRating ? 'public-participant-review-star--active' : 'public-participant-review-star--inactive'}
        >
          ★
        </span>
      ))}
    </span>
  );
};
