import * as should from 'should';

/**
 * SHA-1 assertion.
 */
// XXX: The shouldjs typing are missing this part
(should as any).Assertion.add(
  'sha1',
  function() {
    this.params = { operator: 'to be a valid SHA-1 hash' };
    this.obj.should.match(/^[a-f0-9]{40}$/i);
  },
  true,
);

declare global {
  namespace should {
    interface Assertion {
      sha1(): this;
    }
  }
}
