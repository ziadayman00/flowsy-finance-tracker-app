/**
 * Error Mapping per Section 10.5
 * Maps HTTP status codes and backend error substrings to calm, friendly Egyptian Arabic.
 * Never displays raw technical English to the user.
 */

export interface UserFriendlyError {
  title: string;
  message: string;
  fieldErrors?: Record<string, string>;
  isNetworkOrTimeout: boolean;
  canRetry: boolean;
}

export function mapBackendError(
  statusCode: number,
  rawError?: string,
  rawMessage?: string | string[],
): UserFriendlyError {
  const msgStr = Array.isArray(rawMessage)
    ? rawMessage.join('; ')
    : rawMessage || rawError || '';

  // 1. Network / Timeout
  if (statusCode === 0 || msgStr.includes('Network') || msgStr.includes('Failed to fetch')) {
    return {
      title: 'تعذر الاتصال',
      message: 'مفيش اتصال بالخادم — تأكد من تشغيل السيرفر والإنترنت وحاول تاني.',
      isNetworkOrTimeout: true,
      canRetry: true,
    };
  }

  // 2. Authentication
  if (statusCode === 401) {
    if (msgStr.includes('Invalid refresh token') || msgStr.includes('Refresh token has expired')) {
      return {
        title: 'انتهت الجلسة',
        message: 'انتهت مدة تسجيل الدخول. سجّل دخولك تاني للمتابعة.',
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }
    return {
      title: 'خطأ في الدخول',
      message: 'الإيميل أو كلمة السر غلط.',
      isNetworkOrTimeout: false,
      canRetry: true,
    };
  }

  // 3. Rate Limiting
  if (statusCode === 429) {
    return {
      title: 'مهلاً قليلاً',
      message: 'محاولات كتير ورا بعض — استنى شوية وحاول تاني.',
      isNetworkOrTimeout: false,
      canRetry: true,
    };
  }

  // 4. Conflicts (409)
  if (statusCode === 409) {
    if (msgStr.includes('email') || msgStr.includes('already exists')) {
      return {
        title: 'الحساب موجود بالفعل',
        message: 'الإيميل ده مسجّل قبل كده. سجّل دخولك مباشرة.',
        fieldErrors: { email: 'الإيميل ده مسجّل قبل كده' },
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }
    if (msgStr.includes('name') || msgStr.includes('account')) {
      return {
        title: 'الاسم مستخدم',
        message: 'الاسم ده مستخدم لحساب تاني — اختار اسم مختلف.',
        fieldErrors: { name: 'الاسم ده مستخدم' },
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }
    return {
      title: 'تعارض في البيانات',
      message: 'يوجد عنصر بنفس البيانات مسجّل بالفعل.',
      isNetworkOrTimeout: false,
      canRetry: false,
    };
  }

  // 5. System Category Protection (403)
  if (statusCode === 403) {
    return {
      title: 'غير مسموح',
      message: 'التصنيفات الأساسية للنظام مش بتتعدل ولا بتتحذف.',
      isNetworkOrTimeout: false,
      canRetry: false,
    };
  }

  // 6. Not Found (404)
  if (statusCode === 404) {
    return {
      title: 'غير موجود',
      message: 'العنصر ده مبقاش متاح أو اتحذف.',
      isNetworkOrTimeout: false,
      canRetry: false,
    };
  }

  // 7. Bad Request / Validation (400)
  if (statusCode === 400) {
    // Specific business constraints
    if (msgStr.includes('Cross-currency transfers are not supported')) {
      return {
        title: 'تحويل غير مسموح',
        message: 'مش ممكن تحوّل بين حسابين بعملتين مختلفتين.',
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }

    if (msgStr.includes('Cross-currency payments are not supported')) {
      return {
        title: 'سداد غير مسموح',
        message: 'اختار حساب بنفس عملة الالتزام لسداده.',
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }

    if (msgStr.includes('already been marked as paid')) {
      return {
        title: 'مسدد بالفعل',
        message: 'الالتزام ده اتسدّد قبل كده.',
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }

    if (msgStr.includes('Cannot permanently delete an account with recorded transactions')) {
      return {
        title: 'الحساب يحتوي معاملات',
        message: 'الحساب عليه معاملات مسجلة — أرشفه بدل الحذف عشان تحافظ على تاريخك المالي.',
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }

    if (msgStr.includes('linked to commitments')) {
      return {
        title: 'الحساب مرتبط بالتزام',
        message: 'الحساب مرتبط بالتزامات — أرشفه أو فكّ الربط الأول.',
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }

    if (msgStr.includes('Cannot delete category with associated')) {
      return {
        title: 'التصنيف مستخدم',
        message: 'التصنيف ده مستخدم في معاملات — أرشفه بدل الحذف.',
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }

    // Validation array parsing
    if (Array.isArray(rawMessage)) {
      const fieldErrors: Record<string, string> = {};
      for (const err of rawMessage) {
        if (err.includes('amount')) fieldErrors.amount = 'أدخل مبلغ صحيح أكبر من الصفر';
        else if (err.includes('accountId')) fieldErrors.accountId = 'حدد الحساب المالي';
        else if (err.includes('email')) fieldErrors.email = 'أدخل بريد إلكتروني صحيح';
        else if (err.includes('password')) fieldErrors.password = 'كلمة السر 8 حروف على الأقل';
        else if (err.includes('name')) fieldErrors.name = 'أدخل اسماً صحيحاً';
        else if (err.includes('destinationAccountId')) fieldErrors.destinationAccountId = 'حدد الحساب المحول إليه';
      }

      return {
        title: 'بيانات غير مكتملة',
        message: 'راجع البيانات المدخلة وتأكد من صحتها.',
        fieldErrors,
        isNetworkOrTimeout: false,
        canRetry: false,
      };
    }

    return {
      title: 'طلب غير صحيح',
      message: 'تعذر حفظ البيانات بسبب عدم توافق المدخلات.',
      isNetworkOrTimeout: false,
      canRetry: false,
    };
  }

  // 8. Server Errors (5xx)
  if (statusCode >= 500) {
    return {
      title: 'مشكلة في الخادم',
      message: 'حصلت مشكلة مؤقتة في الخادم — حاول بعد شوية.',
      isNetworkOrTimeout: false,
      canRetry: true,
    };
  }

  return {
    title: 'حدث خطأ',
    message: 'تعذر إتمام العملية — حاول مرة أخرى.',
    isNetworkOrTimeout: false,
    canRetry: true,
  };
}

export function getErrorMessage(err: unknown): string {
  if (!err) return 'تعذر إتمام العملية';
  if (typeof err === 'string') return err;

  const anyErr = err as any;
  const statusCode = anyErr.statusCode || anyErr.status || 0;
  const rawError = anyErr.error || anyErr.name || '';
  const rawMessage = anyErr.message || anyErr.data?.message;

  const mapped = mapBackendError(statusCode, rawError, rawMessage);
  return mapped.message;
}
