export async function resolve(specifier,context,nextResolve){return nextResolve(['next/link','next/navigation'].includes(specifier)?specifier+'.js':specifier,context)}
