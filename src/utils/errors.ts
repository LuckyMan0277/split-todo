/**
 * Error Handling Utility Module
 *
 * Provides user-friendly error messages and AppError creation utilities.
 * Converts technical error codes into actionable messages for users.
 */

import { ErrorCode, AppError } from '../types';

/**
 * Converts an error code into a user-friendly Korean message.
 *
 * Provides clear, actionable error messages that help users understand
 * what went wrong and how to resolve the issue.
 *
 * @param errorCode - The error code to translate
 * @returns User-friendly error message in Korean
 *
 * @example
 * getUserFriendlyMessage(ErrorCode.STORAGE_FULL);
 * // Returns: '저장 공간이 부족합니다. 완료된 할 일을 삭제하거나 백업 후 초기화하세요.'
 *
 * @example
 * getUserFriendlyMessage(ErrorCode.TASK_LIMIT_EXCEEDED);
 * // Returns: '최대 200개의 할 일만 생성할 수 있습니다. 완료된 할 일을 정리하세요.'
 *
 * @example
 * getUserFriendlyMessage(ErrorCode.INVALID_INPUT);
 * // Returns: '입력 내용을 확인해주세요. 제목은 1-120자 사이여야 합니다.'
 */
export function getUserFriendlyMessage(errorCode: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.STORAGE_FULL]:
      '저장 공간이 부족합니다. 완료된 할 일을 삭제하거나 백업 후 초기화하세요.',

    [ErrorCode.PERMISSION_DENIED]: '권한이 필요합니다. 앱 설정에서 파일 접근 권한을 허용해주세요.',

    [ErrorCode.DATA_CORRUPTED]: '저장된 데이터가 손상되었습니다. 백업에서 복원을 시도합니다.',

    [ErrorCode.TASK_LIMIT_EXCEEDED]:
      '최대 200개의 할 일만 생성할 수 있습니다. 완료된 할 일을 정리하세요.',

    [ErrorCode.ITEM_LIMIT_EXCEEDED]:
      '최대 50개의 항목만 추가할 수 있습니다. 새로운 할 일로 분리하세요.',

    [ErrorCode.INVALID_INPUT]: '입력 내용을 확인해주세요. 제목은 1-120자 사이여야 합니다.',

    [ErrorCode.INVALID_BACKUP]: '백업 파일이 유효하지 않습니다. 다른 파일을 선택해주세요.',

    [ErrorCode.UNKNOWN]: '알 수 없는 오류가 발생했습니다. 앱을 재시작하거나 문의해주세요.',
  };

  return messages[errorCode] || messages[ErrorCode.UNKNOWN];
}

/**
 * Creates a structured AppError object with context.
 *
 * Wraps errors with additional context including error code,
 * user-friendly message, recovery actions, and original error.
 *
 * @param code - Error code categorizing the error type
 * @param message - Custom error message (overrides default if provided)
 * @param originalError - Optional original Error object for debugging
 * @returns AppError object with full error context
 *
 * @example
 * // Create a storage full error
 * const error = createAppError(
 *   ErrorCode.STORAGE_FULL,
 *   '저장 공간이 5MB를 초과했습니다'
 * );
 * // Returns: {
 * //   code: 'STORAGE_FULL',
 * //   message: '저장 공간이 5MB를 초과했습니다',
 * //   recoveryAction: '완료된 할 일을 삭제하거나 백업 후 초기화하세요',
 * //   originalError: undefined
 * // }
 *
 * @example
 * // Create an error with original error context
 * try {
 *   JSON.parse('invalid json');
 * } catch (e) {
 *   const error = createAppError(
 *     ErrorCode.DATA_CORRUPTED,
 *     '데이터 파싱에 실패했습니다',
 *     e as Error
 *   );
 * }
 *
 * @example
 * // Create a task limit error with default message
 * const error = createAppError(ErrorCode.TASK_LIMIT_EXCEEDED);
 * // Uses default message from getUserFriendlyMessage()
 */
