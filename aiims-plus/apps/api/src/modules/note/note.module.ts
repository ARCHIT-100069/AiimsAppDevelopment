import { Module } from "@nestjs/common";
import { NoteController } from "./note.controller.js";
import { NoteService } from "./note.service.js";
import { AuditService } from "../../platform/audit.service.js";
import { OutboxService } from "../../platform/outbox.service.js";
@Module({ controllers: [NoteController], providers: [NoteService, AuditService, OutboxService] })
export class NoteModule {}
