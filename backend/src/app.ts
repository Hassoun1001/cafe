import path from 'path';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { notFoundMiddleware, errorMiddleware } from './middleware/error';
import { authenticate, authenticateStudy } from './middleware/auth';
import { createAuthRouter } from './routes/auth';
import { createUsersRouter } from './routes/users';
import { menuRouter } from './routes/menu';
import { tablesRouter } from './routes/tables';
import { ordersRouter } from './routes/orders';
import { stockRouter } from './routes/stock';
import { trackerRouter } from './routes/tracker';
import { employeesRouter } from './routes/employees';
import { reportsRouter } from './routes/reports';
import { settingsRouter } from './routes/settings';
import { importRouter } from './routes/import';
import { studyResourcesRouter } from './routes/studyResources';
import { studyBookingsRouter } from './routes/studyBookings';
import { studyConfigRouter } from './routes/studyConfig';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Cafe system
  app.use('/api/auth', createAuthRouter('CAFE', authenticate));
  app.use('/api/users', createUsersRouter('CAFE', authenticate, 'users_manage'));
  app.use('/api/menu', menuRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/tracker', trackerRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/import', importRouter);

  // Study booking system — entirely separate login, own routes under /api/study/*
  app.use('/api/study/auth', createAuthRouter('STUDY', authenticateStudy));
  app.use('/api/study/users', createUsersRouter('STUDY', authenticateStudy, 'study_users_manage'));
  app.use('/api/study/resources', studyResourcesRouter);
  app.use('/api/study/bookings', studyBookingsRouter);
  app.use('/api/study/config', studyConfigRouter);

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
