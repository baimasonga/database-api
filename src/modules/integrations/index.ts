import "server-only";
import { registerConnector } from "./registry";
import { FileConnector } from "./connectors/file";
import { RestApiConnector } from "./connectors/rest";

/**
 * Connector registration. Only adapters that need no external system's API
 * specification are registered — ODK, database and webhook connectors remain
 * framework-only until their specifications are available.
 */
let registered = false;

export function registerBuiltInConnectors(): void {
  if (registered) return;
  registerConnector(FileConnector);
  registerConnector(RestApiConnector);
  registered = true;
}

export * from "./registry";
