import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authService } from './auth.service';
import { 
  loginSchema, 
  loginResponseSchema, 
  signupCompanySchema, 
  signupCompanyResponseSchema,
  forgotPasswordSchema,
  forgotPasswordResponseSchema,
  resetPasswordSchema,
  resetPasswordResponseSchema,
  verifyEmailQuerySchema,
  meResponseSchema,
  logoutResponseSchema
} from './auth.schema';

const errorSchema = z.object({
  message: z.string(),
  statusCode: z.number().optional()
});

export async function authRoutes(app: FastifyInstance) {
  // Login
  app.withTypeProvider<ZodTypeProvider>().post('/login', {
    schema: {
      body: loginSchema,
      response: {
        200: loginResponseSchema,
        401: errorSchema,
      },
      tags: ['Auth'],
      description: 'Login and set session cookie'
    },
  }, async (request, reply) => {
    try {
      const user = await authService.login(request.body);

      if (!user) {
        return reply.code(401).send({
          message: 'Invalid email or password',
          statusCode: 401
        });
      }

      const token = app.jwt.sign({
      userId: user.user.id,
      companyId: user.company.id,
      companyUserId: user.user.companyUserId,
      role: user.user.role,
    });

    reply.setCookie('kora_session', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true if https
      sameSite: 'lax', // or 'strict'
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

      return {
        ...user,
        token
      };
    } catch (error: any) {
      return reply.code(401).send({
        message: error.message || 'Login failed',
        statusCode: 401
      });
    }
  });

  // Signup Company
  app.withTypeProvider<ZodTypeProvider>().post('/signup-company', {
    schema: {
      body: signupCompanySchema,
      response: {
        201: signupCompanyResponseSchema,
        400: errorSchema,
      },
      tags: ['Auth'],
      description: 'Register a new company and admin user'
    },
  }, async (request, reply) => {
    try {
      const result = await authService.signupCompany(request.body);
      return reply.code(201).send(result);
    } catch (e: any) {
      return reply.code(400).send({ message: e.message || 'Signup failed' });
    }
  });

  // Forgot Password
  app.withTypeProvider<ZodTypeProvider>().post('/forgot-password', {
    schema: {
      body: forgotPasswordSchema,
      response: {
        200: forgotPasswordResponseSchema
      }
    }
  }, async (request, reply) => {
      const result = await authService.forgotPassword(request.body);
      return result;
  });

  // Reset Password
  app.withTypeProvider<ZodTypeProvider>().post('/reset-password', {
    schema: {
      body: resetPasswordSchema,
      response: {
        200: resetPasswordResponseSchema,
        400: errorSchema
      }
    }
  }, async (request, reply) => {
      try {
        const result = await authService.resetPassword(request.body);
        return result;
      } catch (e: any) {
        return reply.code(400).send({ message: e.message });
      }
  });

  // Verify Email (Redirect)
  app.withTypeProvider<ZodTypeProvider>().get('/verify-email', {
    schema: {
      querystring: verifyEmailQuerySchema,
    }
  }, async (request, reply) => {
      try {
        await authService.verifyEmail(request.query.token);
        const frontendUrl = process.env.FRONTEND_URL || 'https://kora-sand.vercel.app';
        return reply.redirect(`${frontendUrl}/auth/login?verified=true`);
      } catch (e) {
         // Redirect to error page?
         const frontendUrl = process.env.FRONTEND_URL || 'https://kora-sand.vercel.app';
         return reply.redirect(`${frontendUrl}/auth/login?error=verification_failed`);
      }
  });

  // Me (Protected)
  app.withTypeProvider<ZodTypeProvider>().get('/me', {
    onRequest: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err: any) {
        reply.send(err);
      }
    }],
    schema: {
      response: {
        200: meResponseSchema,
        401: errorSchema
      }
    }
  }, async (request, reply) => {
      const payload = request.user; 
      const user = await authService.getContext(payload.userId);
      if (!user) return reply.code(401).send({ message: 'Unauthorized', statusCode: 401 });
      return user;
  });

  // Logout
  app.withTypeProvider<ZodTypeProvider>().post('/logout', {
      schema: {
          response: {
              200: logoutResponseSchema
          }
      }
  }, async (request, reply) => {
      reply.clearCookie('kora_session', { path: '/' });
      return { ok: true, message: 'Logged out' };
  });
}
