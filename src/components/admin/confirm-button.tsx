"use client";

import type { ButtonHTMLAttributes } from "react";

/** Submit button that asks for confirmation first (inside a <form action={serverAction}>). */
export function ConfirmButton({ message, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...props}
    />
  );
}
