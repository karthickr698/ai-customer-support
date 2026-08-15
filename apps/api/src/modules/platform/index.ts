export type { PlatformModule } from './compose-platform.js';
export { composePlatform } from './compose-platform.js';
export { LoadPlatformActorService } from './application/use-cases/operator-use-cases.js';
export { PlatformPermissions } from './domain/permissions.js';
export {
  createRequirePlatformPermissionPreHandler,
  createResolvePlatformOperatorPreHandler,
} from './adapters/inbound/http/require-platform-permission.js';
