"use client";

export function SignOutButton() {
  async function handleSignOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="button button--secondary"
    >
      Sign out
    </button>
  );
}
