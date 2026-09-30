/** Returns an error message if confirm does not match password, otherwise an empty string. */
export function validateConfirmPassword(password: string, confirm: string): string {
  const value = confirm ? String(confirm).trim() : '';
  if (!value) return 'Please confirm your password';
  if (value !== password) return 'Passwords do not match';
  return '';
}
