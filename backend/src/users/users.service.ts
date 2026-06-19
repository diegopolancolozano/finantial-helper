import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserInput {
  email: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserInput) {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  updateRefreshToken(id: string, refreshToken: string) {
    return this.prisma.user.update({
      where: { id },
      data: { refreshToken },
    });
  }

  clearRefreshToken(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { refreshToken: null },
    });
  }
}
