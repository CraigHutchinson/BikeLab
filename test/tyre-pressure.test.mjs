import test from 'node:test';
import * as api from '../scripts/lib/tyre-pressure.mjs';
import {pressureChecks} from '../scripts/lib/tyre-pressure-checks.mjs';
for(const {name,run} of pressureChecks(api))test(name,run);
