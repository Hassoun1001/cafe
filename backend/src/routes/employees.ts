import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { createEmployeeSchema, updateEmployeeSchema, logConsumptionSchema } from '../schemas/employees.schema';
import * as employeesService from '../services/employees.service';

export const employeesRouter = Router();
employeesRouter.use(authenticate);

employeesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await employeesService.listEmployees());
  }),
);

employeesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createEmployeeSchema.parse(req.body);
    res.status(201).json(await employeesService.createEmployee(data));
  }),
);

employeesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateEmployeeSchema.parse(req.body);
    res.json(await employeesService.updateEmployee(req.params.id, data));
  }),
);

employeesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await employeesService.deleteEmployee(req.params.id);
    res.status(204).end();
  }),
);

employeesRouter.get(
  '/consumption',
  asyncHandler(async (_req, res) => {
    res.json(await employeesService.listConsumption());
  }),
);

employeesRouter.post(
  '/consumption',
  asyncHandler(async (req, res) => {
    const data = logConsumptionSchema.parse(req.body);
    res.status(201).json(await employeesService.logConsumption(data));
  }),
);

employeesRouter.delete(
  '/consumption/:id',
  asyncHandler(async (req, res) => {
    await employeesService.deleteConsumption(req.params.id);
    res.status(204).end();
  }),
);
