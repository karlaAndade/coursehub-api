export function shouldSynchronizeSchema(
  nodeEnvironment: string,
  requestedSynchronize: string | undefined,
  databaseName: string,
): boolean {
  if (requestedSynchronize !== 'true') return false;
  if (nodeEnvironment === 'development') return true;

  return nodeEnvironment === 'test' && databaseName.endsWith('_test');
}
