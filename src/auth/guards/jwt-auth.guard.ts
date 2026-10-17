import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: unknown, info: unknown): TUser {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException('Authentication credentials are missing or invalid')
      );
    }
    return user as TUser;
  }
}
