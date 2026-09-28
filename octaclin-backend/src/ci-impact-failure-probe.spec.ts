// Teste temporario: confirma que uma falha Backend reprova o PR Gate.
describe('CI impact failure probe', () => {
  it('fails intentionally', () => {
    expect('expected').toBe('actual');
  });
});
