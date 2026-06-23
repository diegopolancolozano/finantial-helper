import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AuthService (integration)', () => {
  let authService: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({})],
      providers: [AuthService, UsersService, PrismaService],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@auth.int' } } });
    await prisma.onModuleDestroy();
  });

  it('register — devuelve accessToken y refreshToken', async () => {
    const result = await authService.register({
      email: 'new@auth.int',
      password: 'Test1234!',
    });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('register — lanza ConflictException si el email ya existe', async () => {
    await authService.register({ email: 'dup@auth.int', password: 'Test1234!' });
    await expect(
      authService.register({ email: 'dup@auth.int', password: 'Test1234!' }),
    ).rejects.toThrow(ConflictException);
  });

  it('login — devuelve tokens con credenciales correctas', async () => {
    await authService.register({ email: 'login@auth.int', password: 'Test1234!' });
    const result = await authService.login({
      email: 'login@auth.int',
      password: 'Test1234!',
    });
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('login — lanza UnauthorizedException con contraseña incorrecta', async () => {
    await authService.register({ email: 'badpass@auth.int', password: 'Test1234!' });
    await expect(
      authService.login({ email: 'badpass@auth.int', password: 'Wronggggg!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login — lanza UnauthorizedException si el usuario no existe', async () => {
    await expect(
      authService.login({ email: 'nobody@auth.int', password: 'Test1234!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('logout — elimina el refresh token del usuario', async () => {
    await authService.register({ email: 'logout@auth.int', password: 'Test1234!' });
    const user = await prisma.user.findUnique({ where: { email: 'logout@auth.int' } });
    expect(user?.refreshToken).not.toBeNull();

    await authService.logout(user!.id);
    const after = await prisma.user.findUnique({ where: { email: 'logout@auth.int' } });
    expect(after?.refreshToken).toBeNull();
  });
});
