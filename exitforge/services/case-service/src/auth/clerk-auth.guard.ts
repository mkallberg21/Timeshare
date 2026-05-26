import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    sessionId: string;
  };
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly clerk;

  constructor(private readonly config: ConfigService) {
    this.clerk = createClerkClient({
      secretKey: config.getOrThrow<string>('CLERK_SECRET_KEY'),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const payload = await this.clerk.verifyToken(token);

      // Extract user info from verified JWT claims
      const userId = payload.sub;
      if (!userId) {
        throw new UnauthorizedException('Invalid token: missing subject');
      }

      request.user = {
        id: userId,
        email: (payload['email'] as string | undefined) ?? '',
        sessionId: payload.sid ?? '',
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
