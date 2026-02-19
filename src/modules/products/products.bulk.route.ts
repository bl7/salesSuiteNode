import { FastifyInstance } from 'fastify';
import { parse } from 'csv-parse';
import { productRepository } from './products.repository';

export async function productsBulkRoutes(app: FastifyInstance) {
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });

    // Download Template
    app.get('/import-template', async (request, reply) => {
        const headers = 'Name (Required),SKU (Required),Description (Optional),Unit (Required),Price (Required),Currency Code (Optional - Default NPR)';
        const sample = '"Premium Coffee","COF-001","Start your day right","Pack",500,"NPR"';
        const csv = `${headers}\n${sample}`;
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename=products_import_template.csv');
        return csv;
    });

    // Bulk Import
    app.post('/import', async (request, reply) => {
        const { user } = request;
        const { authService } = await import('../auth/auth.service');
        const context = await authService.getContext(user.userId);
        if (!context) return reply.code(401).send({ message: 'Unauthorized' });
        
        if (context.user.role === 'rep') return reply.code(403).send({ message: 'Forbidden' });

        const parts = request.parts();
        const results = { imported: 0, skipped: 0, errors: [] as string[] };
        
        // Cache existing SKUs to avoid duplicates
        const existingSkus = new Set<string>();
        const { products: allProducts } = await productRepository.findAll(context.company.id, {});
        allProducts.forEach(p => existingSkus.add(p.sku.toLowerCase()));

        for await (const part of parts) {
            if (part.type === 'file') {
                const parser = part.file.pipe(parse({ 
                    columns: true, 
                    trim: true, 
                    skip_empty_lines: true,
                    bom: true 
                }));

                let rowCount = 0;
                for await (const row of parser) {
                    rowCount++;
                    try {
                        const name = row['Name (Required)'];
                        const sku = row['SKU (Required)'];
                        const unit = row['Unit (Required)'];
                        const priceStr = row['Price (Required)'];
                        
                        if (!name || !sku || !unit || !priceStr) {
                            throw new Error('Name, SKU, Unit, and Price are required');
                        }

                        if (existingSkus.has(sku.toLowerCase())) {
                            throw new Error(`Product with SKU "${sku}" already exists`);
                        }

                        const price = parseFloat(priceStr);
                        if (isNaN(price)) throw new Error('Invalid Price');

                        // Create Product
                        await productRepository.create({
                            companyId: context.company.id,
                            name,
                            sku,
                            description: row['Description (Optional)'] || undefined,
                            unit,
                            price,
                            currencyCode: row['Currency Code (Optional - Default NPR)'] || 'NPR'
                        });

                        existingSkus.add(sku.toLowerCase()); // Add to cache
                        results.imported++;
                        
                    } catch (e: any) {
                        results.skipped++;
                        results.errors.push(`Row ${rowCount}: ${e.message}`);
                    }
                }
            }
        }

        return results;
    });
}
