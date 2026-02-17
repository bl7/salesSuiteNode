import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contactFormSchema, contactFormResponseSchema } from './contact.schema';
import { emailService } from '../../services/email.service';

export async function contactRoutes(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post('/', {
        schema: {
            body: contactFormSchema,
            response: {
                200: contactFormResponseSchema
            }
        }
    }, async (request, reply) => {
        const { name, company, email, phone, teamSize, message } = request.body;

        // Send notification to Admin
        await emailService.sendContactFormNotification({ 
            name, company, email, phone, teamSize: teamSize || 'N/A', message 
        });

        // Send confirmation to User
        await emailService.sendContactFormConfirmation(name, email);

        return { ok: true, message: 'Message sent successfully' };
    });
}
