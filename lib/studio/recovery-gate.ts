/** Estetään muokkaukset kunnes käyttäjä ratkaisee käynnistyksen palautuspisteen. */
export const RECOVERY_EDIT_BLOCK =
  'Ratkaise palautuspisteen palautus tai hylkääminen ennen muokkaamista.';

export function isRecoveryEditBlock(message: string): boolean {
  return message === RECOVERY_EDIT_BLOCK;
}
