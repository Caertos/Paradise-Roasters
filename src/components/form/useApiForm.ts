import { useState } from "react";
import { ApiError, type FieldErrors } from "../../lib/api";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Tracks a form submission: disables the form while it runs, maps a 422
 * `errors` object to fields, and keeps the top-level message otherwise.
 */
export function useApiForm() {
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(action: () => Promise<void>): Promise<boolean> {
    setSubmitting(true);
    setFieldErrors({});
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      if (caught instanceof ApiError) {
        const hasFieldErrors =
          caught.status === 422 &&
          caught.errors !== undefined &&
          Object.keys(caught.errors).length > 0;
        if (hasFieldErrors) setFieldErrors(caught.errors ?? {});
        else setError(caught.message || GENERIC_ERROR);
      } else {
        setError(GENERIC_ERROR);
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, fieldErrors, error, submit };
}
