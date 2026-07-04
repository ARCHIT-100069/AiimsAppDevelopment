import type { Principal } from "@aiims/authz";
export interface RequestContext { correlationId: string; principal?: Principal; }
