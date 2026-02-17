import { Router } from 'express';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { scenariosRouter } from './scenarios';
import { sessionsRouter } from './sessions';
import { attemptsRouter } from './attempts';
import { logsRouter } from './logs';
import { reportsRouter } from './reports';
import { yaraRouter } from './yara';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/scenarios', scenariosRouter);
apiRouter.use('/sessions', sessionsRouter);
apiRouter.use('/attempts', attemptsRouter);
apiRouter.use('/logs', logsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/yara', yaraRouter);
