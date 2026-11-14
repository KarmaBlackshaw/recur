import { useCallback, useRef, type BaseSyntheticEvent } from "react";
import {
  useForm,
  type FieldValues,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormHandleSubmit,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";

// react-hook-form's `useForm`, except the form runs one submit at a time. `isSubmitting` disables Save only after a
// re-render, so a second tap landing before it would save again. Every submit this `handleSubmit` builds shares one
// ref, set synchronously on the first tap and cleared once that submit settles, so a failed save can be retried.
export function useAppForm<TFieldValues extends FieldValues = FieldValues, TContext = unknown, TTransformedValues = TFieldValues>(
  props?: UseFormProps<TFieldValues, TContext, TTransformedValues>
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  const methods = useForm<TFieldValues, TContext, TTransformedValues>(props);
  const isRunning = useRef(false);
  const { handleSubmit: submitWith } = methods;

  const handleSubmit = useCallback<UseFormHandleSubmit<TFieldValues, TTransformedValues>>(
    <TResult,>(onValid: SubmitHandler<TTransformedValues, TResult>, onInvalid?: SubmitErrorHandler<TFieldValues>) => {
      const submit = submitWith(onValid, onInvalid);
      return async (e?: BaseSyntheticEvent): Promise<Awaited<TResult> | undefined> => {
        if (isRunning.current) {
          return undefined;
        }
        isRunning.current = true;
        try {
          return await submit(e);
        } finally {
          isRunning.current = false;
        }
      };
    },
    [submitWith]
  );

  return { ...methods, handleSubmit };
}
