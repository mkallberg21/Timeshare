import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger, UseGuards } from "@nestjs/common";
import type { Server, Socket } from "socket.io";

export interface CaseUpdatePayload {
  caseId: string;
  status?: string;
  exitTrack?: string | null;
  probabilityScore?: number | null;
  timelineP50Days?: number | null;
  timelineP90Days?: number | null;
  updatedAt?: string;
}

export interface MessagePayload {
  caseId: string;
  messageId: string;
  content: string;
  senderType: string;
  createdAt: string;
}

@WebSocketGateway({
  namespace: "/cases",
  cors: {
    origin: [
      process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  },
})
export class CasesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(CasesGateway.name);

  afterInit(): void {
    this.logger.log("CasesGateway WebSocket server initialised at /cases");
  }

  handleConnection(client: Socket): void {
    this.logger.verbose(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.verbose(`Client disconnected: ${client.id}`);
  }

  /**
   * Client sends { caseId } to subscribe to updates for that case.
   * Rooms are named "case:<caseId>" for targeted broadcasts.
   */
  @SubscribeMessage("join:case")
  async handleJoinCase(
    @ConnectedSocket() client: Socket,
    @MessageBody() caseId: string,
  ): Promise<void> {
    await client.join(`case:${caseId}`);
    this.logger.verbose(`Client ${client.id} joined room case:${caseId}`);
    client.emit("joined", { caseId });
  }

  @SubscribeMessage("leave:case")
  async handleLeaveCase(
    @ConnectedSocket() client: Socket,
    @MessageBody() caseId: string,
  ): Promise<void> {
    await client.leave(`case:${caseId}`);
    this.logger.verbose(`Client ${client.id} left room case:${caseId}`);
  }

  /**
   * Called internally by CasesService when a case is updated.
   * Broadcasts to all clients subscribed to this case.
   */
  emitCaseUpdate(update: CaseUpdatePayload): void {
    this.server.to(`case:${update.caseId}`).emit("case:updated", update);
    this.logger.verbose(`Emitted case:updated for ${update.caseId}`);
  }

  /**
   * Called when a new message arrives for the case.
   */
  emitNewMessage(message: MessagePayload): void {
    this.server.to(`case:${message.caseId}`).emit("message:new", message);
  }
}
