import "server-only";

import {
  clearStaffLoginFailures,
  recordStaffLoginFailure,
  staffLoginAllowed,
} from "@/lib/login-throttle";

const ACTIVATION_THROTTLE_IDENTITY = "swcu-production-admin-activation@internal.invalid";
const GLOBAL_THROTTLE_KEY = "global";

export async function productionActivationAllowed(ipAddress: string) {
  const [globalAllowed, addressAllowed] = await Promise.all([
    staffLoginAllowed(ACTIVATION_THROTTLE_IDENTITY, GLOBAL_THROTTLE_KEY),
    staffLoginAllowed(ACTIVATION_THROTTLE_IDENTITY, ipAddress),
  ]);
  return globalAllowed && addressAllowed;
}

export async function recordProductionActivationFailure(ipAddress: string) {
  await Promise.all([
    recordStaffLoginFailure(ACTIVATION_THROTTLE_IDENTITY, GLOBAL_THROTTLE_KEY),
    recordStaffLoginFailure(ACTIVATION_THROTTLE_IDENTITY, ipAddress),
  ]);
}

export async function clearProductionActivationFailures(ipAddress: string) {
  await Promise.all([
    clearStaffLoginFailures(ACTIVATION_THROTTLE_IDENTITY, GLOBAL_THROTTLE_KEY),
    clearStaffLoginFailures(ACTIVATION_THROTTLE_IDENTITY, ipAddress),
  ]);
}