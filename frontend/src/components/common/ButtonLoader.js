import React from 'react';

/**
 * A button that shows a spinner + loadingText when `loading` is true.
 * Auto-disables during loading to prevent duplicate submissions.
 */
export default function ButtonLoader({
  loading = false,
  loadingText = 'Processing...',
  children,
  className = 'btn btn-primary',
  disabled = false,
  onClick,
  type = 'button',
  style,
  ...rest
}) {
  return (
    <button
      type={type}
      className={className}
      disabled={loading || disabled}
      onClick={onClick}
      style={style}
      {...rest}
    >
      {loading ? (
        <>
          <span className="spinner spinner-sm" aria-hidden="true" />
          {loadingText}
        </>
      ) : children}
    </button>
  );
}
