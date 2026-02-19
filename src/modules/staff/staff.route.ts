import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { staffSchema, inviteStaffSchema, updateStaffSchema, listStaffQuerySchema } from './staff.schema';
import { companyUserRepository } from '../companies/company-users.repository';
import { userRepository } from '../users/users.repository';
import { emailService } from '../../services/email.service';
import { pool } from '../../db/pool';
import { emailTokenRepository } from '../auth/email-tokens.repository';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';

export async function staffRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // List Staff
    app.withTypeProvider<ZodTypeProvider>().get('/', {
        schema: {
            querystring: listStaffQuerySchema,
            response: {
                200: z.object({ 
                    ok: z.boolean(), 
                    staff: z.array(staffSchema),
                    counts: z.object({
                        active: z.number(),
                        invited: z.number(),
                        inactive: z.number()
                    })
                }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const [staff, counts] = await Promise.all([
            companyUserRepository.findAll(context.company.id, request.query),
            companyUserRepository.getCounts(context.company.id)
        ]);

        return { ok: true, staff, counts };
    });

    // Invite Staff
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: inviteStaffSchema,
            response: {
                201: z.object({ ok: z.boolean(), message: z.string() }),
                400: z.object({ message: z.string() }),
                401: z.object({ message: z.string() }),
                403: z.object({ message: z.string() }),
                500: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
         const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });
        
        if (context.user.role !== 'boss' && context.user.role !== 'manager') {
            return reply.code(403).send({ message: 'Insufficient permissions' });
        }

        const totalAllowed = (context.company.staffLimit || 0) + 1;
        if ((context.company.staffCount || 0) >= totalAllowed) {
            return reply.code(400).send({ message: 'Staff limit reached. Please upgrade your plan or deactivate existing staff to add more.' });
        }

        // Check if user exists
        const existingUser = await userRepository.findByEmail(request.body.email);
        if (existingUser) {
             return reply.code(400).send({ message: 'User with this email already exists' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Create User with temp password
            const tempPassword = randomBytes(8).toString('hex');
            const passwordHash = await bcrypt.hash(tempPassword, 10);
            
            const newUser = await userRepository.create({
                email: request.body.email,
                fullName: request.body.fullName,
                passwordHash
            }, client);
            
            // Link to Company
            await companyUserRepository.create(
                context.company.id, 
                newUser.id, 
                request.body.role, 
                'invited',
                request.body.phone,
                client
            );

            // Send Emails
            const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
            
            // 1. Credentials Email
            await emailService.sendStaffInvitation(
                request.body.email, 
                request.body.fullName, 
                context.company.name, 
                tempPassword,
                loginUrl
            );

            // 2. Verification Email
            const verifyToken = randomUUID();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            await emailTokenRepository.create({
                token: verifyToken,
                userId: newUser.id,
                tokenType: 'email_verify',
                expiresAt
            }, client);

            await emailService.sendVerificationEmail(request.body.email, request.body.fullName, verifyToken);

            await client.query('COMMIT');
            
            return reply.code(201).send({ ok: true, message: 'Invitation sent' });
        } catch (e) {
            await client.query('ROLLBACK');
            request.log.error(e);
            return reply.code(500).send({ message: 'Invitation failed' } as any);
        } finally {
            client.release();
        }
    });

    // Update Staff
    app.withTypeProvider<ZodTypeProvider>().patch('/:staffId', {
        schema: {
            params: z.object({ staffId: z.string().uuid() }),
            body: updateStaffSchema,
            response: {
                 200: z.object({ ok: z.boolean(), staff: staffSchema }),
                 404: z.object({ message: z.string() }),
                 401: z.object({ message: z.string() }),
                 403: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        if (context.user.role !== 'boss' && context.user.role !== 'manager') {
             return reply.code(403).send({ message: 'Insufficient permissions' });
        }

        const updatedStaff = await companyUserRepository.update(request.params.staffId, context.company.id, request.body);
        if (!updatedStaff) return reply.code(404).send({ message: 'Staff not found' });

        return { ok: true, staff: updatedStaff };
    });
}
