export function SignOutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className="button button--secondary">
        Sign out
      </button>
    </form>
  );
}
