import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkHubServer } from './backend.mjs';
export { createWorkHubServer } from './backend.mjs';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createWorkHubServer({ dataDir: process.env.WORK_HUB_DATA_DIR });
  server.listen(Number(process.env.PORT || 4317), '127.0.0.1', () => {
    console.log(`Work Hub: http://localhost:${server.address().port}`);
    console.log(`Data: ${server.workspace.dataDir}`);
  });
}
