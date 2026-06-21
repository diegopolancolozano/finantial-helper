import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('El email ya está registrado');

    const rounds = Number(this.config.get('BCRYPT_ROUNDS') ?? 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Credenciales inválidas');

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async refresh(userId: string, rawRefreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user?.refreshToken) throw new UnauthorizedException('Sesión inválida');

    const tokenValid = await bcrypt.compare(rawRefreshToken, user.refreshToken);
    if (!tokenValid) throw new UnauthorizedException('Sesión inválida');

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshToken(userId);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, rawToken: string) {
    const rounds = Number(this.config.get('BCRYPT_ROUNDS') ?? 12);
    const hashed = await bcrypt.hash(rawToken, rounds);
    await this.usersService.updateRefreshToken(userId, hashed);
  }
}
