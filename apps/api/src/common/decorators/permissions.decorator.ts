import { SetMetadata } from "@nestjs/common";

import type { PermissionCode } from "@erpdog/contracts";

export const REQUIRED_PERMISSIONS = "requiredPermissions";

export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
