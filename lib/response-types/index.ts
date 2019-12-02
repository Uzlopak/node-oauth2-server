import { Request } from '../request';
import { Client, User } from '../interfaces';

export interface ResponseType {
  // XXX: Work out the requirements for the return type
  // XXX: Naming: ResponseTypeHandler? That allows ResponseType for the return type ...
  handle(
    request: Request,
    client: Client,
    user: User,
    uri: string,
    scope: string,
  ): Promise<{client: Client; user: User}>;
  // XXX: 'any' is likely "legacy urlObject"
  buildRedirectUri(redirectUri: any);
}

export { CodeResponseType } from './code-response-type';
export { TokenResponseType } from './token-response-type';
