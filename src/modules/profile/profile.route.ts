import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { meResponseSchema } from '../auth/auth.schema';
import { userRepository } from '../users/users.repository';

// We can reuse parts of Auth or Users repository
// Profile is mainly GET /api/auth/me (already implemented) and UPDATE Profile

export const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional()
});

export async function profileRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // Get Profile is technically /api/auth/me but we can alias if needed
    // Assuming just update for now based on typical "Profile" module needs
    
    app.withTypeProvider<ZodTypeProvider>().patch('/', {
        schema: {
            body: updateProfileSchema,
            response: {
                200: meResponseSchema, 
                400: z.object({ message: z.string() }),
                401: z.object({ message: z.string() }),
                501: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
         const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const { fullName, phone, currentPassword, newPassword } = request.body;
        const client = await (await import('../../db/pool')).pool.connect();
        
        try {
            await client.query('BEGIN');

            // 1. Password Change
            if (newPassword) {
                if (!currentPassword) {
                     client.release(); 
                     return reply.code(400).send({ message: 'Current password is required to set new password' } as any);
                }
                
                // Fetch full user to get password hash
                const userFull = await userRepository.findById(context.user.id, client);
                if (!userFull) throw new Error('User not found'); 

                const isValidAuth = await (await import('bcrypt')).compare(currentPassword, userFull.password_hash);
                if (!isValidAuth) {
                     await client.query('ROLLBACK');
                     client.release();
                     return reply.code(401).send({ message: 'Invalid current password' });
                }
                
                const hashedPassword = await (await import('bcrypt')).hash(newPassword, 10);
                await userRepository.update(context.user.id, { passwordHash: hashedPassword }, client);
            }

            // 2. Update Full Name
            if (fullName) {
                await userRepository.update(context.user.id, { fullName }, client);
            }

            // 3. Update Phone (Company User)
            if (phone) {
                const { companyUserRepository } = await import('../companies/company-users.repository');
                await companyUserRepository.update(context.user.companyUserId, context.company.id, { phone }, client);
            }

            await client.query('COMMIT');
            
            // Return updated context
            const newContext = await authService.getContext(context.user.id);
            if (!newContext) throw new Error('Failed to reload context'); // Should not happen
            
            return newContext;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    });
}
