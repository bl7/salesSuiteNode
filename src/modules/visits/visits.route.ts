import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { visitRepository } from './visits.repository';
import {
  visitSchema,
  createVisitSchema,
  updateVisitSchema,
  listVisitsQuerySchema
} from './visits.schema';

const GPS_ACCURACY_THRESHOLD_M = 50; // If GPS accuracy is worse than this, auto-exception

export async function visitsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // List Visits
    app.withTypeProvider<ZodTypeProvider>().get('/', {
        schema: {
            querystring: listVisitsQuerySchema,
            response: {
                200: z.object({ ok: z.boolean(), visits: z.array(visitSchema) }),
                401: z.object({ message: z.string() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        let repId = request.query.rep;
        if (context.user.role === 'rep') {
            repId = context.user.companyUserId;
        }

        const visits = await visitRepository.findAll({
            companyId: context.company.id,
            repId: repId,
            shopId: request.query.shop,
            dateFrom: request.query.date_from,
            dateTo: request.query.date_to,
            exceptionsOnly: request.query.exceptions_only === 'true',
            regionId: request.query.region
        });

        return { ok: true, visits };
    });

    // Create Visit — with geofence + exception logic
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: createVisitSchema,
            response: {
                201: z.object({ ok: z.boolean(), visit: visitSchema }),
                401: z.object({ message: z.string() }),
                404: z.object({ message: z.string() }),
                422: z.object({ message: z.string(), distanceM: z.number().optional(), geofenceRadiusM: z.number().optional() })
            }
        }
    }, async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const { shopRepository } = await import('../shops/shops.repository');
        const { getDistance } = await import('geolib');

        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });

        const shop = await shopRepository.findById(request.body.shopId, context.company.id);
        if (!shop) return reply.code(404).send({ message: 'Shop not found' });

        let isVerified = false;
        let distanceM: number | null = null;
        let verificationMethod = 'none';
        let exceptionReason = request.body.exceptionReason ?? null;
        const exceptionNote = request.body.exceptionNote ?? null;
        const gpsAccuracyM = request.body.gpsAccuracyM ?? null;

        if (request.body.latitude && request.body.longitude && shop.latitude && shop.longitude) {
            const dist = getDistance(
                { latitude: request.body.latitude, longitude: request.body.longitude },
                { latitude: shop.latitude, longitude: shop.longitude }
            );
            distanceM = dist;

            // Auto-exception if GPS accuracy is too poor
            if (gpsAccuracyM && gpsAccuracyM > GPS_ACCURACY_THRESHOLD_M) {
                isVerified = false;
                verificationMethod = 'low_accuracy';
                if (!exceptionReason) exceptionReason = 'low_gps_accuracy';
            } else if (dist <= shop.geofence_radius_m) {
                isVerified = true;
                verificationMethod = 'geofence';
                exceptionReason = null; // Clear any exception if they're actually at the shop
            } else {
                // Out of range — require exception reason
                isVerified = false;
                verificationMethod = 'gps_mismatch';
                // If no exception reason provided, we still allow but mark as needing review
                if (!exceptionReason) exceptionReason = 'other';
            }
        } else {
            verificationMethod = 'manual';
            if (!exceptionReason) exceptionReason = 'other';
        }

        const visit = await visitRepository.create({
            companyId: context.company.id,
            repCompanyUserId: context.user.companyUserId,
            shopId: request.body.shopId,
            latitude: request.body.latitude,
            longitude: request.body.longitude,
            gpsAccuracyM,
            notes: request.body.notes,
            purpose: request.body.purpose,
            outcome: request.body.outcome,
            imageUrl: request.body.imageUrl,
            isVerified,
            distanceM,
            verificationMethod,

            exceptionReason,
            exceptionNote
        });

        return reply.code(201).send({ ok: true, visit });
    });

    // Update Visit — also handles manager approve/flag
    app.withTypeProvider<ZodTypeProvider>().patch('/:visitId', {
        schema: {
            params: z.object({ visitId: z.string().uuid() }),
            body: updateVisitSchema,
            response: {
                200: z.object({ ok: z.boolean(), visit: visitSchema }),
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

        const currentVisit = await visitRepository.findById(request.params.visitId, context.company.id);
        if (!currentVisit) return reply.code(404).send({ message: 'Visit not found' });

        // Rep can only update their own visits
        if (context.user.role === 'rep' && currentVisit.rep_company_user_id !== context.user.companyUserId) {
            return reply.code(403).send({ message: 'Forbidden' });
        }

        // Reps cannot approve/flag
        if (context.user.role === 'rep' && (request.body.approve || request.body.flag)) {
            return reply.code(403).send({ message: 'Only managers can approve or flag visits' });
        }

        const updateData: any = { ...request.body };

        if (updateData.end) {
            updateData.status = 'completed';
        }

        // Capture end coordinates if ending visit
        if (request.body.end) {
            if (request.body.endLatitude != null) updateData.endLat = request.body.endLatitude;
            if (request.body.endLongitude != null) updateData.endLng = request.body.endLongitude;
        }

        // Handle manager approve/flag
        if (request.body.approve) {
            updateData.approvedByManagerId = context.user.companyUserId;
            updateData.approvedAt = new Date();
            updateData.flaggedByManagerId = null;
        }
        if (request.body.flag) {
            updateData.flaggedByManagerId = context.user.companyUserId;
            updateData.approvedByManagerId = null;
            updateData.approvedAt = null;
        }
        if (request.body.managerNote !== undefined) {
            updateData.managerNote = request.body.managerNote;
        }

        const visit = await visitRepository.update(request.params.visitId, context.company.id, updateData);
        if (!visit) return reply.code(404).send({ message: 'Visit not found' });

        return { ok: true, visit };
    });
}
