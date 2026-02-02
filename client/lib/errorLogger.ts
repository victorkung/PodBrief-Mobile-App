import { supabase } from "@/lib/supabase";

interface LogErrorParams {
  errorMessage: string;
  errorSource: string;
  url: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export async function logErrorToServer({
  errorMessage,
  errorSource,
  url,
  errorCode,
  metadata,
}: LogErrorParams): Promise<void> {
  try {
    await supabase.functions.invoke('log-error', {
      body: {
        error_message: errorMessage,
        error_source: errorSource,
        url: url,
        error_code: errorCode,
        metadata: metadata,
      },
    });
  } catch (err) {
    console.error('[logErrorToServer] Failed to log error:', err);
  }
}

export function createErrorHandler(screenName: string) {
  return (error: Error, stackTrace?: string) => {
    logErrorToServer({
      errorMessage: error.message,
      errorSource: 'mobile_app',
      url: screenName,
      errorCode: error.name,
      metadata: {
        stack: error.stack,
        componentStack: stackTrace,
        platform: 'mobile',
      },
    });
  };
}
