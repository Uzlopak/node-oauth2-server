import * as should from 'should';
import { InvalidArgumentError } from '../../../lib/errors';
import { BearerTokenType } from '../../../lib/token-types';

/**
 * Test `BearerTokenType` integration.
 */

describe('BearerTokenType integration', () => {
  describe('constructor()', () => {
    it('should throw an error if `accessToken` is missing', () => {
      try {
        new BearerTokenType(
          undefined as unknown as string,
          undefined,
          'refresh',
          'scope',
        );

        should.fail('should.fail', '');
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `accessToken`');
      }
    });

    it('should set the `accessToken`', () => {
      const responseType = new BearerTokenType(
        'access',
        undefined,
        'refresh',
        'scope',
      );

      responseType.accessToken.should.equal('access');
    });

    it('should set the `accessTokenLifetime`', () => {
      const responseType = new BearerTokenType(
        'access',
        111,
        'refresh',
        'scope',
      );

      (responseType.accessTokenLifetime as number).should.equal(111);
    });

    it('should set the `refreshToken`', () => {
      const responseType = new BearerTokenType(
        'access',
        undefined,
        'refresh',
        'scope',
      );

      responseType.refreshToken.should.equal('refresh');
    });
  });

  describe('valueOf()', () => {
    it('should return the value representation', () => {
      const responseType = new BearerTokenType(
        'access',
        111,
        'refresh',
        'scope',
      );
      const value = responseType.valueOf();

      value.should.eql({
        access_token: 'access',
        expires_in: 111,
        refresh_token: 'refresh',
        scope: 'scope',
        token_type: 'Bearer',
      });
    });

    it('should not include the `expires_in` if not given', () => {
      const responseType = new BearerTokenType(
        'access',
        undefined,
        'refresh',
        'scope',
      );
      const value = responseType.valueOf();

      value.should.eql({
        access_token: 'access',
        refresh_token: 'refresh',
        scope: 'scope',
        token_type: 'Bearer',
      });
    });

    it('should set `refresh_token` if `refreshToken` is defined', () => {
      const responseType = new BearerTokenType(
        'access',
        111,
        'refresh',
        'scope',
      );
      const value = responseType.valueOf();

      value.should.eql({
        access_token: 'access',
        expires_in: 111,
        refresh_token: 'refresh',
        scope: 'scope',
        token_type: 'Bearer',
      });
    });

    it('should set `expires_in` if `accessTokenLifetime` is defined', () => {
      const responseType = new BearerTokenType(
        'access',
        111,
        'refresh',
        'scope',
      );
      const value = responseType.valueOf();

      value.should.eql({
        access_token: 'access',
        expires_in: 111,
        refresh_token: 'refresh',
        scope: 'scope',
        token_type: 'Bearer',
      });
    });
  });
});
