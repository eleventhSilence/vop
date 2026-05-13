import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminUser } from '@/entities/admin/types';
import { reviewsApi } from '@/entities/review/api';
import type { AdminReview, ReviewStatus } from '@/entities/review/types';
import { AdminReviewOverlay } from '@/pages/admin/components/AdminReviewOverlay';
import { AdminUserOverlay } from '@/pages/admin/components/AdminUserOverlay';
import { extractApiError } from '@/shared/api/client';
import { formatRole, formatStatus } from '@/shared/lib/format';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { Toast } from '@/shared/ui/Toast';

const ROLE_OPTIONS: Array<AdminUser['role']> = ['USER', 'ADMIN'];
const STATUS_OPTIONS: Array<AdminUser['status']> = ['ACTIVE', 'BLOCKED'];

const getReviewStatusTone = (status: ReviewStatus) => {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'accent';
};

const getReviewAuthorLabel = (review: AdminReview) => {
  const fullName = [review.user_first_name, review.user_last_name].filter(Boolean).join(' ').trim();
  return fullName || review.user_email;
};

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const dashboardQuery = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Partial<AdminUser> }) => adminApi.updateUser(userId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditingUser(null);
    },
  });

  const moderateMutation = useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: string; status: ReviewStatus }) => reviewsApi.adminModerate(reviewId, status),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      if (variables.status === 'pending') {
        setToast({ type: 'success', message: 'Отзыв возвращён на модерацию.' });
      } else {
        setSelectedReview(null);
        setToast({ type: 'success', message: variables.status === 'approved' ? 'Отзыв одобрен.' : 'Отзыв отклонён.' });
      }
    },
    onError: (error) => setToast({ type: 'error', message: extractApiError(error) }),
  });

  return (
    <PageSection>
      <div className="section-header"><div><p className="eyebrow">Администрирование</p><h2>Администрирование: обзор</h2></div></div>
      {dashboardQuery.isLoading ? <LoadingState /> : null}
      {dashboardQuery.isError ? <ErrorState message={extractApiError(dashboardQuery.error)} /> : null}
      {dashboardQuery.data ? (
        <>
          <div className="stats-grid">
            <button type="button" className="stat-card stat-card--clickable" onClick={() => navigate('/admin/users')}><span>Пользователи</span><strong>{dashboardQuery.data.users.total_users}</strong></button>
            <button type="button" className="stat-card stat-card--clickable" onClick={() => navigate('/admin/courses')}><span>Курсы</span><strong>{dashboardQuery.data.courses.total_courses}</strong></button>
            <button type="button" className="stat-card stat-card--clickable" onClick={() => navigate('/admin/tests')}><span>Тесты</span><strong>{dashboardQuery.data.testing.total_tests}</strong></button>
            <button type="button" className="stat-card stat-card--clickable" onClick={() => navigate('/admin/reviews')}><span>Отзывы</span><strong>{dashboardQuery.data.reviews.total_reviews}</strong></button>
          </div>
          <div className="details-layout">
            <div className="card card--wide">
              <h3>Последние пользователи</h3>
              <div className="stack-list">
                {dashboardQuery.data.recent_users.length ? dashboardQuery.data.recent_users.map((user) => (
                  <button type="button" className="list-item list-item--clickable" key={user.user_id} onClick={() => setEditingUser(user as AdminUser)}>
                    <strong>{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени'}</strong>
                    <p>{user.email}</p>
                    <p>{formatRole(user.role)} · {formatStatus(user.status)}</p>
                  </button>
                )) : <EmptyState message="Пока нет зарегистрированных пользователей." />}
              </div>
            </div>
            <div className="card">
              <h3>Отзывы на модерации</h3>
              <div className="stack-list">
                {dashboardQuery.data.pending_reviews.length ? (
                  dashboardQuery.data.pending_reviews.map((review) => (
                    <button type="button" className="list-item list-item--clickable" key={review.review_id} onClick={() => setSelectedReview(review as AdminReview)}>
                      <strong>{review.course_title}</strong>
                      <p>{getReviewAuthorLabel(review as AdminReview)}</p>
                      <p>{review.comment}</p>
                    </button>
                  ))
                ) : (
                  <EmptyState message="Нет отзывов, ожидающих модерации." />
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
      {editingUser ? <AdminUserOverlay user={editingUser} draft={editingUser} roleOptions={ROLE_OPTIONS} statusOptions={STATUS_OPTIONS} pending={updateUserMutation.isPending} selfLocked={false} onClose={() => setEditingUser(null)} onChangeDraft={(payload) => setEditingUser((current) => (current ? { ...current, ...payload } : current))} onSave={() => editingUser && updateUserMutation.mutate({ userId: editingUser.user_id, payload: editingUser })} /> : null}
      {selectedReview ? <AdminReviewOverlay review={selectedReview} pending={moderateMutation.isPending} onClose={() => setSelectedReview(null)} onChangeStatus={(status) => moderateMutation.mutate({ reviewId: selectedReview.review_id, status })} getStatusTone={getReviewStatusTone} getAuthorLabel={getReviewAuthorLabel} /> : null}
      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
