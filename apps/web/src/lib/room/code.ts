/**
 * Generates a 6-character uppercase alphanumeric room code.
 *
 * Excludes visually ambiguous characters: 0, O, I, L, 1
 * so the code is easy to read aloud or transcribe.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  let code = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[array[i] % ALPHABET.length];
  }
  return code;
}
