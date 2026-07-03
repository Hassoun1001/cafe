import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Studio Cafe backend listening on port ${config.port} (${config.nodeEnv})`);
});
