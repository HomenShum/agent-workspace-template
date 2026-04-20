/**
 * DirectoryClearFilters — server-component reset button.
 *
 * A plain <form action="/"> with method="get" and a single submit button
 * clears every URL param in one navigation, no JS required. This is the
 * canonical "URL as single source of truth" pattern: the server redraws
 * with an empty searchParams object and re-renders PacksDirectory in its
 * default state.
 *
 * No "use client" — this component ships zero JS.
 */
export function DirectoryClearFilters({
  label = "Reset view",
  testId = "directory-reset",
  className = "directory-reset-button",
}: {
  label?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <form action="/" method="get" className="inline-flex">
      <button type="submit" className={className} data-testid={testId}>
        {label}
      </button>
    </form>
  );
}
