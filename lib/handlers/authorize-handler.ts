import * as url from 'url';
import { AuthenticateHandler } from '.';
import {
  AccessDeniedError,
  InvalidArgumentError,
  InvalidClientError,
  InvalidRequestError,
  InvalidScopeError,
  OAuthError,
  ServerError,
  UnauthorizedClientError,
  UnsupportedResponseTypeError,
} from '../errors';
import { Client, Model, User } from '../interfaces';
import { Request } from '../request';
import { Response } from '../response';
import { CodeResponseType, TokenResponseType, ResponseType } from '../response-types';
import { hasOwnProperty } from '../utils/fn';
import * as is from '../validator/is';

/**
 * Response types.
 */

const responseTypes: {[type: string]: new (options: any) => ResponseType} = {
  code: CodeResponseType,
  token: TokenResponseType,
};

/**
 * Constructor.
 */

export class AuthorizeHandler {
  options: any;
  allowEmptyState: boolean;
  authenticateHandler: any;
  model: Model;
  constructor(options: any = {}) {
    if (options.authenticateHandler && !options.authenticateHandler.handle) {
      throw new InvalidArgumentError(
        'Invalid argument: authenticateHandler does not implement `handle()`',
      );
    }

    if (!options.model) {
      throw new InvalidArgumentError('Missing parameter: `model`');
    }

    if (!options.model.getClient) {
      throw new InvalidArgumentError(
        'Invalid argument: model does not implement `getClient()`',
      );
    }

    this.options = options;
    this.allowEmptyState = options.allowEmptyState;
    this.authenticateHandler =
      options.authenticateHandler || new AuthenticateHandler(options);
    this.model = options.model;
  }

  /**
   * Authorize Handler.
   */

  async handle(request: Request, response: Response) {
    if (!(request instanceof Request)) {
      throw new InvalidArgumentError(
        'Invalid argument: `request` must be an instance of Request',
      );
    }

    if (!(response instanceof Response)) {
      throw new InvalidArgumentError(
        'Invalid argument: `response` must be an instance of Response',
      );
    }

    if (request.query.allowed === 'false') {
      throw new AccessDeniedError(
        'Access denied: user denied access to application',
      );
    }

    // Extend model object with request
    this.model.request = request;

    const client = await this.getClient(request);
    const user = await this.getUser(request, response);

    let scope: string;
    let state: string | undefined;
    let RequestedResponseType: new (options: any) => ResponseType;
    let responseType: any;
    const uri = this.getRedirectUri(request, client);
    try {
      // Pull out the state first, because RFC 6749, 4.1.2.1 requires us
      // to provide the `state` in errors when it was provided in the request.
      state = this.getState(request);
      const requestedScope = this.getScope(request);

      const validScope = await this.validateScope(user, client, requestedScope);
      scope = validScope;
      // tslint:disable-next-line: no-inferred-empty-object-type
      RequestedResponseType = this.getResponseType(request, client);
      responseType = new RequestedResponseType(this.options);
      const codeOrAccessToken = await responseType.handle(
        request,
        client,
        user,
        uri,
        scope,
      );
      const redirectUri = this.buildSuccessRedirectUri(uri, responseType);
      this.updateResponse(response, redirectUri, responseType, state);

      return codeOrAccessToken;
    } catch (e) {
      if (!(e instanceof OAuthError)) {
        e = new ServerError(e);
      }

      const redirectUri = this.buildErrorRedirectUri(uri, responseType, e);

      this.updateResponse(response, redirectUri, responseType, state);

      throw e;
    }
  }

  /**
   * Get the client from the model.
   */

  async getClient(request: Request) {
    const clientId = request.body.client_id || request.query.client_id;

    if (!clientId) {
      throw new InvalidRequestError('Missing parameter: `client_id`');
    }

    if (!is.vschar(clientId)) {
      throw new InvalidRequestError('Invalid parameter: `client_id`');
    }

    const redirectUri = request.body.redirect_uri || request.query.redirect_uri;

    if (redirectUri && !is.uri(redirectUri)) {
      throw new InvalidRequestError(
        'Invalid request: `redirect_uri` is not a valid URI',
      );
    }

    const client = await this.model.getClient(clientId);
    if (!client) {
      throw new InvalidClientError(
        'Invalid client: client credentials are invalid',
      );
    }

    if (!client.grants) {
      throw new InvalidClientError('Invalid client: missing client `grants`');
    }

    const responseType =
      request.body.response_type || request.query.response_type;
    const requestedGrantType =
      responseType === 'token' ? 'implicit' : 'authorization_code';

    if (!client.grants.includes(requestedGrantType)) {
      throw new UnauthorizedClientError(
        'Unauthorized client: `grant_type` is invalid',
      );
    }

    if (!client.redirectUris || client.redirectUris.length === 0) {
      throw new InvalidClientError(
        'Invalid client: missing client `redirectUri`',
      );
    }

    if (redirectUri && !client.redirectUris.includes(redirectUri)) {
      throw new InvalidClientError(
        'Invalid client: `redirect_uri` does not match client value',
      );
    }

    return client;
  }

