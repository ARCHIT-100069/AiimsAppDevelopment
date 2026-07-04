import { Injectable } from "@nestjs/common";
type Handler = (e: unknown) => void | Promise<void>;
@Injectable()
export class EventBus {
  private handlers = new Map<string, Handler[]>();
  on(type: string, h: Handler) { this.handlers.set(type, [...(this.handlers.get(type) ?? []), h]); }
  async publish(type: string, e: unknown) { for (const h of this.handlers.get(type) ?? []) await h(e); }
}
