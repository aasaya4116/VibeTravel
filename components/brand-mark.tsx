interface BrandMarkProps {
  className?: string
  title?: string
}

/**
 * VibeTravel's Open Passage mark.
 *
 * Keep this geometry and palette aligned with
 * docs/brand/logo-concepts/02-open-passage.svg.
 */
export function BrandMark({ className = "", title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <rect width="512" height="512" rx="112" fill="#171512" />
      <path
        d="M142 374V242c0-78 51-132 114-132s114 54 114 132v132"
        fill="none"
        stroke="#F3EFE7"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <path
        d="M191 375c0-66 23-94 61-126 35-30 58-56 72-98"
        fill="none"
        stroke="#A65636"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <circle cx="327" cy="141" r="18" fill="#C8A96E" />
    </svg>
  )
}
