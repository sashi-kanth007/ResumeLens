export type ScoreTone = 'success' | 'warning' | 'danger';

export function scoreTone(score: number): ScoreTone {
  if (score >= 70) return 'success';
  if (score >= 45) return 'warning';
  return 'danger';
}

export function scoreLabel(score: number): string {
  if (score >= 70) return 'Strong match';
  if (score >= 45) return 'Partial match';
  return 'Weak match';
}

export function formatScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
