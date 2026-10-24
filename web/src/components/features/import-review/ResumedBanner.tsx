/**
 * Resumed import banner: shown when re-uploading a file that was not yet committed.
 */

export function ResumedBanner() {
  return (
    <div className="banner banner--info">
      <svg
        className="banner__icon"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
      <div className="banner__content">
        <p className="banner__title">
          Resumed your earlier upload
        </p>
        <p className="banner__text">
          Nothing was imported yet.
        </p>
      </div>
    </div>
  );
}
