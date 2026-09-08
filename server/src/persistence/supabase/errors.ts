export type PersistenceErrorCode =
  | 'PERSISTENCE_NOT_CONFIGURED'
  | 'PERSISTENCE_QUERY_FAILED'
  | 'PERSISTENCE_CONSTRAINT_VIOLATION'
  | 'PERSISTENCE_DUPLICATE_CLAIM'
  | 'PERSISTENCE_INVALID_DATA';

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly cause?: unknown;

  constructor(code: PersistenceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    this.cause = cause;
  }
}

export function toPersistenceError(
  context: string,
  error: { code?: string; message?: string } | null | undefined
): PersistenceError {
  if (error?.code === '23505') {
    return new PersistenceError(
      'PERSISTENCE_DUPLICATE_CLAIM',
      `${context}: duplicate persistent claim`,
      error
    );
  }

  if (error?.code?.startsWith('23')) {
    return new PersistenceError(
      'PERSISTENCE_CONSTRAINT_VIOLATION',
      `${context}: database constraint rejected the operation`,
      error
    );
  }

  return new PersistenceError(
    'PERSISTENCE_QUERY_FAILED',
    `${context}: persistence operation failed`,
    error
  );
}
