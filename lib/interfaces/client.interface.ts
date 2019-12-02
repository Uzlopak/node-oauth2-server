/**
 * An interface representing the client and associated data
 */
export interface Client {
  id: string;
  redirectUris?: string | string[];
  grants: string[];
  accessTokenLifetime?: number;
  refreshTokenLifetime?: number;
  [key: string]: any;
}
