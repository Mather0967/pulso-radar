import type { Scenario } from '../../engine/types';
import { dental } from './dental';
import { ferreteria } from './ferreteria';
import { restaurante } from './restaurante';

export const scenarios: Scenario[] = [ferreteria, dental, restaurante];
export const scenarioById = (id: string | null) => scenarios.find((s) => s.id === id) ?? null;
