import path from 'path';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { notFoundMiddleware, errorMiddleware } from './middleware/error';
import { authRouter } from './routes/auth';
import { menuRouter } from './routes/menu';
import { tablesRouter } from './routes/tables';
import { ordersRouter } from './routes/orders';
import { stockRouter } from './routes/stock';
import { trackerRouter } from './routes/tracker';
import { employeesRouter } from './routes/employees';
import { reportsRouter } from './routes/reports';
import { settingsRouter } from './routes/settings';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/tracker', trackerRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);

  if (config.isProduction) {
    const frontendDist = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use('/api', notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
