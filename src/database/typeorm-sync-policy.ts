export function shouldSynchronizeSchema(
  nodeEnvironment: string,
  requestedSynchronize: string | undefined,
): boolean {
  return (
    nodeEnvironment === 'development' && requestedSynchronize === 'true'
  );
}