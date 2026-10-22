// AI requests return drafts; they do not write project records or expose the key.
export function projectMethodAllowed(access, pathname, method) {
 if (!['editor', 'viewer'].includes(access)) return false;
 if (access === 'editor' || ['GET', 'HEAD'].includes(method)) return true;
 return method === 'POST' && ['/api/ai/analyze', '/api/ai/evidence', '/api/ai/research'].includes(pathname);
}
