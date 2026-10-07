// Les erreurs métier renvoyées à l'interface : un code stable, un message
// lisible, et quand c'est utile l'action qui débloque ("Configurer un provider").

export type StudioErrorCode = 'provider_not_configured' | 'not_found' | 'forbidden' | 'invalid' | 'conflict' | 'unsupported';

const STATUS: Record<StudioErrorCode, number> = {
  provider_not_configured: 424,
  not_found: 404,
  forbidden: 403,
  invalid: 400,
  conflict: 409,
  unsupported: 422,
};

export class StudioError extends Error {
  constructor(
    public code: StudioErrorCode,
    message: string,
    public action?: { label: string; href: string },
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export const notConfigured = (what: string) =>
  new StudioError('provider_not_configured', `Provider non configuré : aucun modèle ${what} n’est disponible.`, { label: 'Configurer un provider', href: '/settings/providers' });