export function createAppError(code: ErrorCode, message?: string, originalError?: Error): AppError {
  // Use provided message or fall back to default user-friendly message
  const errorMessage = message || getUserFriendlyMessage(code);

  // Define recovery actions for each error type
  const recoveryActions: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.STORAGE_FULL]: '완료된 할 일을 삭제하거나 백업 후 초기화하세요',

    [ErrorCode.PERMISSION_DENIED]: '앱 설정에서 파일 접근 권한을 허용해주세요',

    [ErrorCode.DATA_CORRUPTED]: '백업에서 복원을 시도하거나, 데이터를 초기화하세요',

    [ErrorCode.TASK_LIMIT_EXCEEDED]: '완료된 할 일을 정리하거나 백업 후 초기화하세요',

    [ErrorCode.ITEM_LIMIT_EXCEEDED]: '항목을 줄이거나 새로운 할 일로 분리하세요',

    [ErrorCode.INVALID_INPUT]: '제목을 1-120자 사이로 입력해주세요',

    [ErrorCode.INVALID_BACKUP]: '올바른 백업 파일을 선택해주세요',

    [ErrorCode.UNKNOWN]: '앱을 재시작하거나 개발자에게 문의해주세요',
  };

  const appError: AppError = {
    code,
    message: errorMessage,
    recoveryAction: recoveryActions[code],
    originalError,
  };

  return appError;
}

/**
 * Logs an AppError with full context to the console (development only).
 *
 * Provides detailed error logging for debugging purposes.
 * Only logs in development mode to avoid performance impact in production.
 *
 * @param error - The AppError to log
 *
 * @example
 * const error = createAppError(ErrorCode.STORAGE_FULL);
 * logAppError(error);
 * // Console output (in development):
 * // [AppError] STORAGE_FULL: 저장 공간이 부족합니다...
 * // Recovery: 완료된 할 일을 삭제하거나 백업 후 초기화하세요
 */
export function logAppError(error: AppError): void {
  if (__DEV__) {
    console.error(`[AppError] ${error.code}: ${error.message}`);
    if (error.recoveryAction) {
      console.error(`Recovery: ${error.recoveryAction}`);
    }
    if (error.originalError) {
      console.error('Original error:', error.originalError);
    }
  }
}

/**
 * Checks if an error is an AppError.
 *
 * Type guard to determine if an error object is an AppError
 * with all required fields.
 *
 * @param error - Error to check
 * @returns True if error is an AppError
 *
 * @example
 * const error = createAppError(ErrorCode.UNKNOWN);
 * isAppError(error);
 * // Returns: true
 *
 * @example
 * const error = new Error('Regular error');
 * isAppError(error);
 * // Returns: false
 */
export function isAppError(error: any): error is AppError {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    Object.values(ErrorCode).includes(error.code)
  );
}

/**
 * Converts any error to an AppError.
 *
 * Safely wraps unknown errors into the AppError structure.
 * Useful for catch blocks where error type is unknown.
 *
 * @param error - Error to convert (can be any type)
 * @returns AppError object
 *
 * @example
 * try {
 *   throw new Error('Something went wrong');
 * } catch (error) {
 *   const appError = toAppError(error);
 *   // Returns: AppError with code UNKNOWN
 * }
 *
 * @example
 * try {
 *   throw 'String error';
 * } catch (error) {
 *   const appError = toAppError(error);
 *   // Returns: AppError with message 'String error'
 * }
 */
export function toAppError(error: unknown): AppError {
  // If already an AppError, return as-is
  if (isAppError(error)) {
    return error;
  }

  // If it's a standard Error object
  if (error instanceof Error) {
    return createAppError(ErrorCode.UNKNOWN, error.message, error);
  }

  // If it's a string
  if (typeof error === 'string') {
    return createAppError(ErrorCode.UNKNOWN, error);
  }

  // For any other type, use generic unknown error
  return createAppError(ErrorCode.UNKNOWN);
}
