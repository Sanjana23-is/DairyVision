/**
 * userUtils.ts
 * Helper functions for user identity and display name formatting.
 */

export interface UserLike {
  full_name?: string | null;
  email?: string | null;
}

/**
 * Returns the display name for a farmer/user.
 * - If full_name is present and is not an email address, returns full_name.
 * - If full_name is missing, empty, or equals the email (or contains '@'),
 *   falls back to "Farmer" instead of exposing the raw email.
 */
export function getFarmerDisplayName(user?: UserLike | null): string {
  if (!user) return "Farmer";
  const name = user.full_name?.trim();
  if (
    !name ||
    name === user.email ||
    name.toLowerCase() === (user.email || "").toLowerCase() ||
    name.includes("@")
  ) {
    return "Farmer";
  }
  return name;
}