  /**
   * Validate requested scope.
   */
  async validateScope(user: User, client: Client, scope: string) {
    if (this.model.validateScope) {
      const validatedScope = await this.model.validateScope(
        user,
        client,
        scope,
      );
      if (!validatedScope) {
        throw new InvalidScopeError(
          'Invalid scope: Requested scope is invalid',
        );
      }

      return validatedScope;
    }

    return scope;
  }

  /**
   * Get scope from the request.
   */

  getScope(request: Request) {
    const scope = request.body.scope || request.query.scope;

    if (!is.nqschar(scope)) {
      throw new InvalidScopeError('Invalid parameter: `scope`');
    }

    return scope;
  }

  /**
   * Get state from the request.
   */

  getState(request: Request) {
    const state = request.body.state || request.query.state;

    if (!this.allowEmptyState && !state) {
      throw new InvalidRequestError('Missing parameter: `state`');
    }

    if (!is.vschar(state)) {
      throw new InvalidRequestError('Invalid parameter: `state`');
    }

    return state;
  }

  /**
   * Get user by calling the authenticate middleware.
   */

  async getUser(request: Request, response: Response) {
    if (this.authenticateHandler instanceof AuthenticateHandler) {
      const data = await this.authenticateHandler.handle(request, response);

      return data.user;
    }

    const user = await this.authenticateHandler.handle(request, response);
    if (!user) {
      throw new ServerError(
        'Server error: `handle()` did not return a `user` object',
      );
    }

    return user;
  }

  /**
   * Get redirect URI.
   */

  getRedirectUri(request: Request, client: Client) {
    return (
      request.body.redirect_uri ||
      request.query.redirect_uri ||
      Array.isArray(client.redirectUris) && client.redirectUris.length > 0 && client.redirectUris[0]
    );
  }

  /**
   * Get response type.
   */

  getResponseType(request: Request, client: Client) {
    const responseType =
      request.body.response_type || request.query.response_type;

    if (!responseType) {
      throw new InvalidRequestError('Missing parameter: `response_type`');
    }

    if (!hasOwnProperty(responseTypes, responseType)) {
      throw new UnsupportedResponseTypeError(
        'Unsupported response type: `response_type` is not supported',
      );
    }

    if (
      responseType === 'token' &&
      (!client || !client.grants.includes('implicit'))
    ) {
      throw new UnauthorizedClientError(
        'Unauthorized client: `grant_type` is invalid',
      );
    }

    return responseTypes[responseType];
  }

  /**
   * Build a successful response that redirects the user-agent to the client-provided url.
   */

  buildSuccessRedirectUri(
    redirectUri: string,
    responseType: ResponseType,
  ) {
    const uri = url.parse(redirectUri);

    return responseType.buildRedirectUri(uri);
  }

  /**
   * Build an error response that redirects the user-agent to the client-provided url.
   */

  buildErrorRedirectUri(
    redirectUri: any,
    responseType: CodeResponseType | TokenResponseType,
    error: Error,
  ) {
    let uri = url.parse(redirectUri, true);

    if (responseType) {
      uri = responseType.setRedirectUriParam(uri, 'error', error.name);

      if (error.message) {
        uri = responseType.setRedirectUriParam(
          uri,
          'error_description',
          error.message,
        );
      }
    } else {
      uri.query = {
        error: error.name,
      };

      if (error.message) {
        uri.query.error_description = error.message;
      }
    }

    return uri;
  }

  /**
   * Update response with the redirect uri and the state parameter, if available.
   */

  updateResponse(
    response: Response,
    redirectUri: any,
    responseType: CodeResponseType | TokenResponseType,
    state: any,
  ) {
    if (responseType && state) {
      // tslint:disable-next-line:no-parameter-reassignment
      redirectUri = responseType.setRedirectUriParam(
        redirectUri,
        'state',
        state,
      );
    } else if (state) {
      redirectUri.query = redirectUri.query || {};
      redirectUri.query.state = state;
    }

    response.redirect(url.format(redirectUri));
  }
}
