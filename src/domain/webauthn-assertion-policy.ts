/**
 * Flags acceptés pour une assertion de la credential racine SAC.
 * UP et UV sont obligatoires. BE, BS, ED, AT et les bits réservés sont refusés.
 */
export function acceptsRootAssertionFlags(flags: number): boolean {
  if (!Number.isInteger(flags) || flags < 0 || flags > 0xff) return false;
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  const forbidden = 0x08 | 0x10 | 0x80 | 0x02 | 0x20 | 0x40;
  return userPresent && userVerified && (flags & forbidden) === 0;
}
