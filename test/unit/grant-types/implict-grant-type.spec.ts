import * as should from 'should';
import * as sinon from 'sinon';
import { ImplicitGrantType } from '../../../lib/grant-types';
import { Client } from '../../../lib/interfaces';

/**
 * Test `ImplicitGrantType`.
 */

describe('ImplicitGrantType', () => {
  describe('saveToken()', () => {
    it('should call `model.saveToken()`', () => {
      const client: Client = { id: 'test', grants: [] };
      const user = {};
      const model = {
        saveToken: sinon.stub().returns(true),
      };
      const handler = new ImplicitGrantType({
        accessTokenLifetime: 120,
        model,
        user,
      });

      sinon.stub(handler, 'validateScope').returns(Promise.resolve('foobar-scope'));
      sinon
        .stub(handler, 'generateAccessToken')
        .returns(Promise.resolve('foobar-token'));
      sinon.stub(handler, 'getAccessTokenExpiresAt').returns(new Date(111));

      return handler
        .saveToken(user, client, 'foobar')
        .then(() => {
          model.saveToken.callCount.should.equal(1);
          model.saveToken.firstCall.args.should.have.length(3);
          model.saveToken.firstCall.args[0].should.eql({
            accessToken: 'foobar-token',
            accessTokenExpiresAt: new Date(111),
            client,
            scope: 'foobar-scope',
            user,
          });
          model.saveToken.firstCall.args[1].should.equal(client);
          model.saveToken.firstCall.args[2].should.equal(user);
          model.saveToken.firstCall.thisValue.should.equal(model);
        });
    });
  });
});
