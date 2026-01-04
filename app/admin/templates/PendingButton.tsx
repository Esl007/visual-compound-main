"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
};

export function PendingButton({ pendingText = "Submitting...", children, disabled, className = "", ...rest }: Props) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <button
      {...rest}
      type={rest.type || "submit"}
      className={className + (isDisabled ? " opacity-70 cursor-not-allowed" : "")}
      disabled={isDisabled}
      aria-busy={pending}
      aria-disabled={isDisabled}
    >
      {pending ? pendingText : children}
    </button>
  );
}
